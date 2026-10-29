import { useEffect, useRef, useState } from 'react';
import type { Spool } from '../types/filament';
import { getHaCredentials } from '../utils/haClient';
import { getTagMappings, mapTagToSpool } from '../utils/nfcManager';
import { readTrays, mismatch, EXTERNAL_SLOT } from '../utils/amsMatch';
import { printerApi } from '../api/printerApi';
import { addSystemLog } from '../utils/logService';
import { useWorkshopSettings } from '../utils/workshopSettings';

// NFC-Leser im AMS (ESPHome, siehe hardware/ams-nfc): liest über Home Assistant, welcher Tag in welchem Slot steckt,
// und ordnet die passende Spule automatisch zu. Optional werden Material und Farbe an den Drucker geschickt.

/** Tag-Nummer vergleichbar machen: „04-A1-B2“, „04:a1:b2“, „04a1b2“ → „04a1b2“ */
export const normUid = (s: string) => String(s || '').toLowerCase().replace(/[^0-9a-f]/g, '');

const ENTITY_RE = /^sensor\.[a-z0-9_]*ams[a-z0-9_]*slot_?(\d)_tag$/;
const POLL_MS = 4000;
const DISCOVER_MS = 5 * 60 * 1000;

export interface NfcReaderState {
  /** gefundene Leser (Slot → entity_id) */
  entities: Record<number, string>;
  /** aktuelle Tag-Nummer je Slot ('' = keiner) */
  tags: Record<number, string>;
  /** unbekannte Tags je Slot */
  unknown: Record<number, string>;
}

interface Params {
  spools: Spool[];
  amsSlots: Record<number, string>;
  handleSetAmsSlot: (slot: number, spoolId: string) => void;
  ams: any;
  printerConnected: boolean;
  notify: (t: { text: string; ok: boolean }) => void;
}

function findSpoolForUid(uid: string, spools: Spool[]): string {
  const n = normUid(uid);
  if (!n) return '';
  const maps = getTagMappings();
  for (const [k, id] of Object.entries(maps)) {
    if (normUid(k) === n && spools.some(s => s.id === id)) return id;
  }
  const byField = spools.find(s => s.nfcTagId && normUid(s.nfcTagId) === n);
  return byField?.id || '';
}

