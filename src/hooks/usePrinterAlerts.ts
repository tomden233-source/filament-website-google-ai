import { useEffect, useRef } from 'react';
import { localNotify } from '../utils/notify';
import { addSystemLog } from '../utils/logService';
import { useWorkshopSettings } from '../utils/workshopSettings';

// Meldungen aufs Handy, wenn der Drucker selbst etwas Wichtiges meldet:
//  - Druck fertig / fehlgeschlagen (gcode_state wechselt auf FINISH / FAILED)
//  - AMS-Trocknung fertig (Restzeit dry_time geht von >0 auf 0)
// Nur echte Wechsel nach dem ersten Datenpaket zählen, damit beim App-Start keine alte Meldung kommt.

interface Params {
  connected: boolean;
  gcodeState: string | undefined;
  jobName: string | undefined;
  dryMinutesLeft: number;
  showToast: (text: string) => void;
}

const ACTIVE = new Set(['RUNNING', 'PREPARE', 'PAUSE']);

export function usePrinterAlerts({ connected, gcodeState, jobName, dryMinutesLeft, showToast }: Params) {
  const [settings] = useWorkshopSettings();
  const prevState = useRef<string | null>(null);
  const prevDry = useRef<number | null>(null);
  const lastJob = useRef('');

  useEffect(() => {
    if (jobName) lastJob.current = jobName;
  }, [jobName]);

  useEffect(() => {
    if (!connected || !gcodeState) return;
    const prev = prevState.current;
    prevState.current = gcodeState;
    if (!prev || !settings.finishAlert) return;
    if (ACTIVE.has(prev) && gcodeState === 'FINISH') {
      const name = lastJob.current || jobName || 'Druckauftrag';
      const text = `${name} ist fertig.`;
      showToast(`✅ ${text}`);
      void localNotify('Druck fertig', text, { tag: 'print-done' });
      addSystemLog('drucker', 'Druck fertig', text, 'success');
    } else if (ACTIVE.has(prev) && gcodeState === 'FAILED') {
      const name = lastJob.current || jobName || 'Druckauftrag';
      const text = `${name} ist fehlgeschlagen oder wurde abgebrochen.`;
      showToast(`⚠️ ${text}`);
      void localNotify('Druck fehlgeschlagen', text, { tag: 'print-fail' });
      addSystemLog('drucker', 'Druck fehlgeschlagen', text, 'warn');
    }
  }, [connected, gcodeState, jobName, settings.finishAlert, showToast]);

  useEffect(() => {
    if (!connected) {
      prevDry.current = null;
      return;
    }
    const prev = prevDry.current;
    prevDry.current = dryMinutesLeft;
    if (prev !== null && prev > 0 && dryMinutesLeft === 0 && settings.dryReminder) {
      const text = 'Die AMS-Trocknung ist fertig. Filament kann entnommen oder gedruckt werden.';
      showToast(`✅ ${text}`);
      void localNotify('Trocknung fertig', text, { tag: 'dry-done' });
      addSystemLog('spule', 'AMS-Trocknung fertig (Drucker meldet Ende)', text, 'success');
    }
  }, [connected, dryMinutesLeft, settings.dryReminder, showToast]);
}
