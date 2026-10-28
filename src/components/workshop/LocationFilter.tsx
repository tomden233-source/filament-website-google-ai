import React from 'react';
import { MapPin } from 'lucide-react';
import type { LocationStat } from '../../utils/spoolAlerts';

interface Props {
  locations: LocationStat[];
  active: string;
  onChange: (name: string) => void;
}

/** Chip-Leiste: Spulen nach Lagerort filtern. Erscheint nur, wenn mindestens ein Lagerort vergeben ist. */
export const LocationFilter: React.FC<Props> = ({ locations, active, onChange }) => {
  if (locations.length === 0) return null;
  const chip = (name: string, label: string, count?: number) => {
    const isActive = active === name;
    return (
      <button
        key={name}
        onClick={() => onChange(name)}
        className="px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap transition cursor-pointer flex items-center gap-1.5"
        style={{
          backgroundColor: isActive ? 'var(--app-accent)' : 'var(--app-card-sub)',
          borderColor: isActive ? 'var(--app-accent)' : 'var(--app-border)',
          color: isActive ? '#ffffff' : 'var(--app-text-muted)'
        }}
      >
        <span>{label}</span>
        {count !== undefined && <span className="font-mono-num opacity-80">{count}</span>}
      </button>
    );
  };
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
      <span className="flex items-center gap-1 text-[11px] font-bold shrink-0" style={{ color: 'var(--app-text-muted)' }}>
        <MapPin className="w-3.5 h-3.5 text-sky-400" />
        <span className="hidden sm:inline">Lagerort:</span>
      </span>
      {chip('ALL', 'Alle')}
      {locations.map(l => chip(l.name, l.name, l.count))}
    </div>
  );
};
