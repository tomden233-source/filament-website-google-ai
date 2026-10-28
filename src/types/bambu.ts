// Live-Zustand des Bambu-Druckers (vom Server per /api/printer/status und SSE geliefert)
export interface BambuLiveState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  serialNumber: string;
  userId: string;
  brokerHost: string;
  hasAdminPin: boolean;
  lastUpdated: string | null;
  data: {
    gcode_state: string;
    subtask_name: string;
    gcode_file: string;
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
  };
  formatted: {
    remainingTimeStr: string;
    etaClockStr: string;
    statusText: string;
    statusColor: string;
  };
}
