import { useEffect, useState } from 'react';

// Gemeinsamer Zeit-Ticker. Nur die Teile, die wirklich jede Sekunde neu zeichnen müssen (Countdown),
// nutzen 1000 ms. Die ganze App tickt nur noch einmal pro Minute (vorher jede Sekunde komplett neu gezeichnet).
const tickers = new Map<number, { now: number; subs: Set<(n: number) => void>; id: ReturnType<typeof setInterval> | null }>();

function subscribe(ms: number, cb: (n: number) => void): () => void {
  let t = tickers.get(ms);
  if (!t) {
    t = { now: Date.now(), subs: new Set(), id: null };
    tickers.set(ms, t);
  }
  t.subs.add(cb);
  if (!t.id) {
    const tk = t;
    tk.id = setInterval(() => {
      tk.now = Date.now();
      tk.subs.forEach(s => s(tk.now));
    }, ms);
  }
  return () => {
    const tk = tickers.get(ms);
    if (!tk) return;
    tk.subs.delete(cb);
    if (!tk.subs.size && tk.id) {
      clearInterval(tk.id);
      tk.id = null;
    }
  };
}

/** Aktuelle Zeit, aktualisiert alle `ms` Millisekunden */
export function useNow(ms = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    return subscribe(ms, setNow);
  }, [ms]);
  return now;
}
