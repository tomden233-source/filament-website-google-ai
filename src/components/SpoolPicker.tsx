import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, Nfc, ChevronDown, Ban } from 'lucide-react';
import type { Spool } from '../types/filament';
import { baseMaterial, colorDistance } from '../utils/amsMatch';

// Eine Spulen-Suche für die ganze App (statt langer Auswahllisten): tippen, antippen, fertig.
// NFC-Symbol: grün = Tag beschrieben, grau = noch kein Tag.

interface PickerProps {
  spools: Spool[];
  title?: string;
  selectedId?: string;
  /** Passende Spulen zuerst (z. B. Material/Farbe laut Drucker) */
  hint?: { material?: string; colorHex?: string };
  /** „Keine Spule“ anbieten (leert die Zuweisung) */
  allowClear?: boolean;
  onPick: (spool: Spool | null) => void;
  onClose: () => void;
}

const norm = (s: string) => s.toLowerCase();

export const SpoolPicker: React.FC<PickerProps> = ({ spools, title = 'Spule wählen', selectedId, hint, allowClear, onPick, onClose }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, []);

  const list = useMemo(() => {
    const words = norm(query.trim()).split(/\s+/).filter(Boolean);
    let out = spools.filter(s => {
      if (!words.length) return true;
      const hay = norm(`${s.brand} ${s.name} ${s.material} ${s.colorName} ${s.location || ''}`);
      return words.every(w => hay.includes(w));
    });
    if (hint?.material || hint?.colorHex) {
      const score = (s: Spool) => {
        let d = 0;
        if (hint.material) d += baseMaterial(s.material) === baseMaterial(hint.material) ? 0 : 1000;
        if (hint.colorHex) d += colorDistance(s.colorHex || '#888888', hint.colorHex);
        return d;
      };
      out = [...out].sort((a, b) => score(a) - score(b));
    }
    return out;
  }, [spools, query, hint?.material, hint?.colorHex]);

  const card = { backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' };

  return (
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4">
      <div
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl border"
        style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
          <h3 className="font-extrabold text-sm">{title}</h3>
          <button onClick={onClose} aria-label="Schließen" className="p-1.5 rounded-lg border cursor-pointer" style={{ borderColor: 'var(--app-border)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-text-muted)' }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Marke, Farbe, Material …"
              className="w-full pl-9 pr-3 py-2.5 rounded-2xl border text-sm outline-none focus:ring-2"
              style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
            />
          </div>
        </div>

        <div className="px-3 pb-4 overflow-y-auto space-y-1.5">
          {allowClear && (
            <button
              onClick={() => onPick(null)}
              className="w-full flex items-center gap-2.5 p-2 rounded-2xl border text-left cursor-pointer text-xs font-bold"
              style={card}
            >
              <span className="w-7 h-7 rounded-full border border-dashed flex items-center justify-center" style={{ borderColor: 'var(--app-border)' }}>
                <Ban className="w-3.5 h-3.5" style={{ color: 'var(--app-text-muted)' }} />
              </span>
              Keine Spule
            </button>
          )}
          {list.length === 0 && (
            <div className="text-xs text-center py-6" style={{ color: 'var(--app-text-muted)' }}>
              Keine Spule gefunden.
            </div>
          )}
          {list.map(s => {
            const on = s.id === selectedId;
            return (
              <button
                key={s.id}
                onClick={() => onPick(s)}
                className="w-full flex items-center gap-2.5 p-2 rounded-2xl border text-left cursor-pointer active:scale-[0.99] transition"
                style={on ? { backgroundColor: 'var(--app-accent-sub)', borderColor: 'var(--app-accent)' } : card}
              >
                <span className="w-7 h-7 rounded-full border-2 border-white/60 shadow-sm shrink-0" style={{ backgroundColor: s.colorHex }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-extrabold truncate">
                    {s.brand} {s.name}
                  </span>
                  <span className="block text-[10px] truncate" style={{ color: 'var(--app-text-muted)' }}>
                    {s.material} · {s.colorName} · {s.remainingWeight} g{s.location ? ` · ${s.location}` : ''}
                  </span>
                </span>
                <Nfc
                  className="w-4 h-4 shrink-0"
                  style={{ color: s.nfcWritten ? '#22c55e' : 'var(--app-text-muted)', opacity: s.nfcWritten ? 1 : 0.45 }}
                  aria-label={s.nfcWritten ? 'NFC-Tag beschrieben' : 'Noch kein NFC-Tag'}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface SelectProps {
  spools: Spool[];
  value: string;
  onChange: (id: string) => void;
  title?: string;
  hint?: { material?: string; colorHex?: string };
  allowClear?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/** Sieht aus wie eine Auswahlliste, öffnet aber die Spulen-Suche */
export const SpoolSelect: React.FC<SelectProps> = ({ spools, value, onChange, title, hint, allowClear, disabled, placeholder = 'Spule wählen', className = '' }) => {
  const [open, setOpen] = useState(false);
  const cur = spools.find(s => s.id === value);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={e => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-[11px] text-left cursor-pointer disabled:opacity-50 min-w-0 ${className}`}
        style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
      >
        {cur ? (
          <span className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: cur.colorHex }} />
        ) : (
          <span className="w-3.5 h-3.5 rounded-full border border-dashed shrink-0" style={{ borderColor: 'var(--app-border)' }} />
        )}
        <span className="flex-1 truncate font-bold">{cur ? `${cur.brand} ${cur.name}` : placeholder}</span>
        {cur && <span className="shrink-0" style={{ color: 'var(--app-text-muted)' }}>{cur.remainingWeight} g</span>}
        <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--app-text-muted)' }} />
      </button>
      {open && (
        <SpoolPicker
          spools={spools}
          title={title}
          selectedId={value}
          hint={hint}
          allowClear={allowClear}
          onClose={() => setOpen(false)}
          onPick={s => {
            setOpen(false);
            onChange(s ? s.id : '');
          }}
        />
      )}
    </>
  );
};
