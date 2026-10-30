import React, { useState } from 'react';
import { Plus, Link2, Clock } from 'lucide-react';
import type { Spool } from '../../types/filament';
import { colorNameOf, type BambuTrayInfo } from '../../utils/bambuTray';
import { baseMaterial } from '../../utils/amsMatch';

// Neue Bambu-Spule im AMS erkannt (Chip vom AMS gelesen): anlegen, mit vorhandener Spule verknüpfen oder später.
interface Props {
  items: BambuTrayInfo[];
  spools: Spool[];
  onCreate: (b: BambuTrayInfo) => void;
  onLink: (b: BambuTrayInfo, spoolId: string) => void;
  onLater: (b: BambuTrayInfo) => void;
  onClose: () => void;
}

export const BambuSpoolSheet: React.FC<Props> = ({ items, spools, onCreate, onLink, onLater, onClose }) => {
  const b = items[0];
  const same = spools.filter(s => baseMaterial(s.material) === baseMaterial(b.type));
  const others = spools.filter(s => !same.includes(s));
  const [pick, setPick] = useState('');
  const grams = b.remainPct >= 0 ? Math.round((b.fullWeight * b.remainPct) / 100) : null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border p-4 space-y-3"
        style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="text-sm font-extrabold">Neue Bambu-Spule erkannt{items.length > 1 ? ` (1 von ${items.length})` : ''}</div>
        <div className="flex items-center gap-3 p-2.5 rounded-xl border" style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}>
          <span className="w-9 h-9 rounded-full border-4 shrink-0" style={{ backgroundColor: b.colorHex, borderColor: 'var(--app-border)' }} />
          <div className="min-w-0 text-xs">
            <div className="font-extrabold truncate">
              {b.product} {colorNameOf(b.colorHex) !== 'Farbe' ? colorNameOf(b.colorHex) : ''}
            </div>
            <div style={{ color: 'var(--app-text-muted)' }}>
              Slot {b.slot} · {b.type} · {b.colorHex}
              {grams !== null ? ` · ca. ${grams} g (${b.remainPct} %)` : ''}
            </div>
          </div>
        </div>
        <p className="text-[11px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
          Das AMS hat den Chip der Spule gelesen. Einmal anlegen oder verknüpfen, danach erkennt die App die Spule bei jedem Einlegen von selbst. Ein eigener Tag ist nicht nötig.
        </p>
        <button
          onClick={() => onCreate(b)}
          className="w-full py-2 rounded-xl text-white text-xs font-extrabold cursor-pointer flex items-center justify-center gap-1.5"
          style={{ backgroundImage: 'var(--app-accent-gradient)' }}
        >
          <Plus className="w-3.5 h-3.5" /> Als neue Spule anlegen
        </button>
        {spools.length > 0 && (
          <div className="flex gap-2">
            <select
              value={pick}
              onChange={e => setPick(e.target.value)}
              className="flex-1 min-w-0 px-2 py-2 rounded-lg border text-xs outline-none"
              style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
            >
              <option value="">Ist schon in der App …</option>
              {[...same, ...others].map(s => (
                <option key={s.id} value={s.id}>
                  {s.brand} {s.name} ({Math.round(s.remainingWeight)} g)
                </option>
              ))}
            </select>
            <button
              disabled={!pick}
              onClick={() => onLink(b, pick)}
              className="px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer flex items-center gap-1 disabled:opacity-40"
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
            >
              <Link2 className="w-3.5 h-3.5" /> Verknüpfen
            </button>
          </div>
        )}
        <button
          onClick={() => onLater(b)}
          className="w-full py-2 rounded-xl border text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
          style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
        >
          <Clock className="w-3.5 h-3.5" /> Nicht mehr fragen
        </button>
      </div>
    </div>
  );
};
