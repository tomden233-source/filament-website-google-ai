// NFC-Tags lesen: ein gemeinsamer Helfer für alle Fenster, die einen Tag erwarten (Slot-Fenster, Slot-Knopf).
import { useEffect, useRef, useState } from 'react';
import type { Spool } from '../types/filament';
import { OPENTAG3D_MIME } from './openTag3d';
import { isWebNfcSupported, openTag3dToJsonText, parseNfcContent, playNfcSuccessChime, triggerNfcHaptic, type NfcReadResult } from './nfcManager';

export function decodeRecords(records: any[]): string {
  for (const r of records) {
    try {
      if (r.recordType === 'mime' && r.mediaType === OPENTAG3D_MIME) {
        const dv: DataView = r.data;
        return openTag3dToJsonText(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength));
      }
      if (r.recordType === 'text' || r.recordType === 'mime') {
        const dv: DataView = r.data;
        return new TextDecoder(r.encoding || 'utf-8').decode(dv);
      }
    } catch {
      // nächsten Record versuchen
    }
  }
  return '';
}

/**
 * Lauscht auf NFC-Tags, solange `enabled` gilt. Ruft onTag mit dem erkannten Ergebnis auf (Spule, Tag-Daten oder leer).
 * Gibt Pieps und Vibration selbst aus, wenn der Tag etwas Brauchbares enthält.
 */
export function useNfcTags(spools: Spool[], onTag: (result: NfcReadResult) => void, enabled = true) {
  const supported = isWebNfcSupported();
  const [error, setError] = useState<string | null>(null);
  const spoolsRef = useRef(spools);
  spoolsRef.current = spools;
  const cbRef = useRef(onTag);
  cbRef.current = onTag;

  useEffect(() => {
    if (!supported || !enabled) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const reader = new (window as any).NDEFReader();
        reader.onreading = (ev: any) => {
          const text = decodeRecords(ev.message?.records || []);
          const parsed = parseNfcContent(text, ev.serialNumber, spoolsRef.current);
          setError(null);
          if (parsed.matchedSpool || parsed.payload?.material) {
            triggerNfcHaptic();
            playNfcSuccessChime();
          }
          cbRef.current(parsed);
        };
        reader.onreadingerror = () => setError('Tag konnte nicht gelesen werden. Bitte näher halten.');
        await reader.scan({ signal: ctrl.signal });
      } catch (err: any) {
        if (err?.name !== 'AbortError') setError(err?.message || 'NFC konnte nicht gestartet werden.');
      }
    })();
    return () => ctrl.abort();
  }, [supported, enabled]);

  return { supported, error, setError };
}
