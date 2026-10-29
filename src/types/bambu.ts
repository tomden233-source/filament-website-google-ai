// Live-Zustand des Bambu-Druckers (vom Server per /api/printer/status und SSE geliefert)
export interface BambuLiveState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  serialNumber: string;
  userId: string;
  brokerHost: string;
  hasAdminPin: boolean;
  /** LAN-Modus: direkt zum Drucker im Heimnetz, ohne Bambu Cloud */
  lanMode?: boolean;
  lanIp?: string;
  /** Login (Cloud) oder LAN-Daten vorhanden */
  hasToken?: boolean;
  /** Sekunden bis zum nächsten automatischen Verbindungsversuch */
  retryInSec?: number | null;
  /** Verbunden und der Drucker schickt Daten */
  receivingData?: boolean;
  lastUpdated: string | null;
  data: {
    gcode_state: string;
    subtask_name: string;
    gcode_file: string;
    /** Startzeit des Auftrags (Unix-Sekunden als Text), leer = unbekannt */
    gcode_start_time?: string;
    mc_percent: number;
    mc_remaining_time: number;
    layer_num: number;
    total_layer_num: number;
    bed_temper: number;
    bed_target_temper: number;
    chamber_temper: number;
    nozzle_temper: number; // Düse 1 (Links)
    nozzle_target_temper: number;
    nozzle2_temper?: number | null; // Düse 2 (Rechts)
    nozzle2_target_temper?: number;
    fan_gear: number;
    spd_mag: number;
    ams?: any;
    lights_report?: Array<{ mode: string; node: string }>;
    vt_tray?: any;
    /** Aktuelle HMS-Meldungen ([{ attr, code }]) */
    hms?: { attr: number; code: number }[];
    /** Fehlercode des Auftrags (0 = keiner) */
    print_error?: number;
  };
  formatted: {
    remainingTimeStr: string;
    etaClockStr: string;
    statusText: string;
    statusColor: string;
  };
}
