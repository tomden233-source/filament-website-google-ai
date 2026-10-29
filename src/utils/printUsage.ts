// Gemeinsame Hilfen für den Druck-Verbrauch (manuelles Fenster und Auto-Abzug): gemerkte Aufträge und Spulen-Zuordnung.
import type { Spool } from '../types/filament';
import { safeStorage } from './safeStorage';

export const DONE_KEY = 'bambu_tasks_deducted';
export const AUTO_KEY = 'bambu_auto_deduct';
export const AUTO_SINCE_KEY = 'bambu_auto_deduct_since';

export function readDone(): string[] {
  try {
    return JSON.parse(safeStorage.getItem(DONE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function markDone(ids: string[]): void {
  const next = Array.from(new Set([...readDone(), ...ids]));
  safeStorage.setItem(DONE_KEY, JSON.stringify(next.slice(-200)));
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').padEnd(6, '0');
  return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
}

/** Passende Spule über Material und Farbnähe finden */
export function bestSpool(spools: Spool[], material: string, colorHex: string): string {
  const same = spools.filter(s => s.material?.toLowerCase() === material.toLowerCase());
  const pool = same.length ? same : spools;
  const [r, g, b] = rgb(colorHex);
  let best = '';
  let bestD = Infinity;
  for (const s of pool) {
    const [r2, g2, b2] = rgb(s.colorHex || '#888888');
    const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
    if (d < bestD) {
      bestD = d;
      best = s.id;
    }
  }
  return best;
}

export function isAutoDeductOn(): boolean {
  return safeStorage.getItem(AUTO_KEY) !== 'off';
}

/** Ab wann Aufträge automatisch abgezogen werden (beim ersten Einschalten: jetzt, damit alte Drucke nicht nachträglich abgezogen werden) */
export function autoDeductSince(): number {
  let v = safeStorage.getItem(AUTO_SINCE_KEY);
  if (!v) {
    v = new Date().toISOString();
    safeStorage.setItem(AUTO_SINCE_KEY, v);
  }
  return new Date(v).getTime();
}

// --- LAN-Modus: Der Drucker meldet im Nur-LAN-Betrieb keine Aufträge an die Cloud, darum fehlt das Gewicht je Druck. ---
// Wir merken uns das Gewicht je Auftragsname (aus einem Hochladen mit bekanntem Gewicht oder deiner einmaligen Eingabe).
// Beim nächsten Druck mit demselben Namen wird automatisch abgezogen.
export const JOB_GRAMS_KEY = 'bambu_job_grams';
export const PENDING_DEDUCT_KEY = 'bambu_lan_pending_deduct';

export function jobKey(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/\.(gcode|3mf|gcode\.3mf)$/g, '')
    .replace(/\.(gcode|3mf)$/g, '')
    .trim();
}

export function readJobGrams(): Record<string, number> {
  try {
    return JSON.parse(safeStorage.getItem(JOB_GRAMS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function rememberJobGrams(name: string, grams: number): void {
  const k = jobKey(name);
  if (!k || !(grams > 0)) return;
  const all = readJobGrams();
  all[k] = Math.round(grams * 10) / 10;
  const keys = Object.keys(all);
  if (keys.length > 200) delete all[keys[0]];
  safeStorage.setItem(JOB_GRAMS_KEY, JSON.stringify(all));
}

export interface PendingDeduct {
  jobName: string;
  slot: number | null;
  spoolId: string;
  material: string;
  colorHex: string;
  at: string;
  /** Warum gefragt wird: Gewicht unbekannt, Ende verpasst (App war zu) oder Druck abgebrochen */
  reason?: 'unknown' | 'missed' | 'failed';
  /** Fortschritt beim Abbruch (%) */
  percent?: number;
  /** Vorschlag je Spule (aus Druckdatei oder gemerktem Gewicht) */
  parts?: { spoolId: string; grams: number }[];
}
