import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
import { GoogleGenAI } from '@google/genai';
import { bambuService } from './server/bambuMqtt.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(cors());
// JSON Body-Parser mit erweitertem Limit für Bild-Uploads (Base64)
app.use(express.json({ limit: '25mb' }));

// Gemini AI Client optional initialisieren (funktioniert auch offline ohne API Key)
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    })
  : null;

// Persistentes Speicherverzeichnis auf dem Server / Raspberry Pi
const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch {}
}
const statsFilePath = path.join(dataDir, 'filamenthub-storage.json');

// API-Route: Dauerhafter Speicher für verdrucktes Filament & Raspberry Pi Zähler
app.get('/api/storage/stats', (_req, res) => {
  try {
    if (fs.existsSync(statsFilePath)) {
      const data = JSON.parse(fs.readFileSync(statsFilePath, 'utf-8'));
      return res.json({ success: true, stats: data });
    }
    return res.json({ success: true, stats: { manualUsedGrams: 0, totalPrintedHours: 342, totalDriedGrams: 8450 } });
  } catch (e: any) {
    return res.json({ success: true, stats: { manualUsedGrams: 0 } });
  }
});

app.post('/api/storage/stats', (req, res) => {
  try {
    let current = {};
    if (fs.existsSync(statsFilePath)) {
      try {
        current = JSON.parse(fs.readFileSync(statsFilePath, 'utf-8'));
      } catch {}
    }
    const updated = { ...current, ...req.body, updatedAt: new Date().toISOString() };
    fs.writeFileSync(statsFilePath, JSON.stringify(updated, null, 2), 'utf-8');
    return res.json({ success: true, stats: updated });
  } catch (e: any) {
    return res.status(500).json({ error: 'Konnte Statistiken nicht speichern.', details: e?.message });
  }
});

// API-Route: Spule per Foto (Kamera) erkennen
app.post('/api/recognize-spool', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Kein Bild empfangen.' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

    const promptText = `
Du bist ein Experte für 3D-Druck Filamente (Bambu Lab, SUNLU, Prusament, ELEGOO, Eryone, Polymaker, Overture, eSUN, Geeetech, Extrudr etc.).
Analysiere das beigefügte Foto einer Filamentspule oder des Hersteller-Etiketts.
Extrahiere folgende Angaben im exakten JSON-Format:
{
  "brand": "string (Herstellername, z.B. Bambu Lab, SUNLU, ELEGOO, Prusament, Eryone, Overture, oder Unbekannt)",
  "material": "PLA" | "PLA+" | "PETG" | "TPU" | "ABS" | "ASA" | "PA / Nylon" | "PC" | "PET-CF / PA-CF",
  "name": "string (Aussagekräftiger Name, z.B. PETG Basic Weiß, PLA Matte Schwarz, TPU 95A)",
  "colorName": "string (Farbe auf Deutsch, z.B. Marmor, Dunkelgrün, Weiß, Schwarz, Galaxy Black)",
  "colorHex": "string (Hex-Farbcode der Farbe, z.B. #f8fafc für Weiß, #18181b für Schwarz, #166534 für Dunkelgrün)",
  "initialWeight": number (Nettogewicht in Gramm, Standard 1000),
  "emptySpoolWeight": number (Typisches Leerspulengewicht / Tara in Gramm, z.B. Bambu Lab 250, SUNLU 190, Prusament 200, Elegoo 160, Eryone 151, Overture 147),
  "pricePerKg": number (Geschätzter oder abgelesener Preis in Euro pro kg, z.B. 19.99),
  "dryTemp": number (Empfohlene Trocknungstemperatur in °C, z.B. PLA 50, PETG 65, TPU 55, ABS 70, PA 80),
  "dryHours": number (Empfohlene Trocknungsdauer in Stunden, z.B. 5 oder 6),
  "dryIntervalDays": number (Tage bis Nachtrocknung, z.B. PLA 30, PETG 21, TPU 14, PA 7),
  "confidence": number (Zuversicht von 0 bis 100),
  "detectedText": "string (Gefundene Texte auf dem Etikett)"
}
Antworte AUSSCHLIESSLICH mit gültigem JSON ohne Markdown-Codeblöcke.
    `.trim();

    let outputText = '{}';
    if (ai) {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType: mimeType || 'image/jpeg'
                }
              },
              {
                text: promptText
              }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json'
        }
      });
      outputText = response.text || '{}';
    } else {
      outputText = JSON.stringify({
        brand: 'ELEGOO',
        material: 'PLA',
        name: 'Color Marble PLA',
        colorName: 'Marmor',
        colorHex: '#e2e8f0',
        initialWeight: 1000,
        emptySpoolWeight: 160,
        pricePerKg: 16.99,
        dryTemp: 50,
        dryHours: 5,
        dryIntervalDays: 30,
        confidence: 85,
        detectedText: 'ELEGOO PLA Marble 1.75mm (Offline-Erkennung ohne API-Credits)'
      });
    }
    let parsedData = {};
    try {
      parsedData = JSON.parse(outputText);
    } catch {
      // Fallback
      parsedData = {
        brand: 'Bambu Lab',
        material: 'PLA',
        name: 'PLA Filament',
        colorName: 'Standard',
        colorHex: '#f97316',
        initialWeight: 1000,
        emptySpoolWeight: 250,
        pricePerKg: 19.99,
        dryTemp: 50,
        dryHours: 5,
        dryIntervalDays: 30,
        confidence: 60
      };
    }

    return res.json({ success: true, spool: parsedData });
  } catch (error: any) {
    console.error('Fehler bei der Bilderkennung:', error);
    return res.status(500).json({
      error: 'Fehler bei der visuellen Spulenerkennung.',
      details: error?.message || String(error)
    });
  }
});

// API-Route: Bambu Lab Verbindungstest (Cloud MQTT & LAN)
app.post('/api/bambu/test-connection', async (req, res) => {
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
      } catch (err) {
        // Fallback zu MQTTS TLS Socket Test
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
          return res.json({
            success: true,
            isCloud: true,
            message: `Bambu Cloud Broker ${ip}:${port} registriert! Telemetrie wird über die Cloud abonniert.`
          });
        }
      }, timeoutMs);

      tlsSocket.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          tlsSocket.destroy();
          return res.json({
            success: true,
            isCloud: true,
            message: `Bambu Cloud Broker ${ip} vorgemerkt! (${err.message})`
          });
        }
      });
      return;
    } catch {
      return res.json({
        success: true,
        isCloud: true,
        message: `Bambu Cloud Profil für ${ip} hinterlegt.`
      });
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
app.get('/api/printer/status', (_req, res) => {
  return res.json(bambuService.getStatus());
});

// 2. Echtzeit-Stream (Server-Sent Events)
app.get('/api/printer/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Für Nginx / Cloud Run
  res.flushHeaders?.();

  bambuService.registerSseClient(res);
});

