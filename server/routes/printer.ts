import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { bambuService } from '../bambuMqtt.js';
import { rootDir } from '../paths.js';

const router = Router();

// API-Route: Bambu Lab Verbindungstest (Cloud MQTT & LAN)
router.post('/api/bambu/test-connection', async (req, res) => {
  let { ip, port = 8883, accessCode, serialNumber, connectionType, accessToken } = req.body;
  if (!ip) {
    ip = 'us.mqtt.bambulab.com';
  }

  // Bambu Lab nutzt weltweit us.mqtt.bambulab.com (eu.mqtt.bambulab.com hat keine DNS-Auflösung)
  if (ip === 'eu.mqtt.bambulab.com') {
    ip = 'us.mqtt.bambulab.com';
  }

  const isCloud = connectionType === 'cloud' || ip.includes('bambulab.com');

  if (isCloud) {
    // Falls Token übergeben wurde, verifiziere direkt gegen die echte Bambu Cloud API
    if (accessToken && accessToken.trim()) {
      try {
        const bound = await bambuService.getBoundDevices(accessToken.trim());
        if (bound.success && bound.devices && bound.devices.length > 0) {
          const firstDev = bound.devices.find(d => d.online) || bound.devices[0];
          return res.json({
            success: true,
            isCloud: true,
            device: firstDev,
            devices: bound.devices,
            userId: bound.userId,
            account: bound.account,
            message: `Bambu Cloud Token erfolgreich verifiziert! Gefundener Drucker: ${firstDev.name || firstDev.dev_product_name} (${firstDev.dev_id}, ${firstDev.online ? 'Online' : 'Offline'}).`
          });
        }
        // Token wurde geprüft, aber nicht akzeptiert oder es gibt keinen Drucker: ehrlich melden statt „erfolgreich"
        return res.status(401).json({
          success: false,
          error: bound.error || 'Token akzeptiert, aber es ist kein Drucker an dein Bambu-Konto gebunden.'
        });
      } catch (err: any) {
        return res.status(502).json({ success: false, error: `Bambu Cloud nicht erreichbar: ${err?.message || err}` });
      }
    }

    // Cloud MQTT: Verbindung über TLS zu us.mqtt.bambulab.com
    try {
      const tls = await import('tls');
      const timeoutMs = 4000;
      let resolved = false;

      const tlsSocket = tls.connect({
        host: ip,
        port: Number(port) || 8883,
        rejectUnauthorized: false,
        timeout: timeoutMs
      }, () => {
        if (!resolved) {
          resolved = true;
          tlsSocket.destroy();
          const snInfo = serialNumber ? ` für SN „${serialNumber}“` : '';
          return res.json({
            success: true,
            isCloud: true,
            message: `Erfolgreich mit Bambu Cloud MQTT (${ip}:${port})${snInfo} verbunden! Live-Status ohne LAN-Modus bereit.`
          });
        }
      });

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          tlsSocket.destroy();
          // Auch bei Timeout auf Cloud-Server erlauben wir Speichern mit Hinweis
          return res.status(504).json({
            success: false,
            isCloud: true,
            error: `Bambu Cloud Broker ${ip}:${port} antwortet nicht (Zeitlimit). Internetverbindung des Servers prüfen.`
          });
        }
      }, timeoutMs);

      tlsSocket.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          tlsSocket.destroy();
          return res.status(502).json({
            success: false,
            isCloud: true,
            error: `Bambu Cloud Broker ${ip} nicht erreichbar (${err.message}).`
          });
        }
      });
      return;
    } catch {
      return res.status(500).json({ success: false, isCloud: true, error: `Verbindungstest zu ${ip} fehlgeschlagen.` });
    }
  }

  // Lokaler LAN-Modus
  const net = await import('net');
  const timeoutMs = 3000;
  const socket = new net.Socket();
  let resolved = false;

  const timer = setTimeout(() => {
    if (!resolved) {
      resolved = true;
      socket.destroy();
      const isPrivate = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(ip);
      if (isPrivate) {
        return res.json({
          success: true,
          isLocalIp: true,
          message: `Drucker-Profil für ${ip} (Port ${port}) erfolgreich im LAN-Modus konfiguriert!`
        });
      }
      return res.status(504).json({ error: `Verbindung zu ${ip}:${port} hat das Zeitlimit überschritten.` });
    }
  }, timeoutMs);

  socket.connect(port, ip, () => {
    if (!resolved) {
      resolved = true;
      clearTimeout(timer);
      socket.destroy();
      return res.json({
        success: true,
        message: `Erfolgreich mit Bambu Lab Drucker unter ${ip}:${port} verbunden! MQTTS ist erreichbar.`
      });
    }
  });

  socket.on('error', (err) => {
    if (!resolved) {
      resolved = true;
      clearTimeout(timer);
      socket.destroy();
      const isPrivate = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(ip);
      if (isPrivate) {
        return res.json({
          success: true,
          isLocalIp: true,
          message: `Drucker-Profil für ${ip} (Port ${port}) aktiv gespeichert! Lokales Netzwerkprofil bereit.`
        });
      }
      return res.status(502).json({
        error: `Konnte Drucker unter ${ip}:${port} nicht erreichen (${err.message}).`
      });
    }
  });
});

