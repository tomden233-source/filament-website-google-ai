import { GCodeAnalysis } from '../types/filament';

const WEIGHT_PATTERNS = [
  /total filament weight \[g\]\s*[:=]\s*([\d.,\s]+)/i,
  /total filament used \[g\]\s*=\s*([\d.]+)/i,
  /filament used \[g\]\s*=\s*([\d.]+)/i,
  /; filament used \[g\] = ([\d.,\s]+)/i,
  /filament_weight\s*=\s*([\d.]+)/i,
  /;Weight:([\d.]+)g/i,
  /([\d.]+)\s*g\s*filament/i,
  /filament used.*?(\d+(?:\.\d+)?)\s*g/i
];

/** Gewicht in Gramm aus den Slicer-Kommentaren, oder null wenn nichts gefunden wurde (keine Schätzung) */
export function findGcodeWeight(text: string): number | null {
  for (const rx of WEIGHT_PATTERNS) {
    const m = text.match(rx);
    if (m) {
      const parts = m[1].split(/[,\s]+/).map(x => parseFloat(x)).filter(x => !isNaN(x));
      const grams = Math.round(parts.reduce((a, b) => a + b, 0));
      if (grams > 0) return grams;
    }
  }
  return null;
}

export function parseGCodeContent(text: string, fileName: string): GCodeAnalysis {
  let grams = findGcodeWeight(text) || 0;
  let hours = 1.5;
  let mat = 'PLA';

  // Fallback über Filament-Meter (1m 1.75mm PLA ≈ 2.98g)
  if (!grams) {
    const meterMatch = text.match(/;Filament used:\s*([\d.]+)m/i) || text.match(/filament used \[mm\]\s*=\s*([\d.]+)/i);
    if (meterMatch) {
      const val = parseFloat(meterMatch[1]);
      grams = Math.round(val > 500 ? (val / 1000) * 2.98 : val * 2.98);
    }
  }

  if (!grams) grams = 45; // Plausibler Fallback für 3D-Drucke

  // Druckzeit suchen
  const timeMatch = text.match(/estimated printing time.*?=\s*(?:(\d+)d\s*)?(?:(\d+)h\s*)?(?:(\d+)m)?/i) ||
                    text.match(/;TIME:(\d+)/i) ||
                    text.match(/; estimated print time:\s*(\d+)h\s*(\d+)m/i);

  if (timeMatch) {
    if (timeMatch[0].toUpperCase().startsWith(';TIME:')) {
      hours = Math.round((parseInt(timeMatch[1]) / 3600) * 100) / 100;
    } else {
      const d = parseInt(timeMatch[1] || '0');
      const h = parseInt(timeMatch[2] || '0');
      const m = parseInt(timeMatch[3] || '0');
      hours = Math.max(0.1, Math.round(((d * 24) + h + (m / 60)) * 100) / 100);
    }
  }

  // Material suchen
  const matMatch = text.match(/filament_type\s*=\s*([A-Z0-9+-]+)/i) ||
                    text.match(/;Filament type:\s*([A-Z0-9+-]+)/i) ||
                    text.match(/; material_name = ([A-Z0-9+-]+)/i);

  if (matMatch) {
    mat = matMatch[1].toUpperCase();
  }

  return {
    weightGrams: grams,
    timeHours: hours,
    material: mat,
    fileName
  };
}
