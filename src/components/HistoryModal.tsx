import React, { useCallback, useEffect, useState } from 'react';
import { X, Undo2, Printer, RefreshCw, Loader2, Clock } from 'lucide-react';
import { HistoryEntry } from '../types/filament';
import { printerApi, type PrintTask } from '../api/printerApi';

// Verlauf: links die echten Drucke vom Drucker (Bambu Cloud), rechts die Abzüge von deinen Spulen (rückgängig machbar).

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  onUndoEntry: (id: string) => void;
}

const fmtDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const fmtDuration = (sec?: number) => {
  if (!sec || sec <= 0) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
};

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, history, onUndoEntry }) => {
  const [tab, setTab] = useState<'prints' | 'deductions'>('prints');
  const [tasks, setTasks] = useState<PrintTask[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await printerApi.tasks(30);
      if (res.ok && res.data?.tasks) setTasks(res.data.tasks);
      else setError(res.data?.error || 'Drucke konnten nicht geladen werden. Ist der Drucker verbunden?');
    } catch {
      setError('Drucke konnten nicht geladen werden.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen && tasks === null) void load();
  }, [isOpen, tasks, load]);

  if (!isOpen) return null;

  const box = { backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' };
  const muted = { color: 'var(--app-text-muted)' };

  const tabBtn = (id: 'prints' | 'deductions', label: string, count?: number) => (
    <button
      onClick={() => setTab(id)}
      className="flex-1 py-2 rounded-xl text-xs font-extrabold cursor-pointer transition"
      style={tab === id ? { backgroundColor: 'var(--app-accent)', color: '#fff' } : { backgroundColor: 'var(--app-card-sub)', color: 'var(--app-text-muted)' }}
    >
      {label}
      {count !== undefined ? ` (${count})` : ''}
    </button>
  );

  return (
    <div
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div
        className="border rounded-2xl max-w-md w-full p-4 space-y-3 shadow-2xl"
        style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
      >
        <div className="flex justify-between items-center gap-2">
          <h3 className="text-base font-extrabold">Verlauf</h3>
          <div className="flex items-center gap-1.5">
            {tab === 'prints' && (
              <button
                onClick={() => void load()}
                disabled={loading}
                aria-label="Neu laden"
                className="p-1.5 rounded-lg border cursor-pointer disabled:opacity-50"
                style={{ borderColor: 'var(--app-border)' }}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button onClick={onClose} aria-label="Schließen" className="p-1.5 rounded-lg border cursor-pointer" style={{ borderColor: 'var(--app-border)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          {tabBtn('prints', 'Drucke', tasks?.length)}
          {tabBtn('deductions', 'Abzüge', history.length)}
        </div>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {tab === 'prints' && (
            <>
              {loading && tasks === null && (
                <div className="flex items-center justify-center gap-2 py-8 text-xs" style={muted}>
                  <Loader2 className="w-4 h-4 animate-spin" /> Lade Drucke …
                </div>
              )}
              {error && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-500 p-3 text-xs font-bold">{error}</div>
              )}
              {tasks && tasks.length === 0 && !error && (
                <p className="text-xs text-center py-6" style={muted}>
                  Noch keine Drucke gefunden.
                </p>
              )}
              {tasks?.map(t => (
                <div key={t.id} className="p-2.5 border rounded-xl text-xs flex items-center gap-2.5" style={box}>
                  {t.cover ? (
                    <img src={t.cover} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0 border" style={{ borderColor: 'var(--app-border)' }} />
                  ) : (
                    <span className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 border" style={{ borderColor: 'var(--app-border)' }}>
                      <Printer className="w-5 h-5" style={muted} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate">{t.title || 'Druck'}</p>
                    <p className="text-[10px] flex items-center gap-1.5 flex-wrap" style={muted}>
                      <span>{fmtDate(t.endTime || t.startTime)}</span>
                      {fmtDuration(t.costTime) && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {fmtDuration(t.costTime)}
                        </span>
                      )}
                      <span className={t.status === 2 ? 'text-emerald-500 font-bold' : 'text-rose-400 font-bold'}>{t.status === 2 ? 'fertig' : 'abgebrochen'}</span>
                    </p>
                    {t.filaments?.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        {t.filaments.map((f, i) => (
                          <span key={i} className="flex items-center gap-0.5 text-[10px]" style={muted}>
                            <span className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ backgroundColor: f.colorHex }} />
                            {Math.round(f.grams)} g
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="font-mono-num font-extrabold text-orange-400 shrink-0">{Math.round(t.totalGrams)} g</span>
                </div>
              ))}
            </>
          )}

          {tab === 'deductions' &&
            (history.length === 0 ? (
              <p className="text-xs text-center py-6" style={muted}>
                Noch keine Abzüge. Unter „Druckverbrauch“ am Drucker kannst du Gramm von Spulen abziehen.
              </p>
            ) : (
              history.map(item => (
                <div key={item.id} className="p-2.5 border rounded-xl text-xs flex justify-between items-center gap-2" style={box}>
                  <div className="min-w-0">
                    <p className="font-bold truncate">{item.spoolLabel}</p>
                    <p className="text-[10px]" style={muted}>
                      {new Date(item.timestamp).toLocaleString('de-DE')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-orange-400 font-mono-num font-bold">-{item.grams}g</span>
                    <button
                      onClick={() => onUndoEntry(item.id)}
                      title="Diesen Abzug rückgängig machen"
                      className="p-1.5 rounded-lg border flex items-center gap-1 text-[11px] cursor-pointer"
                      style={{ borderColor: 'var(--app-border)' }}
                    >
                      <Undo2 className="w-3.5 h-3.5" style={{ color: 'var(--app-accent)' }} />
                      <span>Zurück</span>
                    </button>
                  </div>
                </div>
              ))
            ))}
        </div>
      </div>
    </div>
  );
};
