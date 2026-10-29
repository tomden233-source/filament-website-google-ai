import { useEffect, useRef } from 'react';
import type { Spool } from '../types/filament';
import { readTrays, colorDistance, baseMaterial, COLOR_TOLERANCE } from '../utils/amsMatch';
import { getTagMappings, mapTagToSpool } from '../utils/nfcManager';
import { addSystemLog } from '../utils/logService';

// Bambu-Spulen brauchen keinen eigenen NFC-Tag: Das AMS liest ihren RFID-Chip selbst und meldet eine Kennung (tray_uuid).
// Die App merkt sich Kennung → Spule und ordnet die Spule beim nächsten Einlegen automatisch dem Slot zu.
//  - Kennung bekannt → Slot zuordnen
//  - unbekannt, aber genau EINE Bambu-Spule passt (Material + Farbe) → automatisch merken
//  - sonst: sobald du im Slot die Spule wählst, wird sie gemerkt (learn)
// Die eigenen NFC-Leser (RC522) ignorieren Bambu-Chips (siehe hardware/ams-nfc/filament-ams.yaml), es gibt also keine Verwechslung.

const key = (rfid: string) => `bambu:${rfid.toLowerCase()}`;

interface Params {
  ams: any;
  connected: boolean;
  spools: Spool[];
  amsSlots: Record<number, string>;
  handleSetAmsSlot: (slot: number, spoolId: string) => void;
  notify: (t: { text: string; ok: boolean }) => void;
}

export function bambuSpoolFor(rfid: string, spools: Spool[]): string {
  if (!rfid) return '';
  const id = getTagMappings()[key(rfid)];
  return id && spools.some(s => s.id === id) ? id : '';
}

export function useBambuRfid(p: Params) {
  const latest = useRef(p);
  latest.current = p;
  const done = useRef<Record<number, string>>({});

  const trays = p.connected ? readTrays(p.ams) : [];
  const sig = trays.map(t => `${t.slot}:${t.rfid || ''}`).join('|');

  useEffect(() => {
    if (!p.connected) return;
    const { spools, amsSlots, handleSetAmsSlot, notify } = latest.current;
    for (const t of readTrays(latest.current.ams)) {
      if (!t.rfid) {
        done.current[t.slot] = '';
        continue;
      }
      if (done.current[t.slot] === t.rfid && amsSlots[t.slot]) continue;
      let spoolId = bambuSpoolFor(t.rfid, spools);
      if (!spoolId) {
        // genau eine passende Bambu-Spule? Dann gleich merken
        const cands = spools.filter(
          s =>
            /bambu/i.test(s.brand || '') &&
            baseMaterial(s.material) === baseMaterial(t.type) &&
            (!t.colorHex || colorDistance(s.colorHex || '#888888', t.colorHex) <= COLOR_TOLERANCE) &&
            !Object.values(getTagMappings()).includes(s.id)
        );
        if (cands.length === 1) {
          spoolId = cands[0].id;
          mapTagToSpool(key(t.rfid), spoolId);
          addSystemLog('spule', `Bambu-Spule erkannt und gemerkt: ${cands[0].name}`, `Slot ${t.slot} · ${t.rfid}`, 'success');
        }
      }
      done.current[t.slot] = t.rfid;
      if (spoolId && amsSlots[t.slot] !== spoolId) {
        handleSetAmsSlot(t.slot, spoolId);
        const sp = spools.find(s => s.id === spoolId);
        notify({ text: `Bambu-Spule ${sp ? sp.name : ''} in Slot ${t.slot} erkannt.`, ok: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.connected, sig]);

  /** Spule für die Bambu-Kennung in diesem Slot merken (wenn du im Slot eine Spule wählst) */
  const learn = (slot: number, spoolId: string) => {
    const t = readTrays(latest.current.ams).find(x => x.slot === slot);
    if (!t?.rfid || !spoolId) return;
    if (getTagMappings()[key(t.rfid)] === spoolId) return;
    mapTagToSpool(key(t.rfid), spoolId);
    done.current[slot] = '';
    addSystemLog('spule', 'Bambu-Spule gemerkt', `Slot ${slot} · ${t.rfid}`, 'success');
  };

  return { learn };
}
