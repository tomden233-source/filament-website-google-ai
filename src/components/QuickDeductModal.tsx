import React, { useState, useMemo } from 'react';
import { X, Minus, Search } from 'lucide-react';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { Spool } from '../types/filament';

interface QuickDeductModalProps {
  isOpen: boolean;
  onClose: () => void;
  spools: Spool[];
  onDeductWeight: (spoolId: string, grams: number) => void;
  onAddWeight?: (spoolId: string, grams: number) => void;
}

export const QuickDeductModal: React.FC<QuickDeductModalProps> = ({
  isOpen,
  onClose,
  spools,
  onDeductWeight,
  onAddWeight
}) => {
  useEscapeClose(onClose, isOpen);
  const [selectedSpoolId, setSelectedSpoolId] = useState<string>(spools[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [gramsInput, setGramsInput] = useState<string>('50');
  const [actionType] = useState<'deduct' | 'add'>('deduct');

  const filteredSpools = useMemo(() => {
    if (!searchQuery.trim()) return spools;
    const q = searchQuery.toLowerCase();
    return spools.filter(s =>
      `${s.brand} ${s.name} ${s.material} ${s.colorName}`.toLowerCase().includes(q)
    );
  }, [spools, searchQuery]);

  if (!isOpen) return null;

  const activeSpool = spools.find(s => s.id === selectedSpoolId) || filteredSpools[0] || spools[0];
  const gramsAmount = Math.max(0, parseInt(gramsInput) || 0);
  const remainingAfter = activeSpool
    ? actionType === 'deduct'
      ? Math.max(0, activeSpool.remainingWeight - gramsAmount)
      : activeSpool.remainingWeight + gramsAmount
    : 0;

  const handleApply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeSpool || gramsAmount <= 0) return;
    if (actionType === 'deduct') {
      onDeductWeight(activeSpool.id, gramsAmount);
    } else {
      if (onAddWeight) {
        onAddWeight(activeSpool.id, gramsAmount);
      } else {
        onDeductWeight(activeSpool.id, -gramsAmount);
      }
    }
    onClose();
  };

  return (
    <div
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 overflow-y-auto"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl border shadow-2xl p-5 space-y-4 max-h-[90vh] flex flex-col"
        style={{
          backgroundColor: 'var(--app-card)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-text)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--app-border)' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
              <Minus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-[var(--app-text)]">Schnellabzug</h3>
              <p className="text-[11px] text-[var(--app-text-muted)]">Verbrauchtes Filament mit 1 Klick abziehen</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-accent-sub)] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Spule auswählen */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[var(--app-text)]">Spule auswählen:</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)]" />
              <input
                type="text"
                placeholder="Spule filtern..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[var(--app-input-bg)] border border-[var(--app-border)] text-xs text-[var(--app-text)] focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="max-h-36 overflow-y-auto border border-[var(--app-border)] rounded-xl p-1 bg-[var(--app-input-bg)]/60 space-y-1">
              {filteredSpools.map(s => {
                const isSelected = s.id === (activeSpool?.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSpoolId(s.id)}
                    className={`p-2 rounded-lg border transition cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-orange-500/15 border-orange-500'
                        : 'bg-[var(--app-card-sub)] hover:bg-[var(--app-accent-sub)] border-[var(--app-border)]/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: s.colorHex || '#f97316' }}
                      />
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-orange-400 mr-1.5 uppercase">{s.brand}</span>
                        <span className="text-xs font-semibold text-[var(--app-text)] truncate">{s.name}</span>
                      </div>
                    </div>
                    <span className="font-mono-num text-xs font-bold text-emerald-400 shrink-0">
                      {s.remainingWeight}g
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grammanzahl Schnellauswahl */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[var(--app-text)]">Wie viel Gramm wurden gedruckt?</label>
            <div className="grid grid-cols-5 gap-1.5">
              {[10, 25, 50, 100, 250].map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setGramsInput(amt.toString())}
                  className={`py-2 rounded-xl text-xs font-mono-num font-bold border transition cursor-pointer text-center ${
                    gramsInput === amt.toString()
                      ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                      : 'bg-[var(--app-card-sub)] hover:bg-[var(--app-accent-sub)] text-[var(--app-text)] border-[var(--app-border)]'
                  }`}
                >
                  {amt}g
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-[var(--app-text-muted)]">Eigene Gramm-Angabe:</span>
              <input
                type="number"
                min="1"
                max="10000"
                value={gramsInput}
                onChange={e => setGramsInput(e.target.value)}
                className="w-24 px-3 py-1.5 rounded-xl bg-[var(--app-input-bg)] border border-[var(--app-border)] font-mono-num font-bold text-xs text-[var(--app-text)] focus:outline-none focus:border-orange-500 text-center"
              />
              <span className="text-xs font-bold text-[var(--app-text-muted)]">Gramm</span>
            </div>
          </div>

          {/* Vorschau der Spule nach Abzug */}
          {activeSpool && (
            <div className="p-3 rounded-xl bg-[var(--app-card-sub)] border border-[var(--app-border)] space-y-2 text-xs">
              <div className="flex justify-between items-center text-[var(--app-text-muted)]">
                <span>Aktueller Restbestand:</span>
                <span className="font-mono-num font-bold text-[var(--app-text)]">{activeSpool.remainingWeight} g</span>
              </div>
              <div className="flex justify-between items-center text-rose-400">
                <span>Abzug:</span>
                <span className="font-mono-num font-bold">- {gramsAmount} g</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-[var(--app-border)] font-bold">
                <span className="text-emerald-400">Neuer Restbestand:</span>
                <span className="font-mono-num text-sm text-emerald-400">{remainingAfter} g</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={() => handleApply()}
          disabled={!activeSpool || gramsAmount <= 0}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 text-white font-extrabold text-xs shadow-lg shadow-orange-500/25 transition cursor-pointer flex items-center justify-center gap-2"
        >
          <Minus className="w-4 h-4" />
          <span>{gramsAmount}g jetzt von „{activeSpool?.brand} {activeSpool?.name}“ abziehen</span>
        </button>
      </div>
    </div>
  );
};
