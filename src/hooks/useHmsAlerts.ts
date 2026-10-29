import { useEffect, useRef } from 'react';
import { raiseAlert } from '../utils/alerts';
import { HMS_HELP_URL, hmsCode, hmsModule, hmsSeverity, hmsText, printErrorCode, printErrorText, type HmsEntry } from '../utils/hms';
import { safeStorage } from '../utils/safeStorage';

// Fehler-Mitteilungen: jede neue HMS-Meldung und jeder Druckfehler geht als Klartext aufs Handy
// (z. B. Düse verstopft, Spaghetti erkannt, AMS-Problem). Ersatz für die Meldungen aus Bambu Studio / Handy-App.
//  - gleiche Meldung nicht doppelt: erst wieder, wenn sie weg war und nach 10 Minuten neu kommt
//  - beim App-Start: noch anstehende Meldungen nur, wenn sie in den letzten 6 Stunden nicht schon kamen

interface Params {
  connected: boolean;
  hms: HmsEntry[] | undefined;
  printError: number | undefined;
  jobName: string | undefined;
  showToast?: (t: string) => void;
}

const KEY = 'filamenthub_hms_alerted_v1';
const AGAIN_MS = 10 * 60_000;
const START_MS = 6 * 3600_000;
/** Abbruch durch dich (kommt schon als „Druck fehlgeschlagen/abgebrochen“) */
const CANCELED = 0x0300400c;
/** „MQTT command verification failed“: Antwort auf App-Befehle, wird dort angezeigt */
const IGNORE_HMS = new Set(['0500_0500_0001_0007']);

function readMap(): Record<string, number> {
  try {
    const v = JSON.parse(safeStorage.getItem(KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function remember(code: string): void {
  const m = readMap();
  m[code] = Date.now();
  const entries = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 80);
  safeStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
}

export function useHmsAlerts(p: Params) {
  const prev = useRef<Set<string> | null>(null);
  const prevErr = useRef<number | null>(null);
  const latest = useRef(p);
  latest.current = p;

  const hmsKey = (p.hms || []).map(hmsCode).sort().join(',');

  useEffect(() => {
    if (!p.connected) {
      prev.current = null;
      return;
    }
    const list = (latest.current.hms || []).filter(h => !IGNORE_HMS.has(hmsCode(h)));
    const now = Date.now();
    const first = prev.current === null;
    const current = new Set(list.map(hmsCode));
    const map = readMap();
    list.forEach(h => {
      const code = hmsCode(h);
      if (!first && prev.current!.has(code)) return; // steht schon an
      const last = map[code] || 0;
      if (now - last < (first ? START_MS : AGAIN_MS)) return;
      remember(code);
      void (async () => {
        const sev = hmsSeverity(h);
        const text = (await hmsText(h)) || `Unbekannte Meldung ${code}. Details im Bambu-Wiki.`;
        const job = latest.current.jobName;
        void raiseAlert(
          {
            kind: 'printer-error',
            key: `hms-${code}-${now}`,
            title: sev.level === 4 ? 'Drucker-Hinweis' : 'Druckerfehler',
            text,
            toast: `⚠️ ${text}`,
            facts: [
              { label: 'Bereich', value: hmsModule(h) },
              { label: 'Stufe', value: sev.text },
              { label: 'Code', value: code },
              ...(job ? [{ label: 'Auftrag', value: job }] : []),
              { label: 'Hilfe', value: HMS_HELP_URL }
            ]
          },
          latest.current.showToast
        );
      })();
    });
    prev.current = current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.connected, hmsKey]);

  useEffect(() => {
    if (!p.connected) {
      prevErr.current = null;
      return;
    }
    const err = Number(p.printError) || 0;
    const before = prevErr.current;
    prevErr.current = err;
    if (!err || err === before || err === CANCELED) return;
    const code = printErrorCode(err);
    const map = readMap();
    if (Date.now() - (map[code] || 0) < (before === null ? START_MS : AGAIN_MS)) return;
    remember(code);
    void (async () => {
      const text = (await printErrorText(err)) || `Druckfehler ${code}.`;
      const job = latest.current.jobName;
      void raiseAlert(
        {
          kind: 'printer-error',
          key: `perr-${code}-${Date.now()}`,
          title: 'Druckerfehler',
          text,
          toast: `⚠️ ${text}`,
          facts: [{ label: 'Code', value: code }, ...(job ? [{ label: 'Auftrag', value: job }] : []), { label: 'Hilfe', value: HMS_HELP_URL }]
        },
        latest.current.showToast
      );
    })();
  }, [p.connected, p.printError]);
}
