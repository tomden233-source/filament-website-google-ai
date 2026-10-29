import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { dataDir } from '../paths.js';

const router = Router();

// Cloud-Datenbank (npoint) über den Server erreichen, damit die Windows-App nicht an CORS scheitert.
// Nur Adressen von api.npoint.io sind erlaubt (kein offener Proxy).
router.post('/api/cloud-proxy', async (req, res) => {
  try {
    const { url, method, body } = req.body || {};
    if (typeof url !== 'string' || !/^https:\/\/api\.npoint\.io\/[A-Za-z0-9_-]+$/.test(url)) {
      return res.status(400).json({ error: 'Nur api.npoint.io erlaubt.' });
    }
    const m = method === 'POST' ? 'POST' : 'GET';
    const payload = m === 'POST' ? String(body ?? '') : undefined;
    let out: { status: number; text: string };
    try {
      const r = await fetch(url, {
        method: m,
        headers: m === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body: payload,
        signal: AbortSignal.timeout(20000)
      });
      out = { status: r.status, text: await r.text() };
    } catch (first: any) {
      // Zweiter Versuch über https mit IPv4 (manche Windows-Netze/Router haben kaputtes IPv6 oder Proxy-Eigenheiten)
      out = await new Promise((resolve, reject) => {
        const u = new URL(url);
        const rq = https.request(
          { host: u.hostname, path: u.pathname, method: m, family: 4, timeout: 20000, headers: m === 'POST' ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload || '') } : {} },
          resp => {
            const chunks: Buffer[] = [];
            resp.on('data', c => chunks.push(c));
            resp.on('end', () => resolve({ status: resp.statusCode || 502, text: Buffer.concat(chunks).toString('utf8') }));
          }
        );
        rq.on('timeout', () => rq.destroy(new Error('Zeitüberschreitung')));
        rq.on('error', err => reject(new Error(`${first?.cause?.code || first?.message || first}; IPv4: ${(err as any)?.code || err.message}`)));
        if (payload) rq.write(payload);
        rq.end();
      });
    }
    if (out.status >= 500 && !req.body?._retried) {
      // npoint liefert gelegentlich kurz 5xx: einmal nach 1,5 s wiederholen
      await new Promise(r => setTimeout(r, 1500));
      try {
        const r2 = await fetch(url, {
          method: m,
          headers: m === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
          body: payload,
          signal: AbortSignal.timeout(20000)
        });
        out = { status: r2.status, text: await r2.text() };
      } catch {
        /* erster Fehler bleibt */
      }
    }
    return res.status(out.status).type('application/json').send(out.text);
  } catch (e: any) {
    res.status(502).json({ error: `Cloud nicht erreichbar: ${e?.message || e}` });
  }
});

// Dauerhafter Speicher für verdrucktes Filament & Zähler
const statsFilePath = path.join(dataDir, 'filamenthub-storage.json');

// API-Route: Dauerhafter Speicher für verdrucktes Filament & Zähler
router.get('/api/storage/stats', (_req, res) => {
  try {
    if (fs.existsSync(statsFilePath)) {
      const data = JSON.parse(fs.readFileSync(statsFilePath, 'utf-8'));
      return res.json({ success: true, stats: data });
    }
    return res.json({ success: true, stats: { manualUsedGrams: 0, totalPrintedHours: 342, totalDriedGrams: 8450 } });
  } catch {
    return res.json({ success: true, stats: { manualUsedGrams: 0 } });
  }
});

router.post('/api/storage/stats', (req, res) => {
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

export default router;
