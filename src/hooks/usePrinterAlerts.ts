import { useEffect, useRef } from 'react';
import type { Spool } from '../types/filament';
import { raiseAlert } from '../utils/alerts';
import { safeStorage } from '../utils/safeStorage';
import { useWorkshopSettings } from '../utils/workshopSettings';

// Mitteilungen, wenn der Drucker selbst etwas Wichtiges meldet:
//  - Druck fertig / fehlgeschlagen (gcode_state wechselt auf FINISH / FAILED)
//  - AMS-Trocknung fertig (Restzeit dry_time geht von >0 auf 0)
// Nur echte Wechsel nach dem ersten Datenpaket zählen, damit beim App-Start keine alte Meldung kommt.

interface Params {
  connected: boolean;
  gcodeState: string | undefined;
  jobName: string | undefined;
  dryMinutesLeft: number;
  spools?: Spool[];
  showToast: (text: string) => void;
}

const ACTIVE = new Set(['RUNNING', 'PREPARE', 'PAUSE']);
const AMS_SLOTS_KEY = 'filamenthub_ams_slots_x2d';

const nowText = () => new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' Uhr';

export function usePrinterAlerts({ connected, gcodeState, jobName, dryMinutesLeft, spools, showToast }: Params) {
  const [settings] = useWorkshopSettings();
  const prevState = useRef<string | null>(null);
  const prevDry = useRef<number | null>(null);
  const lastJob = useRef('');
  const startedAt = useRef<number | null>(null);
  const latest = useRef({ spools });
  latest.current = { spools };

  useEffect(() => {
    if (jobName) lastJob.current = jobName;
  }, [jobName]);

  useEffect(() => {
    if (!connected || !gcodeState) return;
    const prev = prevState.current;
    prevState.current = gcodeState;
    if (gcodeState === 'RUNNING' && startedAt.current === null) startedAt.current = Date.now();
    if (!prev) return;
    const finished = ACTIVE.has(prev) && (gcodeState === 'FINISH' || gcodeState === 'FAILED');
    if (!finished) return;
    const name = lastJob.current || jobName || 'Druckauftrag';
    const mins = startedAt.current ? Math.round((Date.now() - startedAt.current) / 60000) : 0;
    startedAt.current = null;
    const facts = [
      { label: 'Auftrag', value: name },
      { label: 'Beendet', value: nowText() },
      ...(mins > 0 ? [{ label: 'Dauer (seit App-Start gesehen)', value: mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min` }] : [])
    ];
    if (gcodeState === 'FINISH') {
      const text = `${name} ist fertig.`;
      void raiseAlert({ kind: 'print-done', title: 'Druck fertig', text, toast: `✅ ${text}`, facts }, showToast);
    } else {
      const text = `${name} ist fehlgeschlagen oder wurde abgebrochen.`;
      void raiseAlert({ kind: 'print-fail', title: 'Druck fehlgeschlagen', text, toast: `⚠️ ${text}`, facts }, showToast);
    }
  }, [connected, gcodeState, jobName, showToast]);

  useEffect(() => {
    if (!connected) {
      prevDry.current = null;
      return;
    }
    const prev = prevDry.current;
    prevDry.current = dryMinutesLeft;
    if (prev !== null && prev > 0 && dryMinutesLeft === 0) {
      const text = 'Die AMS-Trocknung ist fertig. Filament kann entnommen oder gedruckt werden.';
      const dried: { title: string; sub: string; color?: string }[] = [];
      try {
        const slots: Record<string, string> = JSON.parse(safeStorage.getItem(AMS_SLOTS_KEY) || '{}');
        Object.entries(slots).forEach(([slot, id]) => {
          const sp = latest.current.spools?.find(x => x.id === id);
          if (sp) dried.push({ title: `${sp.brand} ${sp.name}`, sub: `Slot ${slot} · ${sp.material}`, color: sp.colorHex });
        });
      } catch {
        /* keine Zuordnung */
      }
      void raiseAlert(
        { kind: 'dry-done', title: 'Trocknung fertig', text, toast: `✅ ${text}`, facts: [{ label: 'Fertig seit', value: nowText() }], items: dried },
        showToast
      );
    }
  }, [connected, dryMinutesLeft, showToast]);

  // Einstellungen werden in raiseAlert geprüft; hier nur, damit der Hook bei Änderungen neu rendert
  void settings;
}
