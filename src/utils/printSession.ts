// Merkt sich den laufenden Druck dauerhaft im Gerät. So erkennt die App auch Drucke, die nicht über die App gestartet wurden
// oder deren Ende sie verpasst hat (App war zu): Beim nächsten Öffnen kommt die Meldung bzw. die Frage „Spule abziehen?“.
import { safeStorage } from './safeStorage';
import { jobKey } from './printUsage';

export const ACTIVE_STATES = new Set(['RUNNING', 'PREPARE', 'PAUSE']);
export const END_STATES = new Set(['FINISH', 'FAILED']);

export interface PrintSession {
  /** Eindeutig je Auftrag: Name + Startzeit (oder Zeitpunkt, an dem die App ihn zuerst sah) */
  id: string;
  /** Auftragsname wie vom Drucker */
  name: string;
  /** Startzeit laut Drucker (ms), 0 = unbekannt */
  startMs: number;
  /** Wann die App den Druck zuerst gesehen hat (ms) */
  seenAt: number;
  /** Erst mitten im Druck gesehen (nicht beim Start) */
  midway: boolean;
  /** Wie oft welcher Slot beim Drucken aktiv war (für den Abzug) */
  slots: Record<string, number>;
  /** Letzter gesehener Fortschritt in % */
  lastPercent: number;
  /** Ende schon verarbeitet (Meldung + Abzug) */
  ended: boolean;
  /** „Druck gestartet“ schon gemeldet */
  announced?: boolean;
}

const SESSION_KEY = 'filamenthub_print_session_v1';
const DONE_IDS_KEY = 'filamenthub_print_done_ids_v1';
const SINCE_KEY = 'filamenthub_print_watch_since';

/** Startzeit vom Drucker (Sekunden oder ms als Text) in ms. 0 = unbekannt. */
export function parseStartMs(raw: string | undefined | null): number {
  const n = Number(String(raw ?? '').trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 1e12 ? n : n * 1000;
}

export function makePrintId(name: string, startMs: number, seenAt: number): string {
  return `${jobKey(name) || 'druck'}|${startMs ? `s${Math.round(startMs / 1000)}` : `a${seenAt}`}`;
}

/** Ab wann diese Funktion aktiv ist: ältere Drucke werden nie nachträglich gemeldet oder abgezogen */
export function watchSince(): number {
  let v = Number(safeStorage.getItem(SINCE_KEY));
  if (!Number.isFinite(v) || v <= 0) {
    v = Date.now();
    safeStorage.setItem(SINCE_KEY, String(v));
  }
  return v;
}

export function readSession(): PrintSession | null {
  try {
    const raw = safeStorage.getItem(SESSION_KEY);
    const s = raw ? JSON.parse(raw) : null;
    return s && typeof s.id === 'string' ? (s as PrintSession) : null;
  } catch {
    return null;
  }
}

export function writeSession(s: PrintSession | null): void {
  if (!s) safeStorage.removeItem(SESSION_KEY);
  else safeStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

function readDone(): string[] {
  try {
    const v = JSON.parse(safeStorage.getItem(DONE_IDS_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function isPrintDone(id: string): boolean {
  return readDone().includes(id);
}

export function markPrintDone(id: string): void {
  const list = readDone().filter(x => x !== id);
  list.push(id);
  safeStorage.setItem(DONE_IDS_KEY, JSON.stringify(list.slice(-60)));
}

/** Slot mit den meisten Messungen (oder null) */
export function mainSlot(s: PrintSession | null): number | null {
  if (!s) return null;
  let best: number | null = null;
  let top = 0;
  Object.entries(s.slots || {}).forEach(([k, n]) => {
    if (n > top) {
      top = n;
      best = Number(k);
    }
  });
  return best;
}
