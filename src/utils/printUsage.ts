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
