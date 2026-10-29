// Druck-Verlauf mit Foto: jeder fertige oder abgebrochene Druck mit Dauer, Verbrauch, Kosten und einem Kamerabild vom Ende.
// Einträge im lokalen Speicher, Fotos in IndexedDB (zu groß für den normalen Speicher).
import { useSyncExternalStore } from 'react';
import type { Spool } from '../types/filament';
import { safeStorage } from './safeStorage';
import { getHaCredentials } from './haClient';

export interface PrintRecordSpool {
  id: string;
  label: string;
  color: string;
  grams: number;
  cost: number;
}

export interface PrintRecord {
  id: string;
  name: string;
  startMs: number;
  endMs: number;
  state: 'FINISH' | 'FAILED';
  /** Ende passierte, während die App zu war */
  missed: boolean;
  /** Fortschritt beim Ende (%) */
  percent: number;
  durationMin: number;
  spools: PrintRecordSpool[];
  grams: number;
  cost: number;
  hasPhoto: boolean;
}

const KEY = 'filamenthub_print_log_v1';
const MAX = 200;

let cache: PrintRecord[] | null = null;
const listeners = new Set<() => void>();

function read(): PrintRecord[] {
  try {
    const v = JSON.parse(safeStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function getPrintLog(): PrintRecord[] {
  if (!cache) cache = read();
  return cache;
}

function save(list: PrintRecord[]): void {
  const kept = list.slice(0, MAX);
  const dropped = list.slice(MAX);
  cache = kept;
  safeStorage.setItem(KEY, JSON.stringify(kept));
  dropped.forEach(r => void deletePhoto(r.id));
  listeners.forEach(l => l());
}

export function addPrintRecord(r: Omit<PrintRecord, 'spools' | 'grams' | 'cost' | 'hasPhoto'>): void {
  const list = getPrintLog();
  if (list.some(x => x.id === r.id)) return;
  save([{ ...r, spools: [], grams: 0, cost: 0, hasPhoto: false }, ...list]);
}

/** Verbrauch einem Druck zuordnen (beim Abzug) */
export function addPrintUsage(printId: string | undefined, spool: Spool | undefined, grams: number): void {
  if (!printId || !spool || !(grams > 0)) return;
  const list = getPrintLog();
  const r = list.find(x => x.id === printId);
  if (!r) return;
  const cost = (Number(spool.pricePerKg) || 0) * (grams / 1000);
  const existing = r.spools.find(s => s.id === spool.id);
  const spools = existing
    ? r.spools.map(s => (s.id === spool.id ? { ...s, grams: s.grams + grams, cost: s.cost + cost } : s))
    : [...r.spools, { id: spool.id, label: `${spool.brand} ${spool.name}`, color: spool.colorHex, grams, cost }];
  const next = { ...r, spools, grams: spools.reduce((a, s) => a + s.grams, 0), cost: spools.reduce((a, s) => a + s.cost, 0) };
  save(list.map(x => (x.id === printId ? next : x)));
}

export function removePrintRecord(id: string): void {
  save(getPrintLog().filter(r => r.id !== id));
  void deletePhoto(id);
}

function markPhoto(id: string): void {
  const list = getPrintLog();
  if (!list.some(r => r.id === id && !r.hasPhoto)) return;
  save(list.map(r => (r.id === id ? { ...r, hasPhoto: true } : r)));
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function usePrintLog(): PrintRecord[] {
  return useSyncExternalStore(subscribe, getPrintLog, getPrintLog);
}

// --- Fotos (IndexedDB) ---

const DB = 'filamenthub';
const STORE = 'print-photos';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('kein IndexedDB'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function savePhoto(id: string, blob: Blob): Promise<void> {
  await tx('readwrite', s => s.put(blob, id));
  markPhoto(id);
}

export async function loadPhoto(id: string): Promise<Blob | null> {
  try {
    return ((await tx('readonly', s => s.get(id))) as Blob) || null;
  } catch {
    return null;
  }
}

export async function deletePhoto(id: string): Promise<void> {
  try {
    await tx('readwrite', s => s.delete(id));
  } catch {
    /* egal */
  }
}

/** Kleiner machen (max. 720 px breit, JPEG), damit viele Fotos Platz haben */
async function shrink(blob: Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, 720 / bmp.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const out = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.72));
    return out || blob;
  } catch {
    return blob;
  }
}

/** Kamerabild über Home Assistant holen und zum Druck speichern */
export async function capturePrintPhoto(id: string): Promise<boolean> {
  const { url, token, cameraEntity } = getHaCredentials();
  if (!token || !cameraEntity) return false;
  try {
    const res = await fetch(`${url}/api/camera_proxy/${cameraEntity}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
    if (!res.ok || !res.headers.get('content-type')?.includes('image')) return false;
    await savePhoto(id, await shrink(await res.blob()));
    return true;
  } catch {
    return false;
  }
}
