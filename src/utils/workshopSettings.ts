// Einstellungen der Werkstatt-Funktionen (Rest-Warnung, Erinnerungen, Druck-Meldungen).
// Ein gemeinsamer Speicher: Änderungen sind sofort in allen Komponenten sichtbar.
import { useSyncExternalStore } from 'react';
import { safeStorage } from './safeStorage';

export interface WorkshopSettings {
  /** Warnung, wenn eine Spule fast leer ist */
  lowWarning: boolean;
  /** Ab diesem Restgewicht (Gramm) gilt eine Spule als fast leer */
  lowWeightG: number;
  /** Erinnerung, wenn Trocknen fällig oder die AMS-Trocknung fertig ist */
  dryReminder: boolean;
  /** Meldung, wenn ein Druck fertig oder fehlgeschlagen ist */
  finishAlert: boolean;
  /** Kamerabild an die Druck-Meldung hängen (braucht Home-Assistant-Kamera) */
  finishPhoto: boolean;
  /** Push aufs Handy über ntfy.sh */
  ntfyOn: boolean;
  /** Geheimer ntfy-Kanalname */
  ntfyTopic: string;
  /** Erinnerung an ein Backup */
  backupReminder: boolean;
  /** NFC-Leser im AMS (ESPHome über Home Assistant) nutzen */
  amsNfcOn: boolean;
  /** Bei erkannter Spule Material/Farbe an den Drucker senden */
  amsNfcToPrinter: boolean;
}

export const WORKSHOP_SETTINGS_KEY = 'filamenthub_workshop_settings';

export const DEFAULT_WORKSHOP_SETTINGS: WorkshopSettings = {
  lowWarning: true,
  lowWeightG: 100,
  dryReminder: true,
  finishAlert: true,
  finishPhoto: true,
  ntfyOn: false,
  ntfyTopic: '',
  backupReminder: true,
  amsNfcOn: true,
  amsNfcToPrinter: true
};

let cache: WorkshopSettings | null = null;
const listeners = new Set<() => void>();

function sanitize(raw: Partial<WorkshopSettings> | null | undefined): WorkshopSettings {
  const s: WorkshopSettings = { ...DEFAULT_WORKSHOP_SETTINGS, ...(raw || {}) };
  const g = Number(s.lowWeightG);
  s.lowWeightG = Number.isFinite(g) ? Math.max(0, Math.min(1000, Math.round(g))) : DEFAULT_WORKSHOP_SETTINGS.lowWeightG;
  s.ntfyTopic = String(s.ntfyTopic || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  return s;
}

function readStored(): WorkshopSettings {
  try {
    const raw = safeStorage.getItem(WORKSHOP_SETTINGS_KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch {
    // kaputte Daten: Standardwerte
  }
  return { ...DEFAULT_WORKSHOP_SETTINGS };
}

export function getWorkshopSettings(): WorkshopSettings {
  if (!cache) cache = readStored();
  return cache;
}

export function updateWorkshopSettings(patch: Partial<WorkshopSettings>): void {
  cache = sanitize({ ...getWorkshopSettings(), ...patch });
  safeStorage.setItem(WORKSHOP_SETTINGS_KEY, JSON.stringify(cache));
  listeners.forEach(l => l());
}

/** Nach einem Backup-Import: Einstellungen neu aus dem Speicher laden */
export function reloadWorkshopSettings(): void {
  cache = null;
  listeners.forEach(l => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useWorkshopSettings(): [WorkshopSettings, typeof updateWorkshopSettings] {
  const s = useSyncExternalStore(subscribe, getWorkshopSettings, getWorkshopSettings);
  return [s, updateWorkshopSettings];
}
