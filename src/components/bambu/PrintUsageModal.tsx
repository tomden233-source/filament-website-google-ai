import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, RefreshCw, Check, Scale } from 'lucide-react';
import { printerApi, type PrintTask } from '../../api/printerApi';
import type { Spool } from '../../types/filament';
import { safeStorage } from '../../utils/safeStorage';

// Letzte Druckaufträge aus der Bambu Cloud mit Verbrauch pro Farbe. Ein Tipp zieht die Gramm von der passenden Spule ab.
// Bereits abgezogene Aufträge werden gemerkt, damit nichts doppelt abgezogen wird.

const DONE_KEY = 'bambu_tasks_deducted';

interface Props {
  spools: Spool[];
  onDeductWeight: (spoolId: string, grams: number) => void;
  onClose: () => void;
}

function readDone(): string[] {
  try {
    return JSON.parse(safeStorage.getItem(DONE_KEY) || '[]');
  } catch {
    return [];
  }
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').padEnd(6, '0');
  return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
}

function bestSpool(spools: Spool[], material: string, colorHex: string): string {
  const same = spools.filter(s => s.material?.toLowerCase() === material.toLowerCase());
  const pool = same.length ? same : spools;
  const [r, g, b] = rgb(colorHex);
  let best = '';
  let bestD = Infinity;
  for (const s of pool) {
    const [r2, g2, b2] = rgb(s.colorHex || '#888888');
    const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
    if (d < bestD) {
      bestD = d;
      best = s.id;
    }
  }
  return best;
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export const PrintUsageModal: React.FC<Props> = ({ spools, onDeductWeight, onClose }) => {
  const [tasks, setTasks] = useState<PrintTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>(readDone);
  const [choice, setChoice] = useState<Record<string, string>>({});
  // Immer die neueste Abzugsfunktion nutzen, sonst überschreibt der zweite Abzug den ersten (veralteter Spulenstand)
  const deductRef = useRef(onDeductWeight);
  deductRef.current = onDeductWeight;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await printerApi.tasks(15);
      if (res.ok && res.data?.tasks) setTasks(res.data.tasks);
      else setError(res.data?.error || 'Aufträge konnten nicht geladen werden. Ist der Drucker verbunden (Token)?');
    } catch {
      setError('Aufträge konnten nicht geladen werden.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pick = (key: string, material: string, colorHex: string) => choice[key] || bestSpool(spools, material, colorHex);

  const deduct = (task: PrintTask) => {
    const perSpool = new Map<string, number>();
    task.filaments.forEach((f, i) => {
      const id = pick(`${task.id}:${i}`, f.material, f.colorHex);
      if (id && f.grams > 0) perSpool.set(id, (perSpool.get(id) || 0) + f.grams);
    });
    Array.from(perSpool.entries()).forEach(([id, grams], n) => {
      setTimeout(() => deductRef.current(id, Math.round(grams)), n * 250);
    });
    const next = [...done, task.id];
    setDone(next);
    safeStorage.setItem(DONE_KEY, JSON.stringify(next.slice(-200)));
  };

  const sorted = useMemo(() => tasks, [tasks]);

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
      <div
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border p-4 space-y-3"
        style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-extrabold text-sm flex items-center gap-2">
            <Scale className="w-4 h-4" style={{ color: 'var(--app-accent)' }} />
            Druck-Verbrauch
          </h3>
          <div className="flex items-center gap-1">
            <button onClick={load} aria-label="Neu laden" className="p-1.5 rounded-lg border cursor-pointer" style={{ borderColor: 'var(--app-border)' }}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} aria-label="Schließen" className="p-1.5 rounded-lg border cursor-pointer" style={{ borderColor: 'var(--app-border)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
          Letzte Aufträge aus deiner Bambu Cloud. Die Gramm sind die Schätzung des Slicers, bei abgebrochenen Drucken ist der echte Verbrauch kleiner.
        </p>

        {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">{error}</div>}
        {!error && !loading && sorted.length === 0 && (
          <div className="text-xs text-center py-6" style={{ color: 'var(--app-text-muted)' }}>Keine Aufträge gefunden.</div>
        )}

        {sorted.map(task => {
          const isDone = done.includes(task.id);
          return (
            <div key={task.id} className="rounded-2xl border p-3 space-y-2" style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-extrabold break-words">{task.title}</div>
                  <div className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                    {fmtDate(task.endTime || task.startTime)} • {task.status === 2 ? 'fertig' : 'abgebrochen'}
                  </div>
                </div>
                <div className="font-mono-num text-xs font-extrabold shrink-0">{task.totalGrams} g</div>
              </div>

              {task.filaments.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: f.colorHex }} />
                  <span className="text-[11px] font-mono-num font-bold w-14 shrink-0">{f.grams} g</span>
                  <select
                    disabled={isDone}
                    value={pick(`${task.id}:${i}`, f.material, f.colorHex)}
                    onChange={e => setChoice(c => ({ ...c, [`${task.id}:${i}`]: e.target.value }))}
                    className="flex-1 min-w-0 px-2 py-1 rounded-lg text-[11px] border outline-none"
                    style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                  >
                    {spools.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.brand} {s.name} ({s.remainingWeight} g)
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              {task.filaments.length > 0 && (
                <button
                  disabled={isDone}
                  onClick={() => deduct(task)}
                  className={`w-full py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                    isDone ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' : 'text-white'
                  }`}
                  style={isDone ? undefined : { backgroundColor: 'var(--app-accent)' }}
                >
                  {isDone ? <><Check className="w-3.5 h-3.5" /> Schon abgezogen</> : 'Von Spule(n) abziehen'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
