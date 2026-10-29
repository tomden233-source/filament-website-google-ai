import { useEffect, useRef } from 'react';
import type { Spool } from '../types/filament';
import { readTrays, activeSlotFromPrinter, EXTERNAL_SLOT } from '../utils/amsMatch';
import { bestSpool, isAutoDeductOn, jobKey, readJobGrams, PENDING_DEDUCT_KEY, type PendingDeduct } from '../utils/printUsage';
import { safeStorage } from '../utils/safeStorage';
import { addSystemLog } from '../utils/logService';

// Auto-Abzug im LAN-Modus (ohne Bambu Cloud):
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
  }, [p.gcodeState, p.jobName]);
}
