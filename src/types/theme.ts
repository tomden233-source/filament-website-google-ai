export type ThemeBrightness = 'polar' | 'warm' | 'titanium' | 'slate' | 'midnight';
export type ThemeAccent = 'orange' | 'emerald' | 'cyan' | 'violet' | 'mono';

export interface ThemeConfig {
  brightness: ThemeBrightness;
  accent: ThemeAccent;
}

export interface BrightnessOption {
  id: ThemeBrightness;
  name: string;
  subtitle: string;
  level: string;
  bgHex: string;
  cardHex: string;
  textHex: string;
}

export const BRIGHTNESS_OPTIONS: BrightnessOption[] = [
  {
    id: 'polar',
    name: '1. Weiß',
    subtitle: 'Reines Weiß',
    level: '100% Hell',
    bgHex: '#ffffff',
    cardHex: '#f8fafc',
    textHex: '#0f172a'
  },
  {
    id: 'warm',
    name: '2. Soft White',
    subtitle: 'Sanftes Hellgrau / Warmweiß',
    level: '75% Hell',
    bgHex: '#f1f5f9',
    cardHex: '#ffffff',
    textHex: '#0f172a'
  },
  {
    id: 'titanium',
    name: '3. Neutral',
    subtitle: 'Schönes Mittelgrau',
    level: '50% Neutral',
    bgHex: '#374151',
    cardHex: '#475569',
    textHex: '#f8fafc'
  },
  {
    id: 'slate',
    name: '4. Deep',
    subtitle: 'Tiefes Nachtblau',
    level: '25% Blau',
    bgHex: '#060b19',
    cardHex: '#0d1730',
    textHex: '#e2e8f0'
  },
  {
    id: 'midnight',
    name: '5. Midnight',
    subtitle: '100% Reines Tiefschwarz (OLED)',
    level: '0% Schwarz',
    bgHex: '#000000',
    cardHex: '#0a0a0a',
    textHex: '#ffffff'
  }
];

export interface AccentOption {
  id: ThemeAccent;
  name: string;
  colorHex: string;
}

export const ACCENT_OPTIONS: AccentOption[] = [
  { id: 'orange', name: 'Industrie-Orange', colorHex: '#f97316' },
  { id: 'emerald', name: 'Smaragd-Grün', colorHex: '#10b981' },
  { id: 'cyan', name: 'Tech-Cyan', colorHex: '#06b6d4' },
  { id: 'violet', name: 'Neon-Violett', colorHex: '#8b5cf6' },
  { id: 'mono', name: 'Minimal-Silber', colorHex: '#94a3b8' }
];
