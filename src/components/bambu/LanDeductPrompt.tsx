import React, { useState } from 'react';
import type { Spool } from '../../types/filament';
import { PENDING_DEDUCT_KEY, rememberJobGrams, type PendingDeduct } from '../../utils/printUsage';
import { safeStorage } from '../../utils/safeStorage';

// Nach einem Druck im LAN-Modus: Gramm eintragen, Spule prüfen, abziehen. Das Gewicht wird zum Auftragsnamen gemerkt.
interface Props {
  pending: PendingDeduct;
  spools: Spool[];
  onDeduct: (spoolId: string, grams: number) => void;
  onClose: () => void;
}

export const LanDeductPrompt: React.FC<Props> = ({ pending, spools, onDeduct, onClose }) => {
  const [spoolId, setSpoolId] = useState(pending.spoolId || spools[0]?.id || '');
  const [grams, setGrams] = useState('');
  const g = Number(grams.replace(',', '.'));
  const ok = Boolean(spoolId) && g > 0;

  const done = () => {
    safeStorage.removeItem(PENDING_DEDUCT_KEY);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 flex items-end sm:items-center justify-center p-3" onClick={done}>
      <div
        className="w-full max-w-sm rounded-2xl border p-4 space-y-3"
        style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="text-sm font-extrabold">Druck fertig: Verbrauch abziehen</div>
        <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
          „{pending.jobName}“. Im LAN-Modus meldet der Drucker das Gewicht nicht. Trag die Gramm aus Bambu Studio ein. Beim nächsten
          Druck mit gleichem Namen zieht die App dann automatisch ab.
        </p>
        <select
          value={spoolId}
          onChange={e => setSpoolId(e.target.value)}
          className="w-full px-2 py-2 rounded-lg border text-xs outline-none"
          style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
        >
          {spools.map(s => (
            <option key={s.id} value={s.id}>
              {s.brand} {s.name} ({Math.round(s.remainingWeight)} g)
            </option>
          ))}
        </select>
        <input
          type="number"
          inputMode="decimal"
          placeholder="Verbrauch in Gramm"
          value={grams}
          onChange={e => setGrams(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
          style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
        />
        <div className="flex gap-2">
          <button
            disabled={!ok}
            onClick={() => {
              onDeduct(spoolId, g);
              rememberJobGrams(pending.jobName, g);
              done();
            }}
            className="flex-1 py-2 rounded-xl text-white text-xs font-extrabold cursor-pointer disabled:opacity-40"
            style={{ backgroundImage: 'var(--app-accent-gradient)' }}
          >
            Abziehen
          </button>
          <button
            onClick={done}
            className="px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer"
            style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
          >
            Überspringen
          </button>
        </div>
      </div>
    </div>
  );
};
