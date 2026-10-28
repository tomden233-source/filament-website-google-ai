// Etiketten-Drucker (Supvan E10): suchen, verbinden, drucken. Ein gemeinsamer Zustand für die ganze App.
import { useSyncExternalStore } from 'react';
import { IS_NATIVE } from '../env';
import { safeStorage } from '../safeStorage';
import { NativeLink, WebLink, nativeBle, requestWebDevice, webBleSupported, type Link, type ScanDevice } from './links';
import { Printer, PrinterError, type PrinterInfo } from './printer';
import { compressBuffers, splitIntoBuffers } from './protocol';
import { toRaster, type Bitmap } from './render';

const KEY_DEVICE = 'filamenthub_label_printer';
const KEY_SETTINGS = 'filamenthub_label_settings';

export interface LabelSettings {
  density: number; // 1..15
  rotate180: boolean;
  mirror: boolean;
  offsetDots: number;
  lengthMm: number; // Etikettenlänge, wenn der Drucker keine meldet
  qrAsLink: boolean;
  showLocation: boolean;
}

const DEFAULTS: LabelSettings = {
  density: 8,
  rotate180: false,
  mirror: false,
  offsetDots: 0,
  lengthMm: 30,
  qrAsLink: true,
  showLocation: true
};

export type PrinterPhase = 'off' | 'connecting' | 'ready' | 'printing';

interface State {
  phase: PrinterPhase;
  name: string;
  info: PrinterInfo | null;
  error: string;
  progress: number;
  log: string[];
  settings: LabelSettings;
  saved: { address: string; name: string } | null;
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = safeStorage.getItem(key);
    return raw ? { ...(fallback as any), ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function loadSaved(): State['saved'] {
  try {
    const raw = safeStorage.getItem(KEY_DEVICE);
    const v = raw ? JSON.parse(raw) : null;
    return v && v.address ? v : null;
  } catch {
    return null;
  }
}

let state: State = {
  phase: 'off',
  name: '',
  info: null,
  error: '',
  progress: 0,
  log: [],
  settings: load(KEY_SETTINGS, DEFAULTS),
  saved: loadSaved()
};
const listeners = new Set<() => void>();
let printer: Printer | null = null;

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach(l => l());
}

function log(msg: string) {
  set({ log: [...state.log.slice(-40), `${new Date().toLocaleTimeString('de-DE')} ${msg}`] });
}

export function usePrinter(): State {
  return useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state
  );
}

export function updateLabelSettings(patch: Partial<LabelSettings>) {
  const settings = { ...state.settings, ...patch };
  try {
    safeStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
  } catch {
    // nur im Speicher
  }
  set({ settings });
}

/** Wie kann dieses Gerät drucken? */
export function printerSupport(): 'native' | 'web' | 'none' {
  if (IS_NATIVE && nativeBle()) return 'native';
  if (webBleSupported()) return 'web';
  return 'none';
}

export async function bleStatus(): Promise<{ available: boolean; enabled: boolean; granted: boolean }> {
  const p = nativeBle();
  if (!p) return { available: false, enabled: false, granted: false };
  return p.call('status');
}

/** Bluetooth-Geräte in der Nähe suchen (nur Android-App) */
export async function scanPrinters(): Promise<ScanDevice[]> {
  const p = nativeBle();
  if (!p) throw new Error('Bluetooth-Suche gibt es nur in der Android-App.');
  const acc = await p.call<{ granted: boolean }>('requestAccess');
  if (!acc.granted) throw new Error('Bluetooth-Berechtigung fehlt. Bitte in den Android-Einstellungen erlauben.');
  const st = await p.call<{ enabled: boolean }>('status');
  if (!st.enabled) throw new Error('Bluetooth ist aus. Bitte einschalten.');
  const r = await p.call<{ devices: ScanDevice[] }>('scan', { ms: 6000 });
  return [...(r.devices || [])].sort((a, b) => Number(b.likely) - Number(a.likely) || b.rssi - a.rssi);
}

async function attach(link: Link) {
  link.onDisconnect = () => {
    printer = null;
    set({ phase: 'off', info: null, progress: 0, error: 'Verbindung zum Drucker getrennt.' });
  };
  printer = new Printer(link, log);
  const info = await printer.info();
  set({ phase: 'ready', name: info.name || link.name, info, error: '' });
  if (info.status?.lowBattery) log('Akku des Druckers ist schwach.');
}

export async function connectPrinter(device?: { address: string; name: string }): Promise<void> {
  if (state.phase === 'connecting' || state.phase === 'printing') return;
  await disconnectPrinter(true);
  set({ phase: 'connecting', error: '' });
  try {
    const mode = printerSupport();
    if (mode === 'native') {
      const p = nativeBle()!;
      const acc = await p.call<{ granted: boolean }>('requestAccess');
      if (!acc.granted) throw new PrinterError('Bluetooth-Berechtigung fehlt. Bitte in den Android-Einstellungen erlauben.');
      const target = device || state.saved;
      if (!target) throw new PrinterError('Kein Drucker gewählt. Bitte zuerst suchen.');
      const link = await NativeLink.connect(target.address, target.name, log);
      await attach(link);
      const saved = { address: target.address, name: state.name || target.name };
      safeStorage.setItem(KEY_DEVICE, JSON.stringify(saved));
      set({ saved });
    } else if (mode === 'web') {
      const dev = await requestWebDevice();
      const link = await WebLink.connect(dev, log);
      await attach(link);
    } else {
      throw new PrinterError('Dieses Gerät kann kein Bluetooth. Nutze die Android-App oder Chrome.');
    }
  } catch (e) {
    const msg = (e as Error).message || 'Verbindung fehlgeschlagen';
    try {
      await printer?.close();
    } catch {
      // egal
    }
    printer = null;
    set({ phase: 'off', info: null, error: msg });
    throw e;
  }
}

export async function disconnectPrinter(silent = false) {
  const p = printer;
  printer = null;
  if (p) {
    try {
      await p.close();
    } catch {
      // egal
    }
  }
  if (!silent) set({ phase: 'off', info: null, progress: 0, error: '' });
}

export function forgetPrinter() {
  safeStorage.removeItem(KEY_DEVICE);
  set({ saved: null });
}

/** Etikettenlänge: vom Drucker gemeldet, sonst aus den Einstellungen */
export function labelLengthMm(): number {
  const m = state.info?.material;
  return m && m.lengthMm > 0 ? m.lengthMm : state.settings.lengthMm;
}

/** Ein oder mehrere Etiketten nacheinander drucken */
export async function printBitmaps(bitmaps: Bitmap[]): Promise<void> {
  if (!printer || state.phase !== 'ready') throw new PrinterError('Drucker ist nicht verbunden.');
  const s = state.settings;
  set({ phase: 'printing', progress: 0, error: '' });
  try {
    for (const [i, bmp] of bitmaps.entries()) {
      const { raster, perLineByte, cols } = toRaster(bmp, s);
      const { blocks, speed } = compressBuffers(splitIntoBuffers(raster, perLineByte, cols, s.density));
      await printer.print(blocks, speed, p => set({ progress: (i + p) / bitmaps.length }));
      set({ progress: (i + 1) / bitmaps.length });
    }
    set({ phase: 'ready', progress: 1 });
  } catch (e) {
    set({ phase: 'ready', progress: 0, error: (e as Error).message });
    throw e;
  }
}

export { PrinterError };
