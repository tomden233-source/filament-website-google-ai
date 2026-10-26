export type MaterialType =
  | 'PLA'
  | 'PLA+'
  | 'PETG'
  | 'TPU'
  | 'ABS'
  | 'ASA'
  | 'PA / Nylon'
  | 'PC'
  | 'PET-CF / PA-CF';

export interface Spool {
  id: string;
  brand: string;
  name: string;
  material: MaterialType;
  colorName: string;
  colorHex: string;
  pricePerKg: number;
  initialWeight: number; // in grams, e.g. 1000
  remainingWeight: number; // in grams, net
  emptySpoolWeight: number; // in grams, tara
  storageNote?: string;
  lastDried: string; // ISO string
  dryIntervalDays: number;
  dryTemp: number; // °C
  dryHours: number; // h
  productUrl?: string;
  nfcWritten?: boolean; // true = Tag beschrieben (grün), false = unbeschrieben (rot)
  nfcTagId?: string;
}

export interface HistoryEntry {
  id: string;
  spoolId: string;
  spoolLabel: string;
  grams: number;
  timestamp: string;
}

export interface VersionProfile {
  id: string; // e.g. 'v1.19', 'v1.20', 'v1.21', 'v1.22', 'v1.23'
  label: string;
  releaseDate: string;
  description: string;
  features: string[];
  spoolsSnapshot: Spool[];
  historySnapshot: HistoryEntry[];
  viewMode: ViewMode;
}

export type ViewMode = 'full' | 'simple' | 'params';

export type SidebarTab = 'ai' | 'gcode' | 'calc' | 'tools' | 'settings' | 'connect';

export interface GCodeAnalysis {
  weightGrams: number;
  timeHours: number;
  material: string;
  fileName: string;
}

export interface DryingStatus {
  diffMs: number;
  isOverdue: boolean;
  statusLevel: 'ok' | 'soon' | 'overdue';
  dryPct: number;
  dryBarColor: string;
  days: number;
  hours: number;
  mins: number;
  secs: number;
  lastDriedFormatted: string;
}

export interface MaterialDryingConfig {
  intervalDays: number;
  temp: number;
  hours: number;
}

export interface BrandConfig {
  tara: number;
  defaultPrice: number;
}

export interface AppSettings {
  materialPresets: Record<string, MaterialDryingConfig>;
  brandPresets: Record<string, BrandConfig>;
  eibosBagTara: number;
  cardSize?: number; // Minimale Kachelbreite in Pixel (z.B. 240..480px)
}

export interface BambuPrintProfile {
  brand: string;
  material: MaterialType;
  nozzleTempFirstLayer: number;
  nozzleTempOtherLayers: number;
  bedTempTexturedPEI: number;
  bedTempSmoothPlate: number;
  maxVolumetricSpeed: number; // mm³/s (Flow)
  fanSpeedMin: number; // %
  fanSpeedMax: number; // %
  printSpeedOuterWall: number; // mm/s
  printSpeedInnerWall: number; // mm/s
  density: number; // g/cm³
  dryingRecommendation: string;
  notes?: string;
}

export interface BambuConnectedPrinter {
  id: string;
  name: string;
  model: string;
  ip: string;
  serialNumber: string;
  accessCode: string;
  port: number;
  status: 'idle' | 'printing' | 'paused' | 'offline';
  nozzleTemp: number;
  targetNozzleTemp: number;
  bedTemp: number;
  targetBedTemp: number;
  fanSpeed: number;
  printName?: string;
  currentLayer?: number;
  totalLayers?: number;
  elapsedSeconds?: number;
  totalSeconds?: number;
  printGrams?: number;
  amsSlots: { [slotIndex: number]: string }; // slot 1..4 -> spoolId
  activeSlot: number;
  lastConnected?: string;
}

export type LogCategory = 'steckdose' | 'drucker' | 'licht' | 'temp' | 'spule' | 'kamera' | 'system';

export interface SystemLogEntry {
  id: string;
  timestamp: string; // HH:mm:ss
  dateStr: string;   // DD.MM.YYYY
  category: LogCategory;
  message: string;
  details?: string;
  level?: 'info' | 'success' | 'warn' | 'error';
}


