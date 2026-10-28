// Gemeinsame Pfade des Servers
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

/** Projektordner (eine Ebene über server/) */
export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Persistentes Speicherverzeichnis auf dem Server / Raspberry Pi */
export const dataDir = path.resolve(rootDir, 'data');
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch {}
}
