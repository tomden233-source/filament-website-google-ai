import React, { useEffect, useRef, useState } from 'react';
import { Printer, Loader2, Check } from 'lucide-react';
import type { Spool } from '../types/filament';
import { printSpoolLabel, usePrinter } from '../utils/supvan/service';

// Kleiner Knopf: Etikett für diese Spule drucken (verbindet den Etiketten-Drucker bei Bedarf selbst).

interface Props {
  spool: Spool;
  /** nur Symbol */
  compact?: boolean;
  className?: string;
}

export const LabelPrintButton: React.FC<Props> = ({ spool, compact, className = '' }) => {
  const st = usePrinter();
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle');
  const [msg, setMsg] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const flash = (s: 'ok' | 'err', text: string) => {
    setState(s);
    setMsg(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setState('idle');
      setMsg('');
    }, s === 'ok' ? 2200 : 6000);
  };

  const run = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (state === 'busy') return;
    setState('busy');
    try {
      flash('ok', await printSpoolLabel(spool));
    } catch (err) {
      flash('err', (err as Error).message || 'Drucken fehlgeschlagen.');
    }
  };

  const busy = state === 'busy' || st.phase === 'printing' || st.phase === 'connecting';
  const Icon = busy ? Loader2 : state === 'ok' ? Check : Printer;

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        title="Etikett drucken"
        aria-label="Etikett drucken"
        className={`${compact ? 'p-1.5' : 'px-2.5 py-1.5 gap-1'} rounded-lg border text-[11px] font-bold cursor-pointer inline-flex items-center justify-center disabled:opacity-60 ${className}`}
        style={{
          backgroundColor: state === 'ok' ? 'rgba(16,185,129,0.12)' : 'var(--app-card-sub)',
          borderColor: state === 'ok' ? 'rgba(16,185,129,0.4)' : 'var(--app-border)',
          color: state === 'ok' ? '#10b981' : 'var(--app-text)'
        }}
      >
        <Icon className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
        {!compact && <span>Etikett</span>}
      </button>
      {state === 'err' && msg && (
        <span
          role="alert"
          className="absolute right-0 top-full mt-1 z-[80] w-52 rounded-lg border border-rose-500/40 bg-rose-500/15 backdrop-blur px-2 py-1.5 text-[10px] font-bold text-rose-400 shadow-lg"
        >
          {msg}
        </span>
      )}
    </span>
  );
};
