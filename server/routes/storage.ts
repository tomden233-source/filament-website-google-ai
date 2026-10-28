import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { dataDir } from '../paths.js';

const router = Router();

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