export function useAmsNfcReaders(p: Params): NfcReaderState & { learn: (slot: number, spoolId: string) => void } {
  const [settings] = useWorkshopSettings();
  const [state, setState] = useState<NfcReaderState>({ entities: {}, tags: {}, unknown: {} });
  const latest = useRef(p);
  latest.current = p;
  const handled = useRef<Record<number, string>>({});
  const warned = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (settings.amsNfcOn === false) return;
    let stop = false;
    let busy = false;
    let entities: Record<number, string> = {};
    let lastDiscover = 0;
    const lastUid: Record<number, string> = {};

    const discover = async (url: string, headers: Record<string, string>) => {
      lastDiscover = Date.now();
      try {
        const res = await fetch(`${url}/api/states`, { headers, signal: AbortSignal.timeout(10000) });
        if (!res.ok) return;
        const all: any[] = await res.json();
        const found: Record<number, string> = {};
        for (const s of all) {
          const m = String(s?.entity_id || '').match(ENTITY_RE);
          if (m) found[Number(m[1])] = s.entity_id;
        }
        entities = found;
      } catch {
        /* HA nicht erreichbar */
      }
    };

    const poll = async () => {
      if (stop || busy) return;
      // Home-Assistant-Zugang bei jedem Durchlauf frisch lesen (auch wenn er erst später eingetragen oder per Sync übernommen wird)
      const { url, token } = getHaCredentials();
      if (!token || !url) return;
      // Im versteckten Tab nicht abfragen (spart Akku und Netz)
      if (typeof document !== 'undefined' && document.hidden) return;
      busy = true;
      try {
        await pollOnce(url, { Authorization: `Bearer ${token}` });
      } finally {
        busy = false;
      }
    };

    const pollOnce = async (url: string, headers: Record<string, string>) => {
      if (!Object.keys(entities).length || Date.now() - lastDiscover > DISCOVER_MS) await discover(url, headers);
      const slots = Object.keys(entities).map(Number);
      if (!slots.length) {
        setState(s => (Object.keys(s.entities).length ? { entities: {}, tags: {}, unknown: {} } : s));
        return;
      }
      const tags: Record<number, string> = {};
      await Promise.all(
        slots.map(async slot => {
          try {
            const r = await fetch(`${url}/api/states/${entities[slot]}`, { headers, signal: AbortSignal.timeout(8000) });
            if (!r.ok) return;
            const st = String((await r.json())?.state || '');
            tags[slot] = st === 'unknown' || st === 'unavailable' ? '' : st;
          } catch {
            /* einzelner Leser offline */
          }
        })
      );
      const { spools, amsSlots, handleSetAmsSlot, ams, printerConnected, notify } = latest.current;
      const unknown: Record<number, string> = {};
      const trays = readTrays(ams);
      for (const slot of slots) {
        const uid = tags[slot] || '';
        if (!uid) {
          handled.current[slot] = '';
          // Tag weg: Hinweis für einen unbekannten Tag darf beim nächsten Auflegen wieder kommen
          if (lastUid[slot]) delete warned.current[lastUid[slot]];
          lastUid[slot] = '';
          continue;
        }
        lastUid[slot] = uid;
        const spoolId = findSpoolForUid(uid, spools);
        if (!spoolId) {
          unknown[slot] = uid;
          if (!warned.current[uid]) {
            warned.current[uid] = true;
            notify({ text: `Unbekannter NFC-Tag in ${slot === EXTERNAL_SLOT ? 'Extern' : `Slot ${slot}`}. Wähl dort einmal die Spule aus, dann merke ich mir den Tag.`, ok: false });
          }
          continue;
        }
        if (handled.current[slot] === uid && amsSlots[slot] === spoolId) continue;
        handled.current[slot] = uid;
        if (amsSlots[slot] !== spoolId) {
          handleSetAmsSlot(slot, spoolId);
          const sp = spools.find(s => s.id === spoolId);
          notify({ text: `NFC: ${sp ? `${sp.brand} ${sp.name}` : 'Spule'} in ${slot === EXTERNAL_SLOT ? 'Extern' : `Slot ${slot}`} erkannt.`, ok: true });
          addSystemLog('drucker', `NFC-Leser: Slot ${slot} → ${sp?.name || spoolId}`, uid, 'info');
        }
        // Drucker-Slot anpassen, wenn Material/Farbe dort nicht passen (nur AMS-Slots 1-4)
        const sp = spools.find(s => s.id === spoolId);
        const hw = trays.find(t => t.slot === slot);
        if (settings.amsNfcToPrinter !== false && sp && slot <= 4 && printerConnected && hw && (hw.empty || mismatch(sp, hw))) {
          printerApi
            .amsFilament({
              slotIdx: slot - 1,
              colorHex: sp.colorHex || '#888888',
              material: String(sp.material || 'PLA').split(/[\s/]/)[0],
              minTemp: sp.nozzleTemp ? sp.nozzleTemp - 15 : undefined,
              maxTemp: sp.nozzleTemp ? sp.nozzleTemp + 15 : undefined
            } as any)
            .then(r => {
              if (r.ok && (r.data as any)?.success) notify({ text: `Slot ${slot} am Drucker auf ${sp.material} ${sp.colorName} gesetzt.`, ok: true });
            })
            .catch(() => {});
        }
      }
      setState({ entities: { ...entities }, tags, unknown });
    };

    void poll();
    const iv = setInterval(() => void poll(), POLL_MS);
    // Tab wird wieder sichtbar: sofort aktuellen Stand holen
    const vis = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      stop = true;
      clearInterval(iv);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [settings.amsNfcOn, settings.amsNfcToPrinter]);

  /** Spule für einen unbekannten Tag merken (wenn du im Slot eine Spule auswählst) */
  const learn = (slot: number, spoolId: string) => {
    const uid = state.unknown[slot];
    if (uid && spoolId) {
      mapTagToSpool(uid, spoolId);
      handled.current[slot] = '';
      addSystemLog('spule', `NFC-Tag ${uid} gemerkt`, `Slot ${slot}`, 'success');
    }
  };

  return { ...state, learn };
}
