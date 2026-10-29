import React, { useState } from 'react';
import { Droplets } from 'lucide-react';
import type { DryOffer } from '../../hooks/useDryAfterPrint';

// Frage nach dem Einlegen einer Spule, die trocknen sollte: nach dem Druck trocknen, jetzt trocknen oder nein.
interface Props {
  offer: DryOffer;
  printRunning: boolean;
  onAfterPrint: (o: { temp: number; hours: number }) => void;
  onNow: (o: { temp: number; hours: number }) => void;
  onClose: () => void;
}

const TEMPS = [45, 50, 55, 60, 65];
const HOURS = [4, 6, 8, 12, 24];

export const DrySuggestSheet: React.FC<Props> = ({ offer, printRunning, onAfterPrint, onNow, onClose }) => {
  const [temp, setTemp] = useState(offer.temp);
  const [hours, setHours] = useState(offer.hours);
  const chip = (active: boolean): React.CSSProperties => ({
    backgroundColor: active ? 'var(--app-accent)' : 'var(--app-card-sub)',
    borderColor: active ? 'var(--app-accent)' : 'var(--app-border)',
    color: active ? '#fff' : 'var(--app-text)'
  });

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border p-4 space-y-3"
        style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-sm font-extrabold">
          <Droplets className="w-4 h-4 text-sky-400" />
          <span>Spule sollte trocknen</span>
        </div>
        <div className="space-y-1.5">
          {offer.spools.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 text-xs">
              <span className="w-3 h-6 rounded-full border shrink-0" style={{ backgroundColor: s.colorHex, borderColor: 'var(--app-border)' }} />
              <span className="font-bold truncate">
                {s.brand} {s.name}
              </span>
              <span style={{ color: 'var(--app-text-muted)' }}>
                Slot {offer.slots[i]} · {s.material}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[11px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
          Das ganze AMS wird geheizt. Die Temperatur ist deshalb so gewählt, dass sie für alle Spulen im AMS passt.
        </p>
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            {TEMPS.map(t => (
              <button key={t} onClick={() => setTemp(t)} className="px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer" style={chip(temp === t)}>
                {t} °C
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {HOURS.map(h => (
              <button key={h} onClick={() => setHours(h)} className="px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer" style={chip(hours === h)}>
                {h} h
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onAfterPrint({ temp, hours })}
            className="w-full py-2 rounded-xl text-white text-xs font-extrabold cursor-pointer"
            style={{ backgroundImage: 'var(--app-accent-gradient)' }}
          >
            {printRunning ? 'Nach dem Druck trocknen' : 'Nach dem nächsten Druck trocknen'}
          </button>
          {!printRunning && (
            <button onClick={() => onNow({ temp, hours })} className="w-full py-2 rounded-xl border text-xs font-bold cursor-pointer" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}>
              Jetzt trocknen
            </button>
          )}
          <button onClick={onClose} className="w-full py-2 rounded-xl border text-xs font-bold cursor-pointer" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}>
            Nein
          </button>
        </div>
      </div>
    </div>
  );
};
