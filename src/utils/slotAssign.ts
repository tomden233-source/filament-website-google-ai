// Spule → AMS-Slot: Werte an den Drucker senden und ehrlich melden, was der Drucker daraus gemacht hat.
import { printerApi } from '../api/printerApi';
import type { Spool } from '../types/filament';
import { getSpoolProfile } from './spoolProfile';

export interface SlotParams {
  colorHex: string;
  material: string;
  minTemp: number;
  maxTemp: number;
}

export interface SlotSendResult {
  /** Drucker hat den Slot wirklich gesetzt */
  confirmed: boolean;
  /** Bambu hat den Befehl abgelehnt (Fremd-Befehle über die Cloud) */
  blocked: boolean;
  text: string;
}

/** AMS kennt nur Grundmaterialien: „PLA+“ → PLA, „PA / Nylon“ → PA */
export function amsMaterial(material: string): string {
  const u = String(material || '').toUpperCase();
  if (/CF/.test(u) && /PA|PET/.test(u)) return 'PA-CF';
  const known = ['PETG', 'PLA', 'ABS', 'ASA', 'TPU', 'PCTG', 'PC', 'PA', 'PET', 'PVA', 'HIPS', 'PP'];
  return known.find(k => u.startsWith(k)) || u.match(/[A-Z]+/)?.[0] || 'PLA';
}

export function paramsFromSpool(spool: Spool): SlotParams {
  const prof = getSpoolProfile(spool);
  return { colorHex: prof.colorHex, material: amsMaterial(spool.material), minTemp: prof.minTemp, maxTemp: prof.maxTemp };
}

/** slot = 1-4 */
export async function sendToSlot(slot: number, p: SlotParams): Promise<SlotSendResult> {
  try {
    const res = await printerApi.amsFilament({
      slotIdx: slot - 1,
      colorHex: p.colorHex.replace('#', ''),
      material: amsMaterial(p.material),
      minTemp: p.minTemp,
      maxTemp: p.maxTemp
    });
    const d = res.data || {};
    if (res.ok && d.success !== false) {
      return { confirmed: d.confirmed !== false, blocked: false, text: d.message || `Slot ${slot} ist am Drucker gesetzt.` };
    }
    return {
      confirmed: false,
      blocked: Boolean(d.blocked),
      text: d.error || d.message || 'Der Drucker hat den Slot nicht übernommen.'
    };
  } catch {
    return { confirmed: false, blocked: false, text: 'Keine Verbindung zum Drucker.' };
  }
}
