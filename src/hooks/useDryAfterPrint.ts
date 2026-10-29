import { useEffect, useRef, useState } from 'react';
import type { Spool } from '../types/filament';
import { raiseAlert } from '../utils/alerts';
import { addSystemLog } from '../utils/logService';
import { ACTIVE_STATES } from '../utils/printSession';
import { disarmDryPlan, dryPlanFor, markDryPlanSawPrint, needsDryingNow, useDryPlan } from '../utils/dryAfterPrint';
import { useWorkshopSettings } from '../utils/workshopSettings';
import { EXTERNAL_SLOT } from '../utils/amsMatch';

// 1) Trocknen-Vorschlag: Wird eine Spule in einen AMS-Slot gelegt (von Hand, per NFC-Tag oder NFC-Leser im AMS)
//    und sollte sie trocknen, kommt eine Mitteilung und in der App die Frage „Nach Druck trocknen / Jetzt trocknen“.
// 2) Nach Druck trocknen: Ist der Plan gesetzt und der Druck vorbei (1 Minute Ruhe), startet die AMS-Trocknung.

export interface DryOffer {
  spools: Spool[];
  slots: number[];
  temp: number;
  hours: number;
}

interface Params {
  connected: boolean;
  gcodeState: string | undefined;
  amsSlots: Record<number, string>;
  spools: Spool[];
  startDrying: (o: { hours: number; temp: number }) => Promise<boolean>;
  notify: (t: { text: string; ok: boolean }) => void;
}

const DONE_STATES = new Set(['FINISH', 'FAILED', 'IDLE']);

export function useDryAfterPrint(p: Params) {
  const [settings] = useWorkshopSettings();
  const plan = useDryPlan();
  const [offer, setOffer] = useState<DryOffer | null>(null);
  const latest = useRef(p);
  latest.current = p;
  const prevSlots = useRef<Record<number, string> | null>(null);
  const restSince = useRef<number | null>(null);
  const busy = useRef(false);

  // --- 1) Neue Spule im Slot → Trocknen nötig? ---
  const slotKey = [1, 2, 3, 4, EXTERNAL_SLOT].map(s => p.amsSlots[s] || '').join('|');
  useEffect(() => {
    const before = prevSlots.current;
    prevSlots.current = { ...p.amsSlots };
    if (!before || !settings.drySuggest) return; // erster Stand nach dem Öffnen zählt nicht als „eingelegt“
    const added: { slot: number; spool: Spool }[] = [];
    [1, 2, 3, 4].forEach(slot => {
      const id = p.amsSlots[slot];
      if (!id || id === before[slot]) return;
      const sp = p.spools.find(s => s.id === id);
      if (sp && needsDryingNow(sp)) added.push({ slot, spool: sp });
    });
    if (!added.length) return;
    const inAms = [1, 2, 3, 4].map(s => p.spools.find(x => x.id === p.amsSlots[s])).filter(Boolean) as Spool[];
    const { temp, hours } = dryPlanFor(added.map(a => a.spool), inAms);
    setOffer({ spools: added.map(a => a.spool), slots: added.map(a => a.slot), temp, hours });
    const names = added.map(a => `${a.spool.brand} ${a.spool.name}`).join(', ');
    const text = `${names} sollte getrocknet werden (${temp} °C, ${hours} h). In der App: „Nach Druck trocknen“ oder „Jetzt trocknen“.`;
    void raiseAlert({
      kind: 'dry-due',
      key: `dry-insert-${added.map(a => a.spool.id).join('-')}-${new Date().toDateString()}`,
      title: 'Spule sollte trocknen',
      text,
      toast: `💧 ${text}`,
      items: added.map(a => ({ title: `${a.spool.brand} ${a.spool.name}`, sub: `Slot ${a.slot} · ${a.spool.material} · ${a.spool.dryTemp} °C, ${a.spool.dryHours} h`, color: a.spool.colorHex }))
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotKey, settings.drySuggest]);

  // --- 2) Nach dem Druck trocknen ---
  useEffect(() => {
    if (!plan.armed || !p.connected || !p.gcodeState) return;
    if (ACTIVE_STATES.has(p.gcodeState)) {
      markDryPlanSawPrint();
      restSince.current = null;
      return;
    }
    if (!plan.sawPrint || !DONE_STATES.has(p.gcodeState)) return;
    if (restSince.current === null) restSince.current = Date.now();
  }, [plan.armed, plan.sawPrint, p.connected, p.gcodeState]);

  useEffect(() => {
    if (!plan.armed) return;
    const tick = async () => {
      if (busy.current || restSince.current === null || Date.now() - restSince.current < 60_000) return;
      busy.current = true;
      try {
        const ok = await latest.current.startDrying({ hours: plan.hours, temp: plan.temp });
        if (ok) {
          disarmDryPlan();
          restSince.current = null;
          const names = plan.spoolIds
            .map(id => latest.current.spools.find(s => s.id === id))
            .filter(Boolean)
            .map(s => `${s!.brand} ${s!.name}`);
          const text = `AMS-Trocknung nach dem Druck gestartet (${plan.temp} °C, ${plan.hours} h)${names.length ? `: ${names.join(', ')}` : ''}.`;
          addSystemLog('drucker', 'Trocknung nach Druck gestartet', text, 'success');
          void raiseAlert({ kind: 'info', key: `dry-after-${plan.armedAt}`, title: 'Trocknung gestartet', text, toast: `☀️ ${text}` }, t => latest.current.notify({ text: t, ok: true }));
        } else {
          restSince.current = Date.now(); // in 1 Minute nochmal
        }
      } finally {
        busy.current = false;
      }
    };
    const id = setInterval(() => void tick(), 15_000);
    return () => clearInterval(id);
  }, [plan.armed, plan.hours, plan.temp, plan.armedAt, plan.spoolIds]);

  return { offer, closeOffer: () => setOffer(null), plan };
}