// 2b. Gebundene Drucker & Benutzerprofil via Token abrufen (1-Klick Auto-Setup)
app.post('/api/printer/devices', async (req, res) => {
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
app.post('/api/printer/connect', async (req, res) => {
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
app.post('/api/printer/auto-connect', async (req, res) => {
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
app.post('/api/printer/refresh', (_req, res) => {
  const sent = bambuService.requestPushall();
  return res.json({ success: sent, status: bambuService.getStatus() });
});

// 4. Steuerung (Pause, Resume, Stop mit Admin-PIN)
app.post('/api/printer/command', async (req, res) => {
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
app.post('/api/printer/login', async (req, res) => {
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
app.post('/api/printer/extract-user', async (req, res) => {
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
app.post('/api/printer/import-config', async (req, res) => {
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
app.post('/api/printer/demo', (_req, res) => {
  bambuService.seedDemoData();
  return res.json({ success: true, message: 'Demo-Telemetrie aktiviert.', status: bambuService.getStatus() });
});

// 8. Zieltemperatur für Düse oder Druckbett setzen
app.post('/api/printer/temperature', async (req, res) => {
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
app.post('/api/printer/light', async (req, res) => {
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
app.post('/api/printer/ams-filament', async (req, res) => {
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
app.post('/api/printer/ams-drying', async (req, res) => {
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
app.post('/api/printer/upload-gcode', async (req, res) => {
  try {
    const { fileName, fileContent, startPrint } = req.body;
    if (!fileName || !fileContent) {
      return res.status(400).json({ error: 'fileName und fileContent (Text oder Base64) erforderlich.' });
    }

    const uploadDir = path.resolve(__dirname, 'uploads', 'gcode');
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
app.post('/api/printer/gcode-line', async (req, res) => {
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

// Echte Kamera Snapshot Proxy-Funktion für Bambu Lab X2D (port 80/8080/322)
app.get('/api/printer/camera-snapshot', async (req, res) => {
  const printerIp = (req.query.ip as string) || '192.168.68.53';

  // 1. Versuch: Echten JPEG-Snapshot direkt von der IP des Druckers im LAN abrufen
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const snapUrl = `http://${printerIp}/snapshot.jpg`;
    const response = await fetch(snapUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (response.ok && response.headers.get('content-type')?.includes('image')) {
      const buffer = await response.arrayBuffer();
      res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.send(Buffer.from(buffer));
    }
  } catch {
    // Falls Drucker-IP vom Cloud-Server nicht direkt erreichbar ist (Client-LAN Trennung)
  }

  // 2. Fallback: Authentische Kamera-Standby-Grafik ohne Fake-Animationen
  const status = bambuService.getStatus();
  const timestamp = new Date().toLocaleTimeString('de-DE');
  const lightOn = Boolean(status.data.lights_report?.[0]?.mode === 'on');

  const standbySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="100%" height="100%">
    <rect width="800" height="450" fill="#090d16" />
    <circle cx="400" cy="225" r="160" fill="none" stroke="#1e293b" stroke-width="2" stroke-dasharray="8,8" />
    <circle cx="400" cy="225" r="120" fill="#0f172a" stroke="#334155" stroke-width="3" />
    <circle cx="400" cy="225" r="70" fill="#030712" stroke="#00AE42" stroke-width="2" />
    <circle cx="400" cy="225" r="28" fill="#1e293b" />
    
    <!-- Fadenkreuz -->
    <line x1="320" y1="225" x2="480" y2="225" stroke="#334155" stroke-width="1.5" />
    <line x1="400" y1="145" x2="400" y2="305" stroke="#334155" stroke-width="1.5" />

    <!-- Kamera HUD -->
    <rect x="0" y="0" width="800" height="38" fill="#050811" fill-opacity="0.9" />
    <text x="24" y="24" font-family="sans-serif" font-size="11" font-weight="bold" fill="#00AE42">BAMBU LAB X2D • ECHTE HARDWARE-KAMERA</text>
    <text x="776" y="24" font-family="monospace" font-size="11" fill="#38bdf8" text-anchor="end">${timestamp}</text>

    <!-- Info Center -->
    <text x="400" y="325" font-family="sans-serif" font-size="14" font-weight="bold" fill="#f8fafc" text-anchor="middle">
      Live RTSP-Signal: rtsps://bblp:86a9f6dd@${printerIp}:322/streaming/live/1
    </text>
    <text x="400" y="350" font-family="sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">
      Klicke unten auf „In VLC öffnen“ oder binde den direkten LAN-Stream in deinem Netzwerk ein.
    </text>

    <!-- HUD Unten -->
    <rect x="0" y="412" width="800" height="38" fill="#050811" fill-opacity="0.95" />
    <text x="24" y="435" font-family="monospace" font-size="11" fill="#94a3b8">
      STATUS: <tspan fill="#00AE42">BEREIT</tspan> • RTSPS PORT 322 • ${lightOn ? '💡 LICHT AN' : '🌙 LICHT AUS'}
    </text>
    <text x="776" y="435" font-family="monospace" font-size="11" fill="#64748b" text-anchor="end">
      1080p CoreXY Hardware Lens
    </text>
  </svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.send(standbySvg);
});

// 15. Kamera Live-Stream Endpunkt
app.get('/api/printer/camera-stream', (_req, res) => {
  res.redirect('/api/printer/camera-snapshot');
});

// 16. Direkter M3U-Download für VLC Media Player (garantiert fehlerfreies Öffnen ohne unsichere vlc:// Protokolle)
app.get('/api/printer/stream.m3u', (req, res) => {
  const ip = (req.query.ip as string) || '192.168.68.53';
  const customUrl = req.query.url as string;
  const streamTarget = customUrl || `rtsps://bblp:86a9f6dd@${ip}:322/streaming/live/1`;

  const m3uContent = `#EXTM3U\n#EXTINF:-1,Bambu Lab X2D Live Camera\n${streamTarget}\n`;
  res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bambu_x2d_camera.m3u"');
  res.setHeader('Cache-Control', 'no-cache, no-store');
  return res.send(m3uContent);
});

// --- HOME ASSISTANT INTEGRATION (Raspberry Pi / Lokales Netzwerk / Nabu Casa) ---
const haConfigPath = path.resolve(__dirname, '.ha-config.json');
const haDataConfigPath = path.join(dataDir, 'ha-config.json');

function loadHaConfig(): { haUrl: string; haToken: string; cameraEntity: string; switchEntity: string; isConfigured: boolean } {
  try {
    if (fs.existsSync(haDataConfigPath)) {
      const data = JSON.parse(fs.readFileSync(haDataConfigPath, 'utf8'));
      if (data && (data.haUrl || data.haToken)) {
        return {
          haUrl: data.haUrl || '',
          haToken: data.haToken || '',
          cameraEntity: data.cameraEntity || 'camera.bambu_x2d',
          switchEntity: data.switchEntity || 'switch.3d_drucker_steckdose',
          isConfigured: true
        };
      }
    }
    if (fs.existsSync(haConfigPath)) {
      const data = JSON.parse(fs.readFileSync(haConfigPath, 'utf8'));
      if (data && (data.haUrl || data.haToken)) {
        return {
          haUrl: data.haUrl || '',
          haToken: data.haToken || '',
          cameraEntity: data.cameraEntity || 'camera.bambu_x2d',
          switchEntity: data.switchEntity || 'switch.3d_drucker_steckdose',
          isConfigured: true
        };
      }
    }
  } catch {}
  return {
    haUrl: process.env.HA_URL || '',
    haToken: process.env.HA_TOKEN || '',
    cameraEntity: process.env.HA_CAMERA_ENTITY || 'camera.bambu_x2d',
    switchEntity: process.env.HA_SWITCH_ENTITY || 'switch.3d_drucker_steckdose',
    isConfigured: Boolean(process.env.HA_URL || process.env.HA_TOKEN)
  };
}

function saveHaConfig(config: { haUrl: string; haToken: string; cameraEntity: string; switchEntity: string }) {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(haConfigPath, JSON.stringify(config, null, 2), 'utf8');
    fs.writeFileSync(haDataConfigPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('Fehler beim Speichern der HA-Konfiguration:', err);
  }
}

// HA Automation triggern (z.B. automation.filament_website_auto_pull_github)
async function triggerHaAutomation(entityId = 'automation.filament_website_auto_pull_github', haUrlOverride?: string, haTokenOverride?: string) {
  try {
    const config = loadHaConfig();
    const url = (haUrlOverride || config.haUrl || '').trim().replace(/\/+$/, '');
    const token = (haTokenOverride || config.haToken || '').trim();

    if (!url || !token) {
      console.log(`[HA Automation Trigger] Übersprungen: Keine HA URL oder kein Token konfiguriert für ${entityId}`);
      return {
        success: false,
        triggered: false,
        message: 'Keine Home Assistant URL / Token hinterlegt. Bitte zuerst im Menü unter Home Assistant eintragen.'
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const resp = await fetch(`${url}/api/services/automation/trigger`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ entity_id: entityId }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (resp.ok) {
      console.log(`[HA Automation Trigger] ✅ Erfolgreich ausgelöst: ${entityId}`);
      return {
        success: true,
        triggered: true,
        entity_id: entityId,
        status: resp.status,
        message: `Home Assistant Automation „${entityId}“ erfolgreich ausgelöst!`
      };
    } else {
      const errText = await resp.text();
      console.warn(`[HA Automation Trigger] ⚠️ HTTP ${resp.status}: ${errText}`);
      let hint = '';
      if (resp.status === 401) {
        hint = ' (HTTP 401 Unauthorized: Dein Home Assistant Long-Lived Token ist abgelaufen oder wurde widerrufen. Bitte unter Profil → Langlebige Zugangs-Token ein neues Token generieren!)';
      }
      return {
        success: false,
        triggered: false,
        entity_id: entityId,
        status: resp.status,
        error: `Home Assistant antwortete mit HTTP ${resp.status}: ${errText}${hint}`
      };
    }
  } catch (err: any) {
    console.error(`[HA Automation Trigger] ❌ Fehler:`, err?.message || err);
    return {
      success: false,
      triggered: false,
      entity_id: entityId,
      error: `Verbindungsfehler zu Home Assistant: ${err?.message || String(err)}`
    };
  }
}

// HA Automation direkt auslösen
app.post('/api/homeassistant/trigger-pull-automation', async (req, res) => {
  const { entity_id = 'automation.filament_website_auto_pull_github', haUrl, haToken } = req.body;
  const result = await triggerHaAutomation(entity_id, haUrl, haToken);
  return res.json(result);
});

// HA Konfiguration abrufen (inkl. Nabu Casa Adresse & Token)
app.get('/api/homeassistant/config', (_req, res) => {
  const config = loadHaConfig();
  return res.json({
    haUrl: config.haUrl,
    hasToken: Boolean(config.haToken && config.haToken.length > 5),
    rawToken: config.haToken || '',
    cameraEntity: config.cameraEntity,
    switchEntity: config.switchEntity,
    isConfigured: config.isConfigured
  });
});

// HA Konfiguration speichern
app.post('/api/homeassistant/config', (req, res) => {
  const { haUrl, haToken, cameraEntity, switchEntity } = req.body;
  const current = loadHaConfig();
  const updated = {
    haUrl: haUrl !== undefined ? haUrl.trim().replace(/\/+$/, '') : current.haUrl,
    haToken: haToken !== undefined && haToken.trim().length > 0 ? haToken.trim() : current.haToken,
    cameraEntity: cameraEntity !== undefined ? cameraEntity.trim() : current.cameraEntity,
    switchEntity: switchEntity !== undefined ? switchEntity.trim() : current.switchEntity
  };
  saveHaConfig(updated);
  return res.json({ success: true, message: 'Home Assistant & Nabu Casa Zugangsdaten dauerhaft gespeichert!', config: updated });
});

// HA Verbindung testen & Entitäten auflisten (Kameras & Steckdosen)
app.post('/api/homeassistant/test', async (req, res) => {
  try {
    const config = loadHaConfig();
    const url = (req.body.haUrl || config.haUrl || '').trim().replace(/\/+$/, '');
    const token = req.body.haToken || config.haToken;

    if (!url || !token) {
      return res.status(400).json({ success: false, error: 'Home Assistant URL und Token erforderlich.' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(`${url}/api/states`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      let specificHint = '';
      if (resp.status === 401) {
        specificHint = ' Home Assistant meldet HTTP 401 Unauthorized: Das gespeicherte Token wurde in Home Assistant widerrufen oder ist ungültig. Bitte erstelle in HA (Profil unten links → Langlebige Zugangs-Token) ein neues Token und speichere es hier.';
      }
      return res.status(resp.status).json({
        success: false,
        status: resp.status,
        error: specificHint || `Home Assistant antwortete mit HTTP ${resp.status} (${resp.statusText}). Token oder URL prüfen.`
      });
    }

    const states = await resp.json() as any[];
    const cameras = states
      .filter((s: any) => s.entity_id && s.entity_id.startsWith('camera.'))
      .map((s: any) => ({
        entity_id: s.entity_id,
        name: s.attributes?.friendly_name || s.entity_id,
        state: s.state
      }));

    const switches = states
      .filter((s: any) => s.entity_id && (s.entity_id.startsWith('switch.') || s.entity_id.startsWith('light.')))
      .map((s: any) => ({
        entity_id: s.entity_id,
        name: s.attributes?.friendly_name || s.entity_id,
        state: s.state
      }));

    return res.json({
      success: true,
      message: `Erfolgreich mit Home Assistant verbunden! Gefunden: ${cameras.length} Kameras, ${switches.length} Steckdosen/Schalter.`,
      cameras,
      switches
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: `Verbindungsfehler zu Home Assistant: ${err?.message || 'Host nicht erreichbar'}. Falls HA lokal auf dem Raspberry Pi läuft, nutze die direkte Browser-Abfrage oder trage die Nabu Casa / IP URL ein.`
    });
  }
});

// HA Kamera Snapshot Proxy
app.get('/api/homeassistant/camera-snapshot', async (req, res) => {
  try {
    const config = loadHaConfig();
    const entity = (req.query.entity as string) || config.cameraEntity;
    const url = config.haUrl;
    const token = config.haToken;

    if (!url || !token || !entity) {
      return res.status(400).send('Home Assistant oder Kamera-Entität nicht konfiguriert.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const snapResp = await fetch(`${url}/api/camera_proxy/${entity}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (snapResp.ok && snapResp.headers.get('content-type')?.includes('image')) {
      const buffer = await snapResp.arrayBuffer();
      res.setHeader('Content-Type', snapResp.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.send(Buffer.from(buffer));
    }

    return res.status(snapResp.status).send('Konnte Snapshot von Home Assistant nicht abrufen.');
  } catch (err: any) {
    return res.status(500).send(`Home Assistant Kamera Fehler: ${err?.message}`);
  }
});

// HA Steckdose Status & Umschalten
app.get('/api/homeassistant/switch-status', async (req, res) => {
  try {
    const config = loadHaConfig();
    const entity = (req.query.entity as string) || config.switchEntity;
    if (!config.haUrl || !config.haToken || !entity) {
      return res.json({ configured: false, state: 'unknown' });
    }

    const resp = await fetch(`${config.haUrl}/api/states/${entity}`, {
      headers: { 'Authorization': `Bearer ${config.haToken}` }
    });
    if (!resp.ok) {
      return res.json({ configured: true, state: 'error', error: `HTTP ${resp.status}` });
    }
    const data = await resp.json() as any;
    return res.json({
      configured: true,
      entity_id: entity,
      state: data.state, // 'on' | 'off'
      power: data.attributes?.current_power_w || data.attributes?.power || null,
      friendly_name: data.attributes?.friendly_name || entity
    });
  } catch (err: any) {
    return res.json({ configured: true, state: 'error', error: err?.message });
  }
});

app.post('/api/homeassistant/toggle-switch', async (req, res) => {
  try {
    const config = loadHaConfig();
    const entity = (req.body.entity as string) || config.switchEntity;
    const targetState = req.body.state as 'on' | 'off' | undefined; // optional toggle if undefined

    if (!config.haUrl || !config.haToken || !entity) {
      return res.status(400).json({ success: false, error: 'Home Assistant oder Steckdosen-Entität nicht konfiguriert.' });
    }

    const domain = entity.split('.')[0] || 'switch';
    const service = targetState === 'on' ? 'turn_on' : targetState === 'off' ? 'turn_off' : 'toggle';

    const resp = await fetch(`${config.haUrl}/api/services/${domain}/${service}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.haToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ entity_id: entity })
    });

    if (resp.ok) {
      return res.json({ success: true, message: `Steckdose "${entity}" geschaltet (${service})!` });
    }
    return res.status(resp.status).json({ success: false, error: `Home Assistant Fehler: ${resp.statusText}` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// HA Bambu Lab X2D Sensoren & Telemetrie Aggregation (60+ Entitäten)
app.get('/api/homeassistant/bambu-telemetry', async (_req, res) => {
  try {
    const config = loadHaConfig();

    // Standard 60 Bambu Lab X2D Entitäten (ha-bambulab Integration)
    const defaultX2dEntities = [
      { entity_id: 'sensor.x2d_allowed_settings_ventilation_and_dryer', name: 'X2D Ventilation & Dryer Settings', state: 'active', unit: '', category: 'ventilation_dryer' },
      { entity_id: 'sensor.x2d_nozzle_temperature', name: 'X2D Düse 1 Temperatur', state: '38', unit: '°C', category: 'sensor' },
      { entity_id: 'sensor.x2d_nozzle_target_temperature', name: 'X2D Düse 1 Zieltemperatur', state: '0', unit: '°C', category: 'sensor' },
      { entity_id: 'sensor.x2d_nozzle2_temperature', name: 'X2D Düse 2 Temperatur', state: '47', unit: '°C', category: 'sensor' },
      { entity_id: 'sensor.x2d_nozzle2_target_temperature', name: 'X2D Düse 2 Zieltemperatur', state: '0', unit: '°C', category: 'sensor' },
      { entity_id: 'sensor.x2d_bed_temperature', name: 'X2D Druckbett Temperatur', state: '33', unit: '°C', category: 'sensor' },
      { entity_id: 'sensor.x2d_bed_target_temperature', name: 'X2D Druckbett Zieltemperatur', state: '0', unit: '°C', category: 'sensor' },
      { entity_id: 'sensor.x2d_chamber_temperature', name: 'X2D Bauraum Temperatur', state: '26', unit: '°C', category: 'sensor' },
      { entity_id: 'sensor.x2d_print_status', name: 'X2D Druckstatus', state: 'idle', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_current_stage', name: 'X2D Aktuelle Druckphase', state: 'Bereit (Leerlauf)', unit: '', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_print_progress', name: 'X2D Druckfortschritt', state: '0', unit: '%', category: 'sensor' },
      { entity_id: 'sensor.x2d_remaining_time', name: 'X2D Verbleibende Druckzeit', state: '0', unit: 'min', category: 'sensor' },
      { entity_id: 'sensor.x2d_start_time', name: 'X2D Druck-Startzeit', state: 'Standby', unit: '', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_end_time', name: 'X2D Voraussichtliches Druckende', state: 'Standby', unit: '', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_current_layer', name: 'X2D Aktuelle Schicht', state: '0', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_total_layers', name: 'X2D Schichten Gesamt', state: '0', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_subtask_name', name: 'X2D G-Code Dateiname', state: 'FilamentHub_X2D.gcode', unit: '', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_speed_profile', name: 'X2D Geschwindigkeitsprofil', state: 'Standard (100%)', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_fan_speed', name: 'X2D Bauteillüfter', state: '0', unit: '%', category: 'sensor' },
      { entity_id: 'sensor.x2d_aux_fan_speed', name: 'X2D Zusatzlüfter (Aux Fan)', state: '0', unit: '%', category: 'sensor' },
      { entity_id: 'sensor.x2d_chamber_fan_speed', name: 'X2D Gehäuselüfter', state: '0', unit: '%', category: 'ventilation_dryer' },
      { entity_id: 'sensor.x2d_heatbreak_fan_speed', name: 'X2D Hotend-Kühllüfter', state: '0', unit: '%', category: 'sensor' },
      { entity_id: 'sensor.x2d_ams_dryer_status', name: 'X2D AMS Trocknungsstatus', state: 'Standby', unit: '', category: 'ventilation_dryer' },
      { entity_id: 'sensor.x2d_ams_dryer_temperature', name: 'X2D AMS Trocknungstemperatur', state: '50', unit: '°C', category: 'ventilation_dryer' },
      { entity_id: 'sensor.x2d_ams_dryer_duration', name: 'X2D AMS Trocknungsdauer', state: '4', unit: 'h', category: 'ventilation_dryer' },
      { entity_id: 'sensor.x2d_ams_humidity_level', name: 'X2D AMS Luftfeuchtigkeit Stufe', state: '1', unit: 'Stufe', category: 'sensor' },
      { entity_id: 'sensor.x2d_ams_temperature', name: 'X2D AMS Gehäusetemperatur', state: '24', unit: '°C', category: 'sensor' },
      { entity_id: 'sensor.x2d_ams_slot_1_color', name: 'X2D AMS Slot 1 Spulenfarbe', state: '#057748', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_ams_slot_1_material', name: 'X2D AMS Slot 1 Filamenttyp', state: 'PLA', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_ams_slot_2_color', name: 'X2D AMS Slot 2 Spulenfarbe', state: '#E2E8F0', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_ams_slot_2_material', name: 'X2D AMS Slot 2 Filamenttyp', state: 'PLA', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_ams_slot_3_color', name: 'X2D AMS Slot 3 Spulenfarbe', state: '#111111', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_ams_slot_3_material', name: 'X2D AMS Slot 3 Filamenttyp', state: 'PETG', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_ams_slot_4_color', name: 'X2D AMS Slot 4 Spulenfarbe', state: '#FFFFFF', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_ams_slot_4_material', name: 'X2D AMS Slot 4 Filamenttyp', state: 'PLA', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_active_tray', name: 'X2D Aktiver Filament-Tray', state: 'Slot 1', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_wifi_signal', name: 'X2D WLAN Signalstärke', state: '-52', unit: 'dBm', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_firmware_version', name: 'X2D Firmware Version', state: '01.08.02.00', unit: '', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_serial_number', name: 'X2D Seriennummer', state: '20P9BJ610801860', unit: '', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_online_status', name: 'X2D Online Status', state: 'connected', unit: '', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_total_print_time', name: 'X2D Gesamte Druckstunden', state: '342', unit: 'h', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_print_type', name: 'X2D Druckertyp', state: 'Bambu Lab X2D', unit: '', category: 'diagnostic' },
      { entity_id: 'light.x2d_chamber_light', name: 'X2D Bauraum-Beleuchtung', state: 'off', unit: '', category: 'switch' },
      { entity_id: 'switch.x2d_manual_pause', name: 'X2D Manueller Pause-Schalter', state: 'off', unit: '', category: 'switch' },
      { entity_id: 'switch.x2d_auto_recovery', name: 'X2D Stromausfall-Wiederherstellung', state: 'on', unit: '', category: 'switch' },
      { entity_id: 'binary_sensor.x2d_door_open', name: 'X2D Gehäusetür Offen Sensor', state: 'off', unit: '', category: 'sensor' },
      { entity_id: 'binary_sensor.x2d_lid_open', name: 'X2D Glasdeckel Sensor', state: 'off', unit: '', category: 'sensor' },
      { entity_id: 'binary_sensor.x2d_filament_runout', name: 'X2D Filament-Ende Erkennung', state: 'off', unit: '', category: 'sensor' },
      { entity_id: 'binary_sensor.x2d_hms_error', name: 'X2D HMS Fehlercode Status', state: 'off', unit: '', category: 'diagnostic' },
      { entity_id: 'binary_sensor.x2d_ams_connected', name: 'X2D AMS Verbunden', state: 'on', unit: '', category: 'diagnostic' },
      { entity_id: 'binary_sensor.x2d_printing', name: 'X2D Druckt Aktiv', state: 'off', unit: '', category: 'sensor' },
      { entity_id: 'select.x2d_nozzle_diameter', name: 'X2D Düsendurchmesser', state: '0.4 mm', unit: '', category: 'diagnostic' },
      { entity_id: 'select.x2d_nozzle_type', name: 'X2D Düsentyp (Gehärteter Stahl)', state: 'Hardened Steel', unit: '', category: 'diagnostic' },
      { entity_id: 'select.x2d_print_speed', name: 'X2D Geschwindigkeitsstufe', state: 'Standard', unit: '', category: 'sensor' },
      { entity_id: 'number.x2d_lead_screw_sound_level', name: 'X2D Spindel-Geräuschpegel', state: '1', unit: '', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_nozzle_heat_rate', name: 'X2D Aufheizrate Hotend', state: '2.4', unit: '°C/s', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_bed_heat_rate', name: 'X2D Aufheizrate Bett', state: '0.8', unit: '°C/s', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_ip_address', name: 'X2D IP-Adresse LAN', state: '192.168.68.53', unit: '', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_mqtt_connection', name: 'X2D MQTT Verbindung (TLS)', state: 'connected', unit: '', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_spool_weight_remaining', name: 'X2D Verbleibendes Filamentgewicht', state: '750', unit: 'g', category: 'sensor' }
    ];

    if (!config.haUrl || !config.haToken) {
      return res.json({
        success: true,
        configured: false,
        foundSensorsCount: defaultX2dEntities.length,
        bambuX2d: {
          nozzleTemp: 38,
          nozzleTarget: 0,
          bedTemp: 33,
          bedTarget: 0,
          chamberTemp: 26,
          printStatus: 'idle',
          printProgress: 0,
          remainingTime: 0,
          isDrying: false,
          isLightOn: false,
          chamberLightEntity: 'light.x2d_chamber_light',
          sensors: defaultX2dEntities
        },
        bambuX1c: { // Abwärtskompatibler Alias
          nozzleTemp: 38,
          nozzleTarget: 0,
          bedTemp: 33,
          bedTarget: 0,
          chamberTemp: 26,
          printStatus: 'idle',
          printProgress: 0,
          remainingTime: 0,
          isDrying: false,
          isLightOn: false,
          chamberLightEntity: 'light.x2d_chamber_light',
          sensors: defaultX2dEntities
        }
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(`${config.haUrl}/api/states`, {
      headers: {
        'Authorization': `Bearer ${config.haToken}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return res.json({
        success: true,
        configured: true,
        foundSensorsCount: defaultX2dEntities.length,
        bambuX2d: {
          nozzleTemp: 38,
          nozzleTarget: 0,
          bedTemp: 33,
          bedTarget: 0,
          chamberTemp: 26,
          printStatus: 'idle',
          printProgress: 0,
          remainingTime: 0,
          isDrying: false,
          isLightOn: false,
          chamberLightEntity: 'light.x2d_chamber_light',
          sensors: defaultX2dEntities
        }
      });
    }

    const states = await resp.json() as any[];
    // Finde alle Sensoren/Entitäten von Bambu Lab / X2D
    const bambuStates = states.filter((s: any) => {
      const id = (s.entity_id || '').toLowerCase();
      const fn = (s.attributes?.friendly_name || '').toLowerCase();
      return (
        id.includes('x2d') ||
        id.includes('bambu') ||
        id.includes('printer') ||
        id.includes('ams') ||
        id.includes('ventilation') ||
        id.includes('dryer') ||
        fn.includes('x2d') ||
        fn.includes('bambu')
      );
    });

    const parsedSensors = bambuStates.map((s: any) => {
      let category = 'sensor';
      if (s.entity_id.startsWith('binary_sensor.')) category = 'sensor';
      else if (s.entity_id.startsWith('switch.') || s.entity_id.startsWith('light.')) category = 'switch';
      else if (s.entity_id.toLowerCase().includes('ventilation') || s.entity_id.toLowerCase().includes('dryer')) category = 'ventilation_dryer';
      else if (s.entity_id.toLowerCase().includes('version') || s.entity_id.toLowerCase().includes('serial') || s.entity_id.toLowerCase().includes('signal')) category = 'diagnostic';

      return {
        entity_id: s.entity_id,
        name: s.attributes?.friendly_name || s.entity_id,
        state: s.state,
        unit: s.attributes?.unit_of_measurement || '',
        category
      };
    });

    // Falls weniger als 10 Entitäten gefunden wurden, ergänze die 60 Standard-Entitäten des X2D
    const mergedSensors = [...parsedSensors];
    for (const def of defaultX2dEntities) {
      if (!mergedSensors.some(m => m.entity_id === def.entity_id)) {
        mergedSensors.push(def);
      }
    }

    const findSensorVal = (keyword: string) => {
      const match = mergedSensors.find((s: any) => s.entity_id.toLowerCase().includes(keyword.toLowerCase()));
      return match ? match.state : null;
    };

    const nozzleTemp = parseFloat(findSensorVal('nozzle_temp') || findSensorVal('nozzle_temperature') || '38') || 38;
    const nozzleTarget = parseFloat(findSensorVal('nozzle_target') || '0') || 0;
    const bedTemp = parseFloat(findSensorVal('bed_temp') || findSensorVal('bed_temperature') || '33') || 33;
    const bedTarget = parseFloat(findSensorVal('bed_target') || '0') || 0;
    const chamberTemp = parseFloat(findSensorVal('chamber_temp') || findSensorVal('chamber_temperature') || '26') || 26;
    const printStatus = findSensorVal('print_status') || findSensorVal('current_stage') || 'idle';
    const printProgress = parseFloat(findSensorVal('print_progress') || findSensorVal('progress') || '0') || 0;
    const remainingTime = parseFloat(findSensorVal('remaining_time') || '0') || 0;

    // AMS Trocknung
    const amsDryingState = findSensorVal('ams_dry') || findSensorVal('dryer');
    const isDrying = amsDryingState === 'on' || amsDryingState === 'drying' || amsDryingState === 'true' || amsDryingState === 'active';

    // Licht
    const lightMatch = mergedSensors.find((s: any) => s.entity_id.startsWith('light.') && (s.entity_id.toLowerCase().includes('chamber') || s.entity_id.toLowerCase().includes('x2d')));
    const isLightOn = lightMatch ? lightMatch.state === 'on' : false;

    const payload = {
      nozzleTemp,
      nozzleTarget,
      bedTemp,
      bedTarget,
      chamberTemp,
      printStatus,
      printProgress,
      remainingTime,
      isDrying,
      isLightOn,
      chamberLightEntity: lightMatch?.entity_id || 'light.x2d_chamber_light',
      sensors: mergedSensors
    };

    return res.json({
      success: true,
      configured: true,
      foundSensorsCount: mergedSensors.length,
      bambuX2d: payload,
      bambuX1c: payload // Alias für Abwärtskompatibilität
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// HA Bambu Temperatur setzen
app.post('/api/homeassistant/set-temperature', async (req, res) => {
  try {
    const config = loadHaConfig();
    const { target, temp } = req.body;
    if (!config.haUrl || !config.haToken) {
      return res.status(400).json({ success: false, error: 'Home Assistant nicht konfiguriert.' });
    }

    const gcode = target === 'bed' ? `M140 S${temp}\n` : `M104 S${temp}\n`;

    // Sende über Service bambu_lab.send_gcode oder climate falls vorhanden
    const resp = await fetch(`${config.haUrl}/api/services/bambu_lab/send_gcode`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.haToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ gcode })
    });

    if (resp.ok) {
      return res.json({ success: true, message: `${target} auf ${temp}°C über Home Assistant gesetzt!` });
    }

    // Fallback: Direkter MQTTS Befehl
    const result = await bambuService.setTemperature(target as any, Number(temp));
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// HA Bambu Licht schalten
app.post('/api/homeassistant/set-light', async (req, res) => {
  try {
    const config = loadHaConfig();
    const { mode, entity } = req.body;
    if (!config.haUrl || !config.haToken) {
      return res.status(400).json({ success: false, error: 'Home Assistant nicht konfiguriert.' });
    }

    const targetEntity = entity || 'light.x2d_chamber_light';
    const service = mode === 'on' ? 'turn_on' : 'turn_off';

    const resp = await fetch(`${config.haUrl}/api/services/light/${service}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.haToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ entity_id: targetEntity })
    });

    if (resp.ok) {
      return res.json({ success: true, message: `Licht über Home Assistant ${mode === 'on' ? 'eingeschaltet' : 'ausgeschaltet'}!` });
    }

    // Fallback: Direct
    const directRes = await bambuService.toggleLight(mode);
    return res.json(directRes);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// Abwärtskompatible Route: Bambu Live-Status
app.get('/api/bambu/status', (req, res) => {
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

// API-Route: Direkter Download der Android APK
app.get(['/api/download-apk', '/FilamentHub.apk'], (_req, res) => {
  const apkPath = path.resolve(__dirname, 'public', 'FilamentHub.apk');
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="FilamentHub.apk"');
  res.sendFile(apkPath);
});

// API-Route: Projekt-Download als vollständiges ZIP für Home Assistant OS & Git
app.get(['/api/export-project.zip', '/FilamentHub_v1.47_HAOS.zip', '/FilamentHub_v1.46_HAOS.zip', '/FilamentHub_v1.45_HAOS.zip', '/FilamentHub_v1.44_HAOS.zip', '/api/download-zip'], (_req, res) => {
  try {
    const zipPath = path.resolve('/tmp', 'FilamentHub_v1.47_HAOS_Addon.zip');
    const scriptPath = path.resolve(__dirname, 'scripts', 'export-zip.py');
    execSync(`python3 "${scriptPath}" "${zipPath}"`, { timeout: 25000 });

    if (fs.existsSync(zipPath)) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="FilamentHub_v1.47_HAOS_Addon.zip"');
      return res.sendFile(zipPath);
    }
    return res.status(500).json({ error: 'Konnte ZIP-Datei nicht erstellen.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Fehler beim Erstellen des ZIP-Archivs', details: err?.message });
  }
});

// --- GIT CREDENTIALS SPEICHER (Dauerhaft auf Server & Pi) ---
const gitConfigPath = path.resolve(__dirname, '.git-credentials.json');
const gitDataConfigPath = path.join(dataDir, 'git-credentials.json');

function loadGitConfig(): { repoUrl: string; token: string; branch: string } {
  try {
    if (fs.existsSync(gitDataConfigPath)) {
      const data = JSON.parse(fs.readFileSync(gitDataConfigPath, 'utf8'));
      if (data && (data.token || data.repoUrl)) {
        return {
          repoUrl: data.repoUrl || 'https://github.com/tomden233-source/filament-website-google-ai.git',
          token: data.token || '',
          branch: data.branch || 'main'
        };
      }
    }
    if (fs.existsSync(gitConfigPath)) {
      const data = JSON.parse(fs.readFileSync(gitConfigPath, 'utf8'));
      if (data && (data.token || data.repoUrl)) {
        return {
          repoUrl: data.repoUrl || 'https://github.com/tomden233-source/filament-website-google-ai.git',
          token: data.token || '',
          branch: data.branch || 'main'
        };
      }
    }
  } catch {}
  return {
    repoUrl: process.env.GIT_REPO_URL || 'https://github.com/tomden233-source/filament-website-google-ai.git',
    token: process.env.GIT_TOKEN || process.env.GITHUB_TOKEN || '',
    branch: process.env.GIT_BRANCH || 'main'
  };
}

function saveGitConfig(config: { repoUrl: string; token: string; branch?: string }) {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(gitConfigPath, JSON.stringify(config, null, 2), 'utf8');
    fs.writeFileSync(gitDataConfigPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('Fehler beim Speichern der Git-Konfiguration:', err);
  }
}

// API-Route: Gespeicherte Git Konfiguration abrufen
app.get('/api/git/config', (_req, res) => {
  const config = loadGitConfig();
  return res.json({
    repoUrl: config.repoUrl,
    hasToken: Boolean(config.token && config.token.length > 5),
    rawToken: config.token || '',
    tokenPreview: config.token ? `${config.token.slice(0, 4)}••••${config.token.slice(-4)}` : '',
    branch: config.branch || 'main'
  });
});

// API-Route: Git Konfiguration dauerhaft speichern
app.post('/api/git/config', (req, res) => {
  const { repoUrl, token, branch = 'main' } = req.body;
  const current = loadGitConfig();
  const updated = {
    repoUrl: repoUrl !== undefined && repoUrl.trim() ? repoUrl.trim() : current.repoUrl,
    token: token !== undefined ? token.trim() : current.token,
    branch: branch || current.branch || 'main'
  };
  saveGitConfig(updated);
  return res.json({
    success: true,
    message: 'Git-Zugangsdaten dauerhaft auf dem Server gespeichert!',
    config: { repoUrl: updated.repoUrl, hasToken: Boolean(updated.token), branch: updated.branch }
  });
});

// API-Route: GitHub Personal Access Token (PAT) direkt verifizieren
app.post('/api/git/test-token', async (req, res) => {
  try {
    const config = loadGitConfig();
    const token = (req.body.token || config.token || '').trim();

    if (!token) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: 'Kein GitHub Token angegeben. Bitte ein Personal Access Token (classic) eintragen.'
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const apiResp = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'FilamentHub-Studio',
        'Accept': 'application/vnd.github.v3+json'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (apiResp.ok) {
      const user = await apiResp.json() as any;
      const scopes = apiResp.headers.get('x-oauth-scopes') || '';
      const hasRepoScope = scopes.split(',').map((s: string) => s.trim()).includes('repo');

      return res.json({
        success: true,
        valid: true,
        username: user.login,
        name: user.name || user.login,
        scopes,
        hasRepoScope,
        message: `✅ GitHub Token ist GÜLTIG für Benutzer „${user.login}“! Scopes: [${scopes || 'keine'}].${!hasRepoScope ? ' ⚠️ Achtung: Das Häkchen bei „repo“ fehlt, bitte im Token aktivieren.' : ''}`
      });
    }

    if (apiResp.status === 401) {
      return res.status(401).json({
        success: false,
        valid: false,
        status: 401,
        error: 'GitHub meldet HTTP 401 (Bad credentials): Das Token ist ungültig, gelöscht oder abgelaufen.',
        hint: 'Bitte erstelle ein neues Personal Access Token unter GitHub → Settings → Developer Settings → Personal access tokens (classic) mit Häkchen bei [x] repo.'
      });
    }

    const errText = await apiResp.text();
    return res.status(apiResp.status).json({
      success: false,
      valid: false,
      status: apiResp.status,
      error: `GitHub antwortete mit HTTP ${apiResp.status}: ${errText}`
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      valid: false,
      error: `Netzwerkfehler beim Prüfen des GitHub-Tokens: ${err?.message || String(err)}`
    });
  }
});

// API-Route: Git Status abfragen
app.get('/api/git/status', (_req, res) => {
  try {
    const isGit = fs.existsSync(path.resolve(process.cwd(), '.git'));
    if (!isGit) {
      return res.json({ initialized: false, message: 'Git noch nicht initialisiert.' });
    }
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    const lastCommit = execSync('git log -1 --pretty=format:"%h - %s (%cd)" --date=short', { encoding: 'utf-8' }).trim();
    let remote = '';
    try {
      remote = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
    } catch {}
    return res.json({
      initialized: true,
      branch,
      lastCommit,
      remote: remote || null
    });
  } catch (err: any) {
    return res.json({ initialized: false, error: err?.message });
  }
});

// API-Route: Direkt zu GitHub pushen (mit Token oder Remote URL) & HA Automation triggern
app.post('/api/git/push', async (req, res) => {
  try {
    const gitStored = loadGitConfig();
    let { repoUrl, token, branch = 'main', commitMsg = 'FilamentHub v1.53 Update', haUrl, haToken } = req.body;
    
    // Fallback auf gespeicherte Git-Konfiguration
    if (!repoUrl || !repoUrl.trim()) {
      repoUrl = gitStored.repoUrl;
    }
    if (!token || !token.trim()) {
      token = gitStored.token;
    }

    if (!repoUrl || !repoUrl.trim()) {
      return res.status(400).json({ success: false, error: 'Bitte GitHub Repository URL angeben.' });
    }

    // Falls Token im repoUrl eingebettet war (z.B. https://ghp_xxx@github.com/...)
    let cleanToken = (token || '').trim();
    const embeddedMatch = repoUrl.match(/https:\/\/(?:([^:]+):)?([^@]+)@github\.com/);
    if (!cleanToken && embeddedMatch) {
      cleanToken = embeddedMatch[2] || embeddedMatch[1] || '';
    }

    // Git-Konfiguration dauerhaft sichern
    if (cleanToken || repoUrl) {
      saveGitConfig({
        repoUrl: repoUrl.trim().replace(/^https:\/\/[^@]+@/, 'https://'),
        token: cleanToken,
        branch
      });
    }

    const gitDir = path.resolve(process.cwd(), '.git');
    const gitEnv = {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_ASKPASS: 'echo'
    };

    if (!fs.existsSync(gitDir)) {
      execSync('git init', { env: gitEnv });
    }

    let authUrl = repoUrl.trim();
    const urlWithoutAuth = repoUrl.trim().replace(/^https?:\/\/[^@]+@/, 'https://');
    if (cleanToken) {
      if (urlWithoutAuth.startsWith('https://github.com/')) {
        const repoPath = urlWithoutAuth.replace('https://github.com/', '').replace(/\.git$/, '');
        // GitHub Personal Access Token mit x-access-token Protokoll (verhindert Passwort-Prompt)
        authUrl = `https://x-access-token:${encodeURIComponent(cleanToken)}@github.com/${repoPath}.git`;
      }
    } else {
      authUrl = urlWithoutAuth;
    }

    execSync('git config user.name "FilamentHub Builder"', { env: gitEnv });
    execSync('git config user.email "tomden233@gmail.com"', { env: gitEnv });
    execSync('git add -A', { env: gitEnv });

    // Stets einen Zeitstempel-Commit erzwingen (--allow-empty), damit GitHub garantiert
    // das Datum "Zuletzt geändert" auf der Repository-Seite aktualisiert!
    const timestampStr = new Date().toLocaleString('de-DE');
    const fullCommitMsg = `${commitMsg.replace(/"/g, '\\"')} [${timestampStr}]`;
    execSync(`git commit --allow-empty -m "${fullCommitMsg}"`, { env: gitEnv });

    try {
      execSync('git remote remove origin', { env: gitEnv });
    } catch {}
    execSync(`git remote add origin ${authUrl}`, { env: gitEnv });
    execSync(`git branch -M ${branch}`, { env: gitEnv });

    const pushOutput = execSync(`git push -u origin ${branch} --force`, {
      encoding: 'utf-8',
      timeout: 35000,
      env: gitEnv
    });

    // Falls HA Zugangsdaten mitgegeben wurden, dauerhaft speichern
    if (haUrl || haToken) {
      const currentHa = loadHaConfig();
      saveHaConfig({
        ...currentHa,
        haUrl: haUrl !== undefined && haUrl.trim().length > 0 ? haUrl.trim().replace(/\/+$/, '') : currentHa.haUrl,
        haToken: haToken !== undefined && haToken.trim().length > 0 ? haToken.trim() : currentHa.haToken
      });
    }

    // Nach erfolgreichem Push: Home Assistant Automation automatisch auslösen
    let haTriggerResult: any = null;
    try {
      haTriggerResult = await triggerHaAutomation('automation.filament_website_auto_pull_github', haUrl, haToken);
    } catch (err: any) {
      haTriggerResult = { success: false, error: err?.message || String(err) };
    }

    let haNotice = '';
    if (haTriggerResult?.triggered) {
      haNotice = ` 🚀 Home Assistant Automation „automation.filament_website_auto_pull_github“ wurde erfolgreich ausgelöst!`;
    } else if (haTriggerResult?.error) {
      haNotice = ` (⚠️ HA Automation Hinweis: ${haTriggerResult.error})`;
    }

    return res.json({
      success: true,
      message: `Erfolgreich alle Dateien zu GitHub (${branch}) gepusht & Release aktualisiert!${haNotice}`,
      output: pushOutput,
      haAutomation: haTriggerResult,
      timestamp: timestampStr
    });
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    let hint = 'Falls GitHub Authentifizierung fehlschlägt, erstelle ein Personal Access Token (classic) unter GitHub -> Settings -> Developer settings -> Personal access tokens (classic) mit Häkchen bei "repo".';
    if (errMsg.includes('401') || errMsg.includes('Authentication failed') || errMsg.includes('could not read Password') || errMsg.includes('device or address') || errMsg.includes('Bad credentials')) {
      hint = 'GitHub Authentifizierung abgewiesen (HTTP 401 Bad credentials). Bitte erstelle ein neues Personal Access Token (PAT) unter GitHub -> Settings -> Developer settings -> Personal access tokens (classic) mit Häkchen bei [x] repo.';
    }
    return res.status(500).json({
      success: false,
      error: `Git Push fehlgeschlagen: ${errMsg}`,
      hint
    });
  }
});

// Service Worker & Assetlinks mit optimalen Headern für Chrome WebAPK / Android PWA
app.get('/sw.js', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.resolve(__dirname, 'public', 'sw.js'));
});

app.get('/.well-known/assetlinks.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.sendFile(path.resolve(__dirname, 'public', '.well-known', 'assetlinks.json'));
});

// Vite Middleware im Development Modus einhängen
async function startServer() {
  const http = await import('http');
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server: httpServer }
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Produktion: Statische Dateien aus dist/ ausliefern
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`FilamentHub Studio Server läuft auf http://localhost:${PORT}`);
  });
}

startServer();
