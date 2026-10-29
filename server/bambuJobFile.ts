// Gewicht je Filament aus der Druckdatei holen, die der Drucker selbst gespeichert hat (nur LAN-Modus).
// Bambu Studio schickt die Datei (<Name>.gcode.3mf) per FTPS (Port 990, Benutzer bblp, Passwort = Zugangscode) an den Drucker.
// Darin steht Metadata/slice_info.config mit used_g je Filament. So braucht es keine Cloud und keine Handeingabe.
import { Client } from 'basic-ftp';
import { Writable } from 'stream';
import { unzipSync, strFromU8 } from 'fflate';

export interface JobFilament {
  id: number;
  type: string;
  colorHex: string;
  grams: number;
}

export interface JobWeights {
  fileName: string;
  plate: number;
  filaments: JobFilament[];
  totalGrams: number;
}

const DIRS = ['/', '/cache', '/sdcard', '/sdcard/cache'];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\.gcode\.3mf$|\.3mf$|\.gcode$/g, '')
    .trim();

/** slice_info.config lesen (ohne XML-Bibliothek: nur die Filament- und Plate-Zeilen) */
export function parseSliceInfo(xml: string, plate = 1): { plate: number; filaments: JobFilament[] } {
  const plates = xml.match(/<plate>[\s\S]*?<\/plate>/g) || [];
  const idxOf = (blk: string) => Number((blk.match(/key="index"\s+value="(\d+)"/) || [])[1]) || 0;
  const blk = plates.find(b => idxOf(b) === plate) || plates[0] || xml;
  const filaments: JobFilament[] = [];
  const re = /<filament\b([^>]*?)\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(blk))) {
    const attrs = m[1];
    const get = (k: string) => (attrs.match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1] || '';
    const grams = parseFloat(get('used_g'));
    if (!(grams > 0)) continue;
    filaments.push({
      id: Number(get('id')) || filaments.length + 1,
      type: get('type'),
      colorHex: ('#' + get('color').replace('#', '').slice(0, 6)).toUpperCase(),
      grams: Math.round(grams * 100) / 100
    });
  }
  return { plate: idxOf(blk) || plate, filaments };
}

/** Aus den Bytes einer .3mf das Gewicht lesen */
export function weightsFromThreeMf(data: Uint8Array, plate = 1): { plate: number; filaments: JobFilament[] } | null {
  const files = unzipSync(data, { filter: f => f.name.toLowerCase().endsWith('slice_info.config') });
  const key = Object.keys(files).find(k => k.toLowerCase().endsWith('slice_info.config'));
  if (!key) return null;
  const r = parseSliceInfo(strFromU8(files[key]), plate);
  return r.filaments.length ? r : null;
}

export async function fetchJobWeights(opts: { ip: string; code: string; jobName: string; plate?: number }): Promise<JobWeights | { error: string }> {
  const client = new Client(20000);
  try {
    await client.access({
      host: opts.ip,
      port: 990,
      user: 'bblp',
      password: opts.code,
      secure: 'implicit',
      secureOptions: { rejectUnauthorized: false } // Drucker nutzt ein selbstsigniertes Zertifikat
    });
    const want = norm(opts.jobName);
    if (!want) return { error: 'Kein Auftragsname.' };

    let best: { path: string; name: string; time: number } | null = null;
    for (const dir of DIRS) {
      let list;
      try {
        list = await client.list(dir);
      } catch {
        continue;
      }
      for (const f of list) {
        if (!f.isFile || !/\.3mf$/i.test(f.name)) continue;
        if (norm(f.name) !== want) continue;
        const time = f.modifiedAt ? f.modifiedAt.getTime() : 0;
        if (!best || time >= best.time) best = { path: (dir === '/' ? '' : dir) + '/' + f.name, name: f.name, time };
      }
    }
    if (!best) return { error: `Auf dem Drucker keine Datei „${opts.jobName}.3mf“ gefunden (Druck evtl. direkt vom Slicer-Cache oder Gcode ohne 3mf).` };

    const chunks: Buffer[] = [];
    const sink = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(Buffer.from(chunk));
        cb();
      }
    });
    await client.downloadTo(sink, best.path);
    const parsed = weightsFromThreeMf(new Uint8Array(Buffer.concat(chunks)), opts.plate || 1);
    if (!parsed) return { error: 'In der Datei steht kein Filament-Gewicht (slice_info.config fehlt).' };
    return {
      fileName: best.name,
      plate: parsed.plate,
      filaments: parsed.filaments,
      totalGrams: Math.round(parsed.filaments.reduce((a, f) => a + f.grams, 0) * 100) / 100
    };
  } catch (e: any) {
    return { error: `FTP zum Drucker fehlgeschlagen: ${e?.message || e}` };
  } finally {
    client.close();
  }
}
