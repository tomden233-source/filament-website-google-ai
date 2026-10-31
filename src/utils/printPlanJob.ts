// Erkennt, ob der Druck-Planer noch zum laufenden Auftrag gehört (Name und Startzeit kommen beim Bambu oft erst später).
import { jobKey } from './printUsage';

export function splitId(id: string): { key: string; ms: number } {
  const i = id.lastIndexOf('|');
  const key = i >= 0 ? id.slice(0, i) : id;
  return { key: key === 'druck' ? '' : key, ms: i >= 0 ? Number(id.slice(i + 1)) || 0 : 0 };
}

/** Gleicher Auftrag? Name oder Startzeit kommen beim Bambu oft erst später, fehlende Angaben zählen als „passt“. */
export function samePlanJob(planId: string, jobName: string | undefined, startMs: number): boolean {
  const a = splitId(planId);
  const key = jobKey(jobName || '');
  if (a.key && key && a.key !== key) return false;
  if (a.ms && startMs && Math.abs(a.ms - startMs) >= 5000) return false;
  return true;
}
