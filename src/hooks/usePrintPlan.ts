import { useEffect, useRef } from 'react';
import { printerApi } from '../api/printerApi';
import { addSystemLog } from '../utils/logService';
import { raiseAlert } from '../utils/alerts';
import { jobKey } from '../utils/printUsage';
import { ACTIVE_STATES, parseStartMs } from '../utils/printSession';
import { clearPrintPlan, getPrintPlan, setPrintPlan, usePrintPlan } from '../utils/printPlan';

// Druck-Planer (siehe utils/printPlan.ts):
//  - Neuer Druck (Start oder noch ganz am Anfang) → Fenster „Was soll mit dem Druck passieren?“ (state ask)
//  - Druck verzögern: App pausiert den Druck und setzt ihn zur gewählten Zeit fort
//  - Lief währenddessen die AMS-Trocknung: sie wird beim Fortsetzen beendet, der Rest der Zeit läuft nach dem Druck weiter
//    (außer „Nach Druck aus“ ist gewählt, das gewinnt)
//  - Wird im Fenster nichts gewählt, passiert nichts und der Druck läuft normal

interface Params {
  connected: boolean;
  gcodeState: string | undefined;
  jobName: string | undefined;
  startTime: string | undefined;
  percent: number;
  dryMinutesLeft: number;
  dryTemp: number;
  stopDrying: () => Promise<boolean>;
  /** Trocknung nach dem Druck mit dem Rest der Zeit wieder starten */
  restartDryAfterPrint: (temp: number, minutes: number) => void;
  notify: (t: { text: string; ok: boolean }) => void;
}

const TICK_MS = 10_000;
const CMD_RETRY_MS = 20_000;

export function usePrintPlanRunner(p: Params) {
  const plan = usePrintPlan();
  const latest = useRef(p);
  latest.current = p;
  const lastCmd = useRef(0);
  const busy = useRef(false);

  // --- Neuer Druck / Druck vorbei ---
  useEffect(() => {
    if (!p.connected || !p.gcodeState) return;
    const cur = getPrintPlan();
    const st = p.gcodeState;
    const id = `${jobKey(p.jobName || '') || 'druck'}|${parseStartMs(p.startTime) || 0}`;
    if (ACTIVE_STATES.has(st)) {
      if (cur.jobId === id) return;
      // Anderer Auftrag als der gemerkte: alten Plan verwerfen
      if (cur.jobId && cur.jobId !== id) clearPrintPlan();
      // Nur frische Drucke fragen (Start oder ganz am Anfang), keine mitten im Druck
      if (st === 'PREPARE' || p.percent <= 3) {
        setPrintPlan({ jobId: id, jobName: p.jobName || '', state: 'ask', resumeAt: 0, dryMinLeft: 0, dryTemp: 50, dryWasRunning: false });
      }
      return;
    }
    // Druck vorbei oder abgebrochen: Plan weg. Der Trocknen-Rest wurde schon beim Fortsetzen eingeplant.
    if (cur.jobId && (st === 'FINISH' || st === 'FAILED' || st === 'IDLE')) clearPrintPlan();
  }, [p.connected, p.gcodeState, p.jobName, p.startTime, p.percent]);

  // --- Pausieren, Trocknung merken, zur Zeit fortsetzen ---
  useEffect(() => {
    if (plan.state === 'none') return;
    const tick = async () => {
      const cur = getPrintPlan();
      const q = latest.current;
      if (cur.state === 'none' || busy.current || !q.connected) return;
      // Trocknung merken, solange sie läuft (auch wenn der Drucker sie beim Druckstart selbst beendet)
      if (q.dryMinutesLeft > 0 && (cur.dryMinLeft !== q.dryMinutesLeft || cur.dryTemp !== q.dryTemp)) {
        setPrintPlan({ dryMinLeft: q.dryMinutesLeft, dryTemp: q.dryTemp || cur.dryTemp, dryWasRunning: true });
      }
      if (cur.state !== 'delayed') return;
      const st = q.gcodeState;
      const now = Date.now();
      const due = now >= cur.resumeAt;
      if (!due) {
        // Pause erzwingen, sobald der Druck läuft
        if (st === 'RUNNING' && now - lastCmd.current >= CMD_RETRY_MS) {
          lastCmd.current = now;
          busy.current = true;
          try {
            const res = await printerApi.command('pause');
            if (res.ok && res.data.success) addSystemLog('drucker', 'Druck verzögert: pausiert', cur.jobName, 'info');
          } catch {
            /* nächster Versuch */
          } finally {
            busy.current = false;
          }
        }
        return;
      }
      // Zeit ist da: Trocknung beenden, dann fortsetzen
      if (q.dryMinutesLeft > 0) {
        if (now - lastCmd.current >= CMD_RETRY_MS) {
          lastCmd.current = now;
          busy.current = true;
          try {
            await q.stopDrying();
          } finally {
            busy.current = false;
          }
        }
        return; // erst fortsetzen, wenn die Trocknung aus ist
      }
      if (st === 'PAUSE') {
        if (now - lastCmd.current < CMD_RETRY_MS) return;
        lastCmd.current = now;
        busy.current = true;
        try {
          const res = await printerApi.command('resume');
          if (res.ok && res.data.success) finishResume();
        } catch {
          /* nächster Versuch */
        } finally {
          busy.current = false;
        }
      } else if (st === 'RUNNING' || st === 'PREPARE') {
        finishResume(); // läuft schon (von Hand fortgesetzt)
      }
    };
    const finishResume = () => {
      const cur = getPrintPlan();
      const q = latest.current;
      if (cur.dryWasRunning && cur.dryMinLeft > 0) q.restartDryAfterPrint(cur.dryTemp, cur.dryMinLeft);
      const text = `„${cur.jobName || 'Druck'}“ läuft wieder.${cur.dryWasRunning && cur.dryMinLeft > 0 ? ' Die Trocknung geht nach dem Druck mit der Restzeit weiter.' : ''}`;
      addSystemLog('drucker', 'Verzögerter Druck fortgesetzt', text, 'success');
      void raiseAlert({ kind: 'info', key: `print-delay-${cur.jobId}-${cur.resumeAt}`, title: 'Druck fortgesetzt', text, toast: `▶️ ${text}` }, t => latest.current.notify({ text: t, ok: true }));
      setPrintPlan({ state: 'none', resumeAt: 0 });
    };
    const id = setInterval(() => void tick(), TICK_MS);
    void tick();
    return () => clearInterval(id);
  }, [plan.state, plan.jobId, plan.resumeAt]);

  return plan;
}
