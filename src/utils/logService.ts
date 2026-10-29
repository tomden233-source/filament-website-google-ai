import { safeStorage } from './safeStorage';
import { LogCategory, SystemLogEntry } from '../types/filament';

const STORAGE_KEY_LOGS = 'filamenthub_system_logs_v1';
const MAX_LOGS = 200;
// Dieselbe Meldung nicht mehrfach direkt hintereinander speichern (sonst füllt sie das Log)
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
let lastKey = '';
let lastAt = 0;

/** Aufeinanderfolgende gleiche Einträge zu einem zusammenfassen (räumt alte, zugespamte Logs auf) */
function collapse(list: SystemLogEntry[]): SystemLogEntry[] {
  const out: SystemLogEntry[] = [];
  let statusKept = 0; // alte Statuswechsel-Einträge (flackerten früher im Sekundentakt): nur die 8 neuesten behalten
  for (const e of list) {
    if (e.message.startsWith('Bambu Lab X2D: ') && ++statusKept > 8) continue;
    const prev = out[out.length - 1];
    if (prev && prev.category === e.category && prev.message === e.message && (prev.details || '') === (e.details || '')) continue;
    out.push(e);
  }
  return out;
}

export function getSystemLogs(): SystemLogEntry[] {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY_LOGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return collapse(parsed);
    }
  } catch {}

  // Initialer Begrüßungs-Log
  const initial: SystemLogEntry = {
    id: 'init-1',
    timestamp: new Date().toLocaleTimeString('de-DE'),
    dateStr: new Date().toLocaleDateString('de-DE'),
    category: 'system',
    message: 'FilamentHub System-Logger initialisiert',
    details: 'Live-Überwachung von Steckdose, Druckerstatus, Licht und Spulen aktiv',
    level: 'info'
  };
  safeStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify([initial]));
  return [initial];
}

export function addSystemLog(
  category: LogCategory,
  message: string,
  details?: string,
  level: 'info' | 'success' | 'warn' | 'error' = 'info'
): SystemLogEntry {
  const now = new Date();
  const key = `${category}|${message}|${details || ''}`;
  const nowMs = now.getTime();
  const isDuplicate = key === lastKey && nowMs - lastAt < DUPLICATE_WINDOW_MS;
  lastKey = key;
  lastAt = nowMs;
  if (isDuplicate) {
    return { id: `dup-${nowMs}`, timestamp: now.toLocaleTimeString('de-DE'), dateStr: now.toLocaleDateString('de-DE'), category, message, details, level };
  }
  const entry: SystemLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: now.toLocaleTimeString('de-DE'),
    dateStr: now.toLocaleDateString('de-DE'),
    category,
    message,
    details,
    level
  };

  try {
    const logs = getSystemLogs();
    const updated = [entry, ...logs].slice(0, MAX_LOGS);
    safeStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updated));

    // Custom Event dispatchen, damit der Live-Drawer sofort reagiert
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('filamenthub:new_log', { detail: entry }));
    }
  } catch (err) {
    console.warn('Fehler beim Speichern des System-Logs:', err);
  }

  return entry;
}

export function clearSystemLogs(): void {
  const cleared: SystemLogEntry[] = [
    {
      id: `clear-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('de-DE'),
      dateStr: new Date().toLocaleDateString('de-DE'),
      category: 'system',
      message: 'Logs wurden zurückgesetzt',
      level: 'info'
    }
  ];
  safeStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(cleared));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('filamenthub:clear_logs'));
  }
}
