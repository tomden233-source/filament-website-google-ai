// Rest-Warnung und Lagerorte
import type { Spool } from '../types/filament';

export function isLowSpool(spool: Spool, thresholdG: number): boolean {
  return thresholdG > 0 && (Number(spool.remainingWeight) || 0) <= thresholdG;
}

/** Fast leere Spulen, die wenigsten Gramm zuerst */
export function getLowSpools(spools: Spool[], thresholdG: number): Spool[] {
  return spools
    .filter(s => isLowSpool(s, thresholdG))
    .sort((a, b) => (Number(a.remainingWeight) || 0) - (Number(b.remainingWeight) || 0));
}

export const COMMON_LOCATIONS = ['Regal', 'Box', 'Trockner', 'Vakuum-Beutel', 'AMS', 'Schublade'];

export interface LocationStat {
  name: string;
  count: number;
}

/** Alle benutzten Lagerorte mit Anzahl, die häufigsten zuerst */
export function getLocationStats(spools: Spool[]): LocationStat[] {
  const map = new Map<string, number>();
  for (const s of spools) {
    const name = (s.location || '').trim();
    if (name) map.set(name, (map.get(name) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'de'));
}
