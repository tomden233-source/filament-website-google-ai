import { useEffect, useRef } from 'react';
import { toggleHaSwitch } from '../utils/haClient';
import { raiseAlert } from '../utils/alerts';
import { addSystemLog } from '../utils/logService';
import { disarmAutoOff, useAutoOff } from '../utils/autoPowerOff';
import { ACTIVE_STATES } from '../utils/printSession';
import { jobKey } from '../utils/printUsage';

// „Nach dem Druck ausschalten“: Wenn der Drucker „fertig“ meldet, wartet die App, bis die Düse abgekühlt ist
// (sonst steht der Hotend-Lüfter still, solange die Düse heiß ist), und schaltet dann die Steckdose über Home Assistant aus.
//  - Fertig muss mind. 1 Minute anliegen (keine Fehlauslösung durch kurze Datenfehler)
//  - Düse unter 60 °C, spätestens nach 20 Minuten wird trotzdem ausgeschaltet
//  - Druck fehlgeschlagen/abgebrochen: nicht ausschalten (du willst evtl. nachsehen), nur Meldung
//  - Trocknung läuft oder ist „nach dem Druck“ geplant: erst danach ausschalten
// Läuft auf jedem Gerät, auf dem die App offen ist (Android: auch im Hintergrund mit Hintergrund-Dienst).

interface Params {
  connected: boolean;
  gcodeState: string | undefined;
  jobName: string | undefined;
  nozzleTemps: number[];
  switchState: 'on' | 'off' | 'unknown' | 'error';
  refreshSwitch: () => void;
  notify: (t: { text: string; ok: boolean }) => void;
  /** Noch nicht ausschalten (z. B. Trocknung läuft oder ist nach dem Druck geplant) */
  hold?: boolean;
}

const COOL_C = 60;
const MIN_FINISH_MS = 60_000;
const MAX_WAIT_MS = 20 * 60_000;
const TICK_MS = 10_000;

export function useAutoPowerOff(p: Params) {
  const auto = useAutoOff();
  const latest = useRef(p);
  latest.current = p;
  const finishSince = useRef<number | null>(null);
  const busy = useRef(false);
  const fails = useRef(0);

  // Zustand des Druckers auswerten
  useEffect(() => {
    if (!auto.armed || !p.connected || !p.gcodeState) return;
    const st = p.gcodeState;
    if (st === 'FINISH') {
      if (finishSince.current === null) finishSince.current = Date.now();
      return;
    }
    finishSince.current = null;
    if (st === 'FAILED') {
      disarmAutoOff();
      const text = `„${auto.jobName || 'Druck'}“ ist fehlgeschlagen. Der Drucker bleibt an, damit du nachsehen kannst.`;
      void raiseAlert({ kind: 'info', key: `auto-off-fail-${auto.armedAt}`, title: 'Nicht ausgeschaltet', text, toast: `⚠️ ${text}` }, t => latest.current.notify({ text: t, ok: false }));
      return;
    }
    // Ein anderer Druck läuft: Schalter galt für den alten
    if (ACTIVE_STATES.has(st) && p.jobName && auto.jobName && jobKey(p.jobName) !== jobKey(auto.jobName)) disarmAutoOff();
  }, [auto.armed, auto.jobName, auto.armedAt, p.connected, p.gcodeState, p.jobName]);

  // Steckdose ist schon aus (z. B. hat Home Assistant ausgeschaltet): nichts mehr zu tun
  useEffect(() => {
    if (!auto.armed || p.switchState !== 'off') return;
    // Nach dem Wählen war die Steckdose an (sonst kein Druck). Jetzt aus: erledigt.
    if (Date.now() - auto.armedAt < 30_000) return;
    disarmAutoOff();
    const text = `Nach „${auto.jobName || 'Druck'}“ ist der Drucker aus.`;
    void raiseAlert({ kind: 'info', key: `auto-off-${auto.armedAt}`, title: 'Drucker ausgeschaltet', text, toast: `🔌 ${text}` }, t => latest.current.notify({ text: t, ok: true }));
  }, [auto.armed, p.switchState]);

  // Regelmäßig prüfen, ob abgekühlt
  useEffect(() => {
    if (!auto.armed) {
      fails.current = 0;
      return;
    }
    const tick = async () => {
      const since = finishSince.current;
      if (since === null || busy.current) return;
      if (latest.current.hold) {
        finishSince.current = Date.now(); // nach der Trocknung erst wieder 1 Minute warten
        return;
      }
      const waited = Date.now() - since;
      if (waited < MIN_FINISH_MS) return;
      const temps = latest.current.nozzleTemps.filter(t => Number.isFinite(t) && t > 0);
      const hot = temps.length ? Math.max(...temps) : 0;
      if (hot >= COOL_C && waited < MAX_WAIT_MS) return;

      busy.current = true;
      try {
        const res = await toggleHaSwitch('off');
        if (res.success) {
          disarmAutoOff();
          finishSince.current = null;
          const text = `Nach „${auto.jobName || 'Druck'}“ automatisch ausgeschaltet${hot ? ` (Düse ${Math.round(hot)} °C)` : ''}.`;
          addSystemLog('steckdose', 'Drucker nach Druck ausgeschaltet', text, 'success');
          void raiseAlert({ kind: 'info', key: `auto-off-${auto.armedAt}`, title: 'Drucker ausgeschaltet', text, toast: `🔌 ${text}` }, t => latest.current.notify({ text: t, ok: true }));
          setTimeout(() => latest.current.refreshSwitch(), 800);
        } else if (++fails.current >= 4) {
          disarmAutoOff();
          const text = `Ausschalten hat nicht geklappt (Home Assistant: ${res.message || 'keine Antwort'}). Bitte selbst ausschalten.`;
          addSystemLog('steckdose', 'Auto-Aus fehlgeschlagen', text, 'error');
          void raiseAlert({ kind: 'info', key: `auto-off-err-${auto.armedAt}`, title: 'Ausschalten fehlgeschlagen', text, toast: `⚠️ ${text}` }, t => latest.current.notify({ text: t, ok: false }));
        }
      } catch {
        fails.current++;
      } finally {
        busy.current = false;
      }
    };
    const id = setInterval(() => void tick(), TICK_MS);
    void tick();
    return () => clearInterval(id);
  }, [auto.armed, auto.jobName, auto.armedAt]);

  return auto;
}
