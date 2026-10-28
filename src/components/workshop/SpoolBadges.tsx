import React from 'react';
import { AlertTriangle, Droplets, MapPin } from 'lucide-react';
import type { Spool } from '../../types/filament';
import { getHumidityInfo } from '../../utils/materialInfo';
import { isLowSpool } from '../../utils/spoolAlerts';
import { useWorkshopSettings } from '../../utils/workshopSettings';

// Kleine Abzeichen für Spulenkarten: fast leer, Lagerort und Feuchte-Hinweis.
// Wird innerhalb einer Zeile mit flex-wrap eingesetzt.

const HUMIDITY_STYLE: Record<number, string> = {
  2: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  3: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  4: 'bg-rose-500/15 text-rose-400 border-rose-500/30'
};

export const SpoolBadges: React.FC<{ spool: Spool }> = ({ spool }) => {
  const [settings] = useWorkshopSettings();
  const remaining = Number(spool.remainingWeight) || 0;
  const low = settings.lowWarning && isLowSpool(spool, settings.lowWeightG);
  const humidity = getHumidityInfo(spool.material);

  return (
    <>
      {low && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded font-bold border bg-rose-500/20 text-rose-400 border-rose-500/40 inline-flex items-center gap-1"
          title={`Nur noch ${remaining} g (Warnung ab ${settings.lowWeightG} g)`}
        >
          <AlertTriangle className="w-2.5 h-2.5" />
          <span>{remaining <= 0 ? 'Leer' : 'Fast leer'}</span>
        </span>
      )}
      {spool.location && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded font-bold border bg-sky-500/15 text-sky-400 border-sky-500/30 inline-flex items-center gap-1"
          title={`Lagerort: ${spool.location}`}
        >
          <MapPin className="w-2.5 h-2.5" />
          <span className="truncate max-w-[110px]">{spool.location}</span>
        </span>
      )}
      {humidity.level >= 2 && (
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-bold border inline-flex items-center gap-1 ${HUMIDITY_STYLE[humidity.level]}`}
          title={humidity.tip}
        >
          <Droplets className="w-2.5 h-2.5" />
          <span>{humidity.short}</span>
        </span>
      )}
    </>
  );
};
