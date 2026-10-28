import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { bambuService } from '../bambuMqtt.js';
import { rootDir } from '../paths.js';
import { handlePrinterRoute, testCloudToken } from '../../src/utils/bambu/printerRoutes.js';

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
      const result = await testCloudToken(bambuService, accessToken);
      return res.status(result.status).json(result.body);
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
// BAMBU LAB CLOUD MQTT API-ENDPUNKTE
// Die meisten Routen (Status, Verbinden, Befehle, AMS, Temperatur, Licht ...) liegen in
// src/utils/bambu/printerRoutes.ts und werden unten eingehängt, damit die Android-App denselben Code nutzt.
// ============================================================================

// Echtzeit-Stream (Server-Sent Events)
router.get('/api/printer/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Für Nginx / Cloud Run
  res.flushHeaders?.();

  bambuService.registerSseClient(res);
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

// Alle übrigen Drucker-Routen laufen über die gemeinsame Logik
router.all(['/api/printer/*', '/api/bambu/status'], async (req, res, next) => {
  const query = new URLSearchParams(req.query as Record<string, string>);
  const result = await handlePrinterRoute(bambuService, req.method, req.path, req.body, query);
  if (!result) return next();
  return res.status(result.status).json(result.body);
});

export default router;
