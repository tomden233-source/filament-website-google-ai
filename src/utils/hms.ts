// Fehler und Hinweise des Druckers (HMS) in Klartext.
// Die Texte (deutsch, sonst englisch) stammen aus ha-bambulab (MIT-Lizenz, github.com/greghesp/ha-bambulab) und liegen in public/hms_de.json.
// Sie werden erst geladen, wenn der Drucker wirklich einen Fehler meldet.

export interface HmsEntry {
  attr: number;
  code: number;
}

let table: { e: Record<string, string>; h: Record<string, string> } | null = null;
let loading: Promise<void> | null = null;

async function load(): Promise<void> {
  if (table) return;
  if (!loading) {
    loading = (async () => {
      try {
        const base = (import.meta as any).env?.BASE_URL || '/';
        const res = await fetch(`${base}hms_de.json`);
        if (res.ok) table = await res.json();
      } catch {
        /* offline: dann nur Code */
      }
      if (!table) loading = null; // später nochmal versuchen
    })();
  }
  await loading;
}

const hex4 = (n: number) => (n >>> 0).toString(16).toUpperCase().padStart(4, '0');

/** z. B. 0300_0100_0001_0007 */
export function hmsCode(h: HmsEntry): string {
  return `${hex4(Math.floor(h.attr / 0x10000))}_${hex4(h.attr & 0xffff)}_${hex4(Math.floor(h.code / 0x10000))}_${hex4(h.code & 0xffff)}`;
}

/** Druckfehler-Code als Text, z. B. 0300_4006 */
export function printErrorCode(err: number): string {
  const v = (err >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return `${v.slice(0, 4)}_${v.slice(4)}`;
}

const MODULES: Record<number, string> = {
  0x03: 'Bewegung / Druck',
  0x05: 'Hauptplatine',
  0x07: 'AMS',
  0x08: 'Druckkopf',
  0x0c: 'Kamera / KI-Erkennung',
  0x12: 'AMS',
  0x18: 'AMS'
};

const SEVERITY: Record<number, string> = { 1: 'Kritisch', 2: 'Ernst', 3: 'Normal', 4: 'Hinweis' };

export function hmsModule(h: HmsEntry): string {
  return MODULES[(h.attr >>> 24) & 0xff] || 'Drucker';
}

export function hmsSeverity(h: HmsEntry): { level: number; text: string } {
  const level = Math.floor((h.code >>> 0) / 0x10000);
  return { level, text: SEVERITY[level] || 'Unbekannt' };
}

/** Klartext zu einer HMS-Meldung (oder null, wenn unbekannt) */
export async function hmsText(h: HmsEntry): Promise<string | null> {
  await load();
  return table?.h?.[hmsCode(h).replace(/_/g, '')] || null;
}

/** Klartext zu einem Druckfehler (oder null) */
export async function printErrorText(err: number): Promise<string | null> {
  await load();
  return table?.e?.[printErrorCode(err).replace(/_/g, '')] || null;
}

export const HMS_HELP_URL = 'https://wiki.bambulab.com/en/hms/home';