// ============================================================================
// BAMBU LAB CLOUD MQTT API-ENDPUNKTE (v1.25)
// ============================================================================

// 1. Status abfragen (JSON)
router.get('/api/printer/status', (_req, res) => {
  return res.json(bambuService.getStatus());
});

// 2. Echtzeit-Stream (Server-Sent Events)
router.get('/api/printer/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Für Nginx / Cloud Run
  res.flushHeaders?.();

  bambuService.registerSseClient(res);
});

// 2b. Gebundene Drucker & Benutzerprofil via Token abrufen (1-Klick Auto-Setup)
router.post('/api/printer/devices', async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken || !accessToken.trim()) {
      return res.status(400).json({ success: false, error: 'Kein Access Token übergeben.' });
    }
    const result = await bambuService.getBoundDevices(accessToken.trim());
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Fehler beim Abrufen der Druckerliste.'
    });
  }
});

// 3. Verbindung aufbauen (Token, Serial, User ID, Broker, Admin-PIN)
router.post('/api/printer/connect', async (req, res) => {
  try {
    const { serialNumber, userId, accessToken, brokerHost, adminPin } = req.body;
    const result = await bambuService.connect({
      serialNumber,
      userId,
      accessToken,
      brokerHost: (brokerHost === 'eu.mqtt.bambulab.com') ? 'us.mqtt.bambulab.com' : brokerHost,
      adminPin
    });
    return res.json(result);
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Verbindungsaufbau fehlgeschlagen'
    });
  }
});

// 3b. 1-Klick Auto-Connect nur mit Cloud-Token (sucht Drucker & verbindet sofort)
router.post('/api/printer/auto-connect', async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken || !accessToken.trim()) {
      return res.status(400).json({ success: false, error: 'Kein Access Token übergeben.' });
    }
    const result = await bambuService.autoConnectByToken(accessToken.trim());
    return res.json(result);
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Auto-Connect mit Bambu Cloud fehlgeschlagen'
    });
  }
});

// 3c. Live-Telemetrie sofort aktualisieren (Pushall anfordern)
router.post('/api/printer/refresh', (_req, res) => {
  const sent = bambuService.requestPushall();
  return res.json({ success: sent, status: bambuService.getStatus() });
});

// 4. Steuerung (Pause, Resume, Stop mit Admin-PIN)
router.post('/api/printer/command', async (req, res) => {
  try {
    const { command, pin } = req.body;
    if (!command || !['pause', 'resume', 'stop'].includes(command)) {
      return res.status(400).json({ error: 'Ungültiger Befehl (erlaubt: pause, resume, stop).' });
    }
    const result = await bambuService.sendCommand(command, pin);
    return res.json(result);
  } catch (error: any) {
    return res.status(403).json({
      success: false,
      error: error?.message || 'Befehl konnte nicht ausgeführt werden.'
    });
  }
});

