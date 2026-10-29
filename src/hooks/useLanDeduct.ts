import { useEffect, useRef } from 'react';
import type { Spool } from '../types/filament';
import { readTrays, activeSlotFromPrinter, EXTERNAL_SLOT, baseMaterial, colorDistance } from '../utils/amsMatch';
import { printerApi } from '../api/printerApi';
import { bestSpool, isAutoDeductOn, jobKey, readJobGrams, rememberJobGrams, PENDING_DEDUCT_KEY, type PendingDeduct } from '../utils/printUsage';
import { safeStorage } from '../utils/safeStorage';
import { addSystemLog } from '../utils/logService';

// Auto-Abzug im LAN-Modus (ohne Bambu Cloud):
//  0) Windows-/Server-App: Gewicht je Filament direkt aus der Druckdatei auf dem Drucker (FTPS), komplett automatisch
//  1) Auftragsname schon bekannt (Gewicht früher eingegeben/hochgeladen) → sofort automatisch abziehen
//  2) sonst: Frage „Wie viele Gramm?" mit vorgewählter Spule (bleibt gespeichert, bis du bestätigst oder überspringst)
// Spule: der AMS-Slot, der beim Druck aktiv war (zugewiesene Spule), sonst Material und Farbe.

const ACTIVE = new Set(['RUNNING', 'PREPARE', 'PAUSE']);

interface Params {
  enabled: boolean;
  gcodeState: string | undefined;
  jobName: string | undefined;
  ams: any;
  vtTray: any;
  amsSlots: Record<number, string>;
  spools: Spool[];
  onDeductWeight: (spoolId: string, grams: number) => void;
  notify: (t: { text: string; ok: boolean }) => void;
  onPending: (p: PendingDeduct) => void;
}

export function useLanDeduct(p: Params) {
  const latest = useRef(p);
  latest.current = p;
  const prev = useRef<string | null>(null);
  const job = useRef({ name: '', slots: new Map<number, number>() });

  // Während des Drucks merken, welcher Slot gerade zieht
  useEffect(() => {
    if (!p.enabled || !p.gcodeState || !ACTIVE.has(p.gcodeState)) return;
    if (p.jobName) job.current.name = p.jobName;
    const slot = activeSlotFromPrinter(p.ams);
    if (slot) job.current.slots.set(slot, (job.current.slots.get(slot) || 0) + 1);
  }, [p.enabled, p.gcodeState, p.jobName, p.ams]);

  // Beim App-Start noch offene Frage wieder anzeigen
  useEffect(() => {
    if (!p.enabled) return;
    try {
      const raw = safeStorage.getItem(PENDING_DEDUCT_KEY);
      if (raw) latest.current.onPending(JSON.parse(raw));
    } catch {
      /* kaputter Eintrag */
    }
    // nur einmal beim Aktivieren
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.enabled]);

  useEffect(() => {
    const before = prev.current;
    prev.current = p.gcodeState ?? null;
    const { enabled } = latest.current;
    if (!enabled || !isAutoDeductOn() || !before || !ACTIVE.has(before) || p.gcodeState !== 'FINISH') return;

    const { spools, amsSlots, ams, vtTray, onDeductWeight, notify, onPending } = latest.current;
    const name = job.current.name || p.jobName || 'Druckauftrag';
    // Slot mit den meisten Messungen
    let slot: number | null = null;
    let top = 0;
    job.current.slots.forEach((n, s) => {
      if (n > top) {
        top = n;
        slot = s;
      }
    });
    job.current = { name: '', slots: new Map() };

    const trays = readTrays(ams);
    const hw = slot === EXTERNAL_SLOT ? null : trays.find(t => t.slot === slot);
    const material = slot === EXTERNAL_SLOT ? String(vtTray?.tray_type || '') : hw?.type || '';
    const colorHex = (slot === EXTERNAL_SLOT ? '#' + String(vtTray?.tray_color || '888888').slice(0, 6) : hw?.colorHex) || '#888888';
    const assigned = slot ? amsSlots[slot] : '';
    const spoolId = assigned && spools.some(s => s.id === assigned) ? assigned : material ? bestSpool(spools, material, colorHex) : '';

    const fallback = () => {
      const known = readJobGrams()[jobKey(name)];
      if (known > 0 && spoolId) {
        onDeductWeight(spoolId, known);
        const s = spools.find(x => x.id === spoolId);
        notify({ text: `Auto-Abzug „${name}“: ${known} g von ${s ? `${s.brand} ${s.name}` : 'Spule'}`, ok: true });
        addSystemLog('spule', `Auto-Abzug (LAN) ${known} g`, name, 'success');
        return;
      }
      const pending: PendingDeduct = { jobName: name, slot, spoolId, material, colorHex, at: new Date().toISOString() };
      safeStorage.setItem(PENDING_DEDUCT_KEY, JSON.stringify(pending));
      onPending(pending);
    };

    // Datei vom Drucker holen (klappt in der Windows-/Server-App). Der Drucker braucht kurz nach Druckende, bis alles bereit ist.
    void (async () => {
      try {
        const res = await printerApi.jobWeights({ jobName: name });
        const fil = res.ok && res.data?.success ? res.data.filaments : undefined;
        if (!fil || fil.length === 0) return fallback();
        const candidates = [...trays.filter(t => !t.empty), ...(vtTray?.tray_type ? [{ slot: EXTERNAL_SLOT, type: String(vtTray.tray_type), colorHex: '#' + String(vtTray.tray_color || '888888').slice(0, 6) }] : [])];
        const perSpool = new Map<string, number>();
        for (const f of fil) {
          let target = '';
          let bestD = Infinity;
          for (const t of candidates) {
            if (baseMaterial(t.type) !== baseMaterial(f.type)) continue;
            const d = colorDistance(t.colorHex || '#888888', f.colorHex);
            if (d < bestD) {
              bestD = d;
              const a = amsSlots[t.slot];
              target = a && spools.some(x => x.id === a) ? a : '';
            }
          }
          if (!target && fil.length === 1) target = spoolId; // einzige Farbe: aktiver Slot
          if (!target) target = bestSpool(spools, f.type, f.colorHex);
          if (target) perSpool.set(target, (perSpool.get(target) || 0) + f.grams);
        }
        if (perSpool.size === 0) return fallback();
        const parts: string[] = [];
        let n = 0;
        perSpool.forEach((g, id) => {
          const grams = Math.round(g * 10) / 10;
          setTimeout(() => onDeductWeight(id, grams), n * 300);
          n++;
          const sp = spools.find(x => x.id === id);
          parts.push(`${grams} g von ${sp ? `${sp.brand} ${sp.name}` : 'Spule'}`);
        });
        rememberJobGrams(name, res.data!.totalGrams || fil.reduce((a, f) => a + f.grams, 0));
        notify({ text: `Auto-Abzug „${name}“ (aus Druckdatei): ${parts.join(', ')}`, ok: true });
        addSystemLog('spule', 'Auto-Abzug aus Druckdatei (LAN)', `${name}: ${parts.join(', ')}`, 'success');
      } catch {
        fallback();
      }
    })();
  }, [p.gcodeState, p.jobName]);
}
