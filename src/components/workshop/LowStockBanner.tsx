import React from 'react';
import { AlertTriangle, Settings2 } from 'lucide-react';
import type { Spool } from '../../types/filament';
import { getLowSpools } from '../../utils/spoolAlerts';
import { useWorkshopSettings } from '../../utils/workshopSettings';

interface Props {
  spools: Spool[];
  /** Tippen auf eine Spule: in der Liste suchen */
  onFocus: (query: string) => void;
  onOpenSettings: () => void;
}

export const LowStockBanner: React.FC<Props> = ({ spools, onFocus, onOpenSettings }) => {
  const [settings] = useWorkshopSettings();
  if (!settings.lowWarning) return null;
  const low = getLowSpools(spools, settings.lowWeightG);
  if (low.length === 0) return null;
  const shown = low.slice(0, 4);

  return (
    <section
      className="rounded-2xl border p-3 space-y-2 shadow-sm"
      style={{ backgroundColor: 'rgba(244, 63, 94, 0.08)', borderColor: 'rgba(244, 63, 94, 0.35)', color: 'var(--app-text)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-extrabold flex items-center gap-1.5 text-rose-400">
          <AlertTriangle className="w-4 h-4" />
          {low.length === 1 ? '1 Spule fast leer' : `${low.length} Spulen fast leer`}
        </span>
        <button
          onClick={onOpenSettings}
          title={`Warnung ab ${settings.lowWeightG} g, hier ändern`}
          className="text-[10px] font-bold flex items-center gap-1 px-2 py-1 rounded-lg border cursor-pointer"
          style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
        >
          <Settings2 className="w-3 h-3" />
          <span>ab {settings.lowWeightG} g</span>
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {shown.map(s => (
          <button
            key={s.id}
            onClick={() => onFocus(s.name)}
            className="px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
            style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
            title="In der Liste anzeigen"
          >
            <span className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: s.colorHex }} />
            <span className="truncate max-w-[150px]">{s.name}</span>
            <span className="font-mono-num text-rose-400">{Math.max(0, Math.round(Number(s.remainingWeight) || 0))} g</span>
          </button>
        ))}
        {low.length > shown.length && (
          <span className="px-2 py-1 text-[11px] font-bold" style={{ color: 'var(--app-text-muted)' }}>
            +{low.length - shown.length} weitere
          </span>
        )}
      </div>
    </section>
  );
};
