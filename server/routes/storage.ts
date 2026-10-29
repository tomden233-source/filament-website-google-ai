import { Router } from 'express';
import path from 'path';
import fs from 'fs';
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
    const r = await fetch(url, {
      method: m,
      headers: m === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body: m === 'POST' ? String(body ?? '') : undefined,
      signal: AbortSignal.timeout(20000)
    });
    const text = await r.text();
    res.status(r.status).type('application/json').send(text);
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
