// Spulen-Etikett: QR-Code + Text als 1-Bit-Bild, dann ins Spalten-Raster des Druckers.
import QRCode from 'qrcode';
import type { Spool } from '../../types/filament';

export const DOTS_PER_MM = 8; // 203 dpi
export const HEAD_DOTS = 96; // E10: 12 mm Druckkopf

export interface Bitmap {
  width: number;
  height: number;
  /** 1 Byte je Pixel, 1 = schwarz */
  pixels: Uint8Array;
}

export interface LabelOptions {
  lengthMm: number;
  qrText: string;
  showLocation: boolean;
}

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  return { canvas, ctx };
}

function toBitmap(ctx: CanvasRenderingContext2D, w: number, h: number): Bitmap {
  const d = ctx.getImageData(0, 0, w, h).data;
  const pixels = new Uint8Array(w * h);
  for (let i = 0; i < pixels.length; i++) {
    const luma = 0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2];
    pixels[i] = luma < 140 ? 1 : 0;
  }
  return { width: w, height: h, pixels };
}

const FONT = 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Text auf die Breite anpassen (Schrift verkleinern, bis es passt) */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, startPx: number, weight: number, minPx = 11) {
  let px = startPx;
  for (; px > minPx; px--) {
    ctx.font = `${weight} ${px}px ${FONT}`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  ctx.font = `${weight} ${px}px ${FONT}`;
  let t = text;
  while (t.length > 1 && ctx.measureText(t).width > maxW) t = t.slice(0, -1);
  return t === text ? t : t.trimEnd() + '…';
}

export function renderSpoolLabel(spool: Spool, o: LabelOptions): Bitmap {
  const w = Math.max(10, Math.round(o.lengthMm * DOTS_PER_MM));
  const h = HEAD_DOTS;
  const { ctx } = makeCanvas(w, h);

  // QR links: so groß wie möglich, ganzzahlige Modulgröße
  const qr = QRCode.create(o.qrText, { errorCorrectionLevel: 'L' });
  const n = qr.modules.size;
  const quiet = 2;
  const avail = h - 4;
  const scale = Math.max(1, Math.floor(avail / (n + quiet * 2)));
  const side = (n + quiet * 2) * scale;
  const qx = 2;
  const qy = Math.floor((h - side) / 2);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.data[r * n + c]) ctx.fillRect(qx + (quiet + c) * scale, qy + (quiet + r) * scale, scale, scale);
    }
  }

  // Text rechts
  const tx = qx + side + 6;
  const maxW = w - tx - 4;
  if (maxW > 20) {
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const lines: { text: string; px: number; weight: number }[] = [
      { text: spool.name || 'Spule', px: 28, weight: 800 },
      { text: `${spool.material} · ${spool.colorName || ''}`.replace(/ · $/, ''), px: 22, weight: 600 },
      { text: `${Math.round(spool.initialWeight)} g ${spool.brand || ''}`.trim(), px: 20, weight: 500 }
    ];
    if (o.showLocation && spool.location) lines.push({ text: `Lager: ${spool.location}`, px: 20, weight: 600 });
    const shown = lines.slice(0, 4);
    const heights = shown.map(l => l.px * 1.15);
    const total = heights.reduce((a, b) => a + b, 0);
    let y = Math.max(2, (h - total) / 2);
    shown.forEach((l, i) => {
      const t = fitText(ctx, l.text, maxW, l.px, l.weight);
      ctx.fillText(t, tx, y);
      y += heights[i];
    });
  }
  return toBitmap(ctx, w, h);
}

/** Testetikett: Rahmen, Skala und ein "F" zum Prüfen von Drehung und Spiegelung */
export function renderTestLabel(lengthMm: number): Bitmap {
  const w = Math.round(lengthMm * DOTS_PER_MM);
  const h = HEAD_DOTS;
  const { ctx } = makeCanvas(w, h);
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
  for (let mm = 1; mm * DOTS_PER_MM < h; mm++) ctx.fillRect(0, mm * DOTS_PER_MM, mm % 5 === 0 ? 24 : 12, 1);
  ctx.font = `800 ${Math.round(h * 0.6)}px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('F', 40, h / 2);
  ctx.font = `500 ${Math.round(h * 0.2)}px ${FONT}`;
  ctx.fillText('oben ↑  FilamentHub', 40 + h * 0.6, h * 0.3);
  return toBitmap(ctx, w, h);
}

export interface Orientation {
  rotate180: boolean;
  mirror: boolean;
  offsetDots: number;
}

/** Bild → Spalten-Raster (je Spalte HEAD_DOTS/8 Bytes, LSB oben) */
export function toRaster(bmp: Bitmap, o: Orientation) {
  const perLineByte = HEAD_DOTS / 8;
  const usable = HEAD_DOTS;
  const cols = bmp.width;
  const raster = new Uint8Array(cols * perLineByte);
  const offset = Math.floor((usable - bmp.height) / 2) + o.offsetDots;
  for (let y = 0; y < bmp.height; y++) {
    for (let x = 0; x < bmp.width; x++) {
      if (!bmp.pixels[y * bmp.width + x]) continue;
      let across = bmp.height - 1 - y;
      let col = cols - 1 - x;
      if (o.mirror) across = bmp.height - 1 - across;
      if (o.rotate180) {
        across = bmp.height - 1 - across;
        col = cols - 1 - col;
      }
      const dot = across + offset;
      if (dot < 0 || dot >= usable) continue;
      raster[col * perLineByte + (dot >> 3)] |= 1 << (dot & 7);
    }
  }
  return { raster, perLineByte, cols };
}

/** Bild auf eine Canvas zeichnen (Vorschau, PNG-Export) */
export function drawBitmap(canvas: HTMLCanvasElement, bmp: Bitmap) {
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(bmp.width, bmp.height);
  for (let i = 0; i < bmp.pixels.length; i++) {
    const v = bmp.pixels[i] ? 0 : 255;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