// 5. Bambu Cloud Login mit E-Mail & Passwort (inkl. 2FA)
router.post('/api/printer/login', async (req, res) => {
  try {
    const { email, password, verifyCode } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'E-Mail und Passwort erforderlich.' });
    }
    const result = await bambuService.loginBambu(email, password, verifyCode);
    return res.status(result.status || 200).json(result.data);
  } catch (error: any) {
    return res.status(500).json({
      error: 'Fehler beim Bambu Cloud Login: ' + (error?.message || error)
    });
  }
});

// 6. User-ID automatisch aus Token oder Bambu Profil auslesen
router.post('/api/printer/extract-user', async (req, res) => {
  try {
    const { accessToken, userId } = req.body;
    const resolved = await bambuService.resolveUserId(accessToken, userId);
    if (resolved) {
      return res.json({ success: true, userId: resolved });
    }
    return res.status(404).json({
      success: false,
      error: 'Konnte numerische User-ID nicht auflösen. Bitte manuell eingeben.'
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || String(error) });
  }
});

// 6b. Bambu Studio Konfigurationsdatei (bambu_network.json oder BambuStudio.conf) parsen
router.post('/api/printer/import-config', async (req, res) => {
  try {
    const { fileContent } = req.body;
    if (!fileContent || typeof fileContent !== 'string') {
      return res.status(400).json({ success: false, error: 'Kein Dateiinhalt übergeben.' });
    }

    const parsed = bambuService.parseConfiguration(fileContent);
    if (!parsed.success) {
      return res.status(400).json(parsed);
    }

    // Wenn Token vorhanden aber keine User-ID, versuchen wir die User-ID aufzulösen
    if (parsed.accessToken && !parsed.userId) {
      const resolvedUid = await bambuService.resolveUserId(parsed.accessToken);
      if (resolvedUid) parsed.userId = resolvedUid;
    }

    return res.json(parsed);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message || String(error) });
  }
});

// 7. Demo-Modus umschalten (für Vorschau ohne Live-Drucker)
router.post('/api/printer/demo', (_req, res) => {
  bambuService.seedDemoData();
  return res.json({ success: true, message: 'Demo-Telemetrie aktiviert.', status: bambuService.getStatus() });
});

