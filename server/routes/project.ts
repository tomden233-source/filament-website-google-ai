import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { rootDir } from '../paths.js';

const router = Router();

// API-Route: Direkter Download der Android APK
router.get(['/api/download-apk', '/FilamentHub.apk'], (_req, res) => {
  const apkPath = path.resolve(rootDir, 'public', 'FilamentHub.apk');
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="FilamentHub.apk"');
  res.sendFile(apkPath);
});

// API-Route: Projekt-Download als vollständiges ZIP für Home Assistant OS & Git
router.get(['/api/export-project.zip', '/api/download-zip'], (_req, res) => {
  try {
    const zipPath = path.resolve('/tmp', 'FilamentHub_HAOS_Addon.zip');
    const scriptPath = path.resolve(rootDir, 'scripts', 'export-zip.py');
    execSync(`python3 "${scriptPath}" "${zipPath}"`, { timeout: 25000 });

    if (fs.existsSync(zipPath)) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="FilamentHub_HAOS_Addon.zip"');
      return res.sendFile(zipPath);
    }
    return res.status(500).json({ error: 'Konnte ZIP-Datei nicht erstellen.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Fehler beim Erstellen des ZIP-Archivs', details: err?.message });
  }
});

export default router;
