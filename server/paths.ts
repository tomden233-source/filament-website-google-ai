// Gemeinsame Pfade des Servers
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

/** Projektordner (eine Ebene über server/) */
export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Persistentes Speicherverzeichnis auf dem (lokalen) Server */
export const dataDir = process.env.FILAMENT_DATA_DIR ? path.resolve(process.env.FILAMENT_DATA_DIR) : path.resolve(rootDir, 'data');
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch {}
}