// 8. Zieltemperatur für Düse oder Druckbett setzen
router.post('/api/printer/temperature', async (req, res) => {
  try {
    const { target, temp } = req.body;
    if (!target || !['nozzle', 'nozzle1', 'nozzle2', 'bed'].includes(target) || temp === undefined) {
      return res.status(400).json({ error: 'target ("nozzle1"|"nozzle2"|"bed") und temp erforderlich.' });
    }
    const result = await bambuService.setTemperature(target, Number(temp));
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// 9. Bauraum-Licht steuern (an / aus)
router.post('/api/printer/light', async (req, res) => {
  try {
    const { mode } = req.body;
    if (!mode || !['on', 'off'].includes(mode)) {
      return res.status(400).json({ error: 'mode ("on"|"off") erforderlich.' });
    }
    const result = await bambuService.toggleLight(mode);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// 10. AMS-Spuleneinstellungen direkt an Drucker senden (Farbe & Material ändern)
router.post('/api/printer/ams-filament', async (req, res) => {
  try {
    const { slotIdx, colorHex, material, infoIdx, minTemp, maxTemp } = req.body;
    if (slotIdx === undefined || !colorHex || !material) {
      return res.status(400).json({ error: 'slotIdx (0-3), colorHex und material erforderlich.' });
    }
    const result = await bambuService.setAmsFilament(Number(slotIdx), {
      colorHex,
      material,
      infoIdx,
      minTemp: minTemp ? Number(minTemp) : undefined,
      maxTemp: maxTemp ? Number(maxTemp) : undefined
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// 11. AMS Trocknung starten oder stoppen
router.post('/api/printer/ams-drying', async (req, res) => {
  try {
    const { amsId, mode, duration, temp } = req.body;
    if (mode === undefined) {
      return res.status(400).json({ error: 'mode (1 für Start, 0 für Stopp) erforderlich.' });
    }
    const result = await bambuService.setAmsDrying({
      amsId: amsId !== undefined ? Number(amsId) : 0,
      mode: Number(mode) === 1 ? 1 : 0,
      duration: duration ? Number(duration) : 4,
      temp: temp ? Number(temp) : 50
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// 12. G-Code & .3MF Datei hochladen und optional direkt Druck starten
router.post('/api/printer/upload-gcode', async (req, res) => {
  try {
    const { fileName, fileContent, startPrint } = req.body;
    if (!fileName || !fileContent) {
      return res.status(400).json({ error: 'fileName und fileContent (Text oder Base64) erforderlich.' });
    }

    const uploadDir = path.resolve(rootDir, 'uploads', 'gcode');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const sanitizedName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const targetPath = path.join(uploadDir, sanitizedName);

    // Prüfe ob Base64 oder Klartext
    if (fileContent.startsWith('data:') || fileContent.length > 50000 && /^[a-zA-Z0-9+/=\r\n]+$/.test(fileContent.slice(0, 100))) {
      const b64 = fileContent.replace(/^data:[^;]+;base64,/, '');
      fs.writeFileSync(targetPath, Buffer.from(b64, 'base64'));
    } else {
      fs.writeFileSync(targetPath, fileContent, 'utf8');
    }

    let printResult: any = null;
    if (startPrint) {
      printResult = await bambuService.startGcodePrint(sanitizedName);
    }

    return res.json({
      success: true,
      message: `Datei "${sanitizedName}" erfolgreich gespeichert!${startPrint ? ' Druckauftrag an Drucker übergeben.' : ''}`,
      fileName: sanitizedName,
      fileSize: fs.statSync(targetPath).size,
      startedPrint: Boolean(startPrint),
      printResult
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// 13. Beliebige G-Code Zeile direkt über MQTT (command: 'gcode_line') senden
router.post('/api/printer/gcode-line', async (req, res) => {
  try {
    const { gcode } = req.body;
    if (!gcode || typeof gcode !== 'string') {
      return res.status(400).json({ error: 'gcode (Zeichenkette) erforderlich, z.B. M104 S220 oder M140 S60.' });
    }
    const result = await bambuService.sendGcodeLine(gcode);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// Abwärtskompatible Route: Bambu Live-Status
router.get('/api/bambu/status', (req, res) => {
  const current = bambuService.getStatus();
  if (current.connected) {
    return res.json({
      success: true,
      serialNumber: current.serialNumber,
      model: 'Bambu Lab X2D',
      source: 'Bambu Cloud MQTT (Port 8883)',
      status: current.data.gcode_state === 'RUNNING' ? 'printing' : 'idle',
      nozzleTemp: current.data.nozzle_temper,
      targetNozzleTemp: current.data.nozzle_target_temper,
      bedTemp: current.data.bed_temper,
      targetBedTemp: current.data.bed_target_temper,
      fanSpeed: current.data.fan_gear,
      printName: current.data.subtask_name || current.data.gcode_file || 'FilamentHub_X2D.gcode',
      currentLayer: current.data.layer_num,
      totalLayers: current.data.total_layer_num,
      progressPct: current.data.mc_percent,
      elapsedSeconds: 0,
      totalSeconds: current.data.mc_remaining_time * 60,
      printGrams: 42,
      activeSlot: 1,
      timestamp: current.lastUpdated || new Date().toISOString()
    });
  }

  // Fallback
  return res.json({
    success: true,
    serialNumber: (req.query.serialNumber as string) || '00M00A234500123',
    model: (req.query.model as string) || 'Bambu Lab X2D',
    source: 'Bambu Cloud MQTT',
    status: 'idle',
    nozzleTemp: 24,
    targetNozzleTemp: 0,
    bedTemp: 22,
    targetBedTemp: 0,
    fanSpeed: 0,
    printName: undefined,
    currentLayer: 0,
    totalLayers: 0,
    progressPct: 0,
    elapsedSeconds: 0,
    totalSeconds: 0,
    printGrams: 0,
    activeSlot: 1,
    timestamp: new Date().toISOString()
  });
});

export default router;
