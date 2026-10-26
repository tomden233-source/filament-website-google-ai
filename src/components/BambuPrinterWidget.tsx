import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Printer,
  Layers,
  Thermometer,
  Clock,
  Play,
  Pause,
  Square,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Box,
  Wind,
  Settings,
  RefreshCw,
  QrCode,
  Flame,
  AlertTriangle,
  X,
  Camera,
  Lightbulb,
  UploadCloud,
  FileCode,
  Droplets,
  Sun,
  Check,
  Palette,
  Edit3,
  Copy,
  ExternalLink,
  Maximize2,
  Power,
  Plug,
  Download,
  Home,
  Server
} from 'lucide-react';
import { Spool, ViewMode } from '../types/filament';
import { BambuSettingsModal } from './BambuSettingsModal';
import { safeStorage } from '../utils/safeStorage';
import { ThreeDPrinterIcon } from './ThreeDPrinterIcon';
import { addSystemLog } from '../utils/logService';
import {
  getHaCredentials,
  fetchHaSwitchStatus,
  toggleHaSwitch,
  toggleHaLight,
  fetchHaCameraBlobUrl,
  type HaCredentials
} from '../utils/haClient';

interface BambuPrinterWidgetProps {
  spools: Spool[];
  onDeductWeight: (spoolId: string, grams: number) => void;
  onOpenNewSpool: () => void;
  onApplyDryingCredit?: (spoolId: string, driedHours: number, dryTemp?: number) => void;
  viewMode?: ViewMode;
}

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

const DEFAULT_LIVE_STATE: BambuLiveState = {
  connected: false,
  connecting: false,
  error: null,
  serialNumber: '20P9BJ610801860',
  userId: '',
  brokerHost: 'us.mqtt.bambulab.com',
  hasAdminPin: true,
  lastUpdated: null,
  data: {
    gcode_state: 'IDLE',
    subtask_name: '',
    gcode_file: '',
    mc_percent: 0,
    mc_remaining_time: 0,
    layer_num: 0,
    total_layer_num: 0,
    bed_temper: 0,
    bed_target_temper: 0,
    chamber_temper: 0,
    nozzle_temper: 0,
    nozzle_target_temper: 0,
    nozzle2_temper: 0,
    nozzle2_target_temper: 0,
    fan_gear: 0,
    spd_mag: 100,
    ams: {
      ams: [
        {
          id: '0',
          humidity: 1,
          temp: 24,
          tray: [
            {
              id: '0',
              tray_color: '057748FF',
              tray_type: 'PLA',
              tray_sub_brands: 'Bambu PLA Basic',
              tray_info_idx: 'GFA00',
              nozzle_temp_min: 190,
              nozzle_temp_max: 230,
              remain: 82,
              state: 1
            },
            {
              id: '1',
              tray_color: 'E2E8F0FF',
              tray_type: 'PLA',
              tray_sub_brands: 'ELEGOO Color Marble PLA',
              tray_info_idx: 'ELEGOO_MARBLE',
              nozzle_temp_min: 190,
              nozzle_temp_max: 230,
              remain: 94,
              state: 1
            },
            {
              id: '2',
              tray_color: '111111FF',
              tray_type: 'PETG',
              tray_sub_brands: 'Prusament PETG Galaxy Black',
              tray_info_idx: 'PRUSA_PETG',
              nozzle_temp_min: 230,
              nozzle_temp_max: 250,
              remain: 65,
              state: 1
            },
            {
              id: '3',
              tray_color: 'FFFFFFFF',
              tray_type: 'PLA',
              tray_sub_brands: 'Bambu PLA Basic Weiß',
              tray_info_idx: 'GFA01',
              nozzle_temp_min: 190,
              nozzle_temp_max: 230,
              remain: 78,
              state: 1
            }
          ]
        }
      ]
    },
    vt_tray: null,
    lights_report: [{ node: 'chamber_light', mode: 'off' }]
  },
  formatted: {
    remainingTimeStr: '--',
    etaClockStr: '--:-- Uhr',
    statusText: 'Ausgeschaltet (Stromlos)',
    statusColor: '#64748b'
  }
};

const BAMBU_PRESET_COLORS = [
  { name: 'Grau', hex: '898989' },
  { name: 'Grün', hex: '057748' },
  { name: 'Lila / Flieder', hex: 'D4B1DD' },
  { name: 'Schwarz', hex: '111111' },
  { name: 'Weiß', hex: 'FFFFFF' },
  { name: 'Rot', hex: 'C8102E' },
  { name: 'Blau', hex: '00629B' },
  { name: 'Gelb', hex: 'F1BE48' },
  { name: 'Orange', hex: 'FF6A13' },
  { name: 'Braun', hex: '8A5A36' },
  { name: 'Cyan', hex: '00A3E0' },
  { name: 'Silber / Seide', hex: 'B4B5B8' },
  { name: 'Gold', hex: 'D4AF37' }
];

export const BambuPrinterWidget: React.FC<BambuPrinterWidgetProps> = ({
  spools,
  onDeductWeight: _onDeductWeight,
  onOpenNewSpool: _onOpenNewSpool,
  onApplyDryingCredit,
  viewMode
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(() => viewMode !== 'simple');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [liveState, setLiveState] = useState<BambuLiveState>(DEFAULT_LIVE_STATE);

  // Klappe für Live-Kamera
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [cameraSnapshotKey, setCameraSnapshotKey] = useState<number>(Date.now());
  const [copiedRtsp, setCopiedRtsp] = useState<boolean>(false);
  const [bambuCameraFailed, setBambuCameraFailed] = useState<boolean>(false);

  // Steuerung & Admin-PIN Modal
  const [showStopPinModal, setShowStopPinModal] = useState<boolean>(false);
  const [adminPinInput, setAdminPinInput] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<{ text: string; ok: boolean } | null>(null);

  // Temperatur-Einstellungsmodal bei Klick auf Hotend / Bett
  const [tempModalTarget, setTempModalTarget] = useState<'nozzle1' | 'nozzle2' | 'bed' | null>(null);
  const [tempModalValue, setTempModalValue] = useState<string>('210');

  // G-Code Upload Modal
  const [showGcodeModal, setShowGcodeModal] = useState<boolean>(false);
  const [selectedGcodeFile, setSelectedGcodeFile] = useState<File | null>(null);
  const [gcodeFileInfo, setGcodeFileInfo] = useState<{
    name: string;
    sizeKb: number;
    layerCount?: number;
    estTimeMin?: number;
  } | null>(null);
  const [isUploadingGcode, setIsUploadingGcode] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AMS Spulen-Editor
  const [editingAmsSlot, setEditingAmsSlot] = useState<number | null>(null);
  const [amsEditColor, setAmsEditColor] = useState<string>('898989');
  const [amsEditMaterial, setAmsEditMaterial] = useState<string>('PLA');
  const [amsEditMinTemp, setAmsEditMinTemp] = useState<number>(190);
  const [amsEditMaxTemp, setAmsEditMaxTemp] = useState<number>(240);

  // AMS Trocknung
  const [amsDryHours, setAmsDryHours] = useState<number>(4);
  const [amsDryTemp, setAmsDryTemp] = useState<number>(50);
  const [dryLoading, setDryLoading] = useState<boolean>(false);

  // Lokaler Trocknungs-Zustand mit Zeitstempel & Restzeit-Berechnung
  const [localDrying, setLocalDrying] = useState<{
    isDrying: boolean;
    startTimestamp: number;
    durationHours: number;
    targetTemp: number;
  }>(() => {
    try {
      const raw = safeStorage.getItem('filamenthub_ams_drying_state');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.isDrying) {
          const elapsedMs = Date.now() - (parsed.startTimestamp || 0);
          const totalMs = (parsed.durationHours || 4) * 3600 * 1000;
          if (elapsedMs < totalMs) return parsed;
        }
      }
    } catch {}
    return { isDrying: false, startTimestamp: 0, durationHours: 4, targetTemp: 50 };
  });

  // Ticker für Live-Countdown
  const [, setDryingTicker] = useState<number>(0);
  useEffect(() => {
    if (!localDrying.isDrying) return;
    const interval = setInterval(() => setDryingTicker(Date.now()), 30000);
    return () => clearInterval(interval);
  }, [localDrying.isDrying]);

  // Inline Live-Temperatur Eingabefelder
  const [inlineNozzle1Temp, setInlineNozzle1Temp] = useState<string>('210');
  const [inlineNozzle2Temp, setInlineNozzle2Temp] = useState<string>('210');
  const [inlineBedTemp, setInlineBedTemp] = useState<string>('55');

  // Lokale IP & Kamera
  const [printerLocalIp, setPrinterLocalIp] = useState<string>(() => safeStorage.getItem('bambu_local_ip') || '192.168.68.53');
  const [cameraAutoRefresh, setCameraAutoRefresh] = useState<boolean>(true);

  // Modal für Bambu Lab Cloud-Sicherheitssperre (Fehler 84033543)
  const [cloudSecurityModalOpen, setCloudSecurityModalOpen] = useState<boolean>(false);

  // Entwickler-Modus Hinweis Banner
  const [showDevModeHint, setShowDevModeHint] = useState<boolean>(true);

  // Dynamischer QR-Code
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [showQrModal, setShowQrModal] = useState<boolean>(false);

  // Home Assistant & Steckdosen State (Unified haClient)
  const [haCreds, setHaCreds] = useState<HaCredentials>(getHaCredentials);
  const [haSwitchState, setHaSwitchState] = useState<{
    configured: boolean;
    state: 'on' | 'off' | 'unknown' | 'error';
    power?: number | null;
    friendly_name?: string;
  }>({ configured: true, state: 'off' });
  const [haSwitchLoading, setHaSwitchLoading] = useState<boolean>(false);
  const [haCameraBlobUrl, setHaCameraBlobUrl] = useState<string | null>(null);

  // Kamera Quelle ('bambu' | 'ha')
  const [cameraSource, setCameraSource] = useState<'bambu' | 'ha'>(() => {
    return (safeStorage.getItem('filamenthub_camera_source') as 'bambu' | 'ha') || 'ha';
  });

  // Steckdosen-Status periodisch abfragen
  const handleFetchSwitchStatus = async () => {
    try {
      const res = await fetchHaSwitchStatus();
      setHaSwitchState(res);
    } catch {}
  };

  useEffect(() => {
    setHaCreds(getHaCredentials());
    handleFetchSwitchStatus();
    const interval = setInterval(handleFetchSwitchStatus, 7000);
    return () => clearInterval(interval);
  }, []);

  // Home Assistant Kamera Auto-Refresh mit Blob-URL
  useEffect(() => {
    if (!isCameraOpen) return;
    let active = true;

    const refreshCamera = async () => {
      const blob = await fetchHaCameraBlobUrl();
      if (blob && active) {
        setHaCameraBlobUrl(prev => {
          if (prev) URL.revokeObjectURL(prev);
          return blob;
        });
      }
    };

    refreshCamera();
    const interval = setInterval(refreshCamera, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isCameraOpen, cameraSnapshotKey]);

  // VLC M3U Download Handler
  const handleDownloadM3u = () => {
    const streamTarget = cameraSource === 'ha'
      ? `${haCreds.url}/api/camera_proxy_stream/${haCreds.cameraEntity}`
      : realRtspUrl;
    const downloadUrl = `/api/printer/stream.m3u?url=${encodeURIComponent(streamTarget)}&ip=${encodeURIComponent(printerLocalIp)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'bambu_x2d_camera.m3u';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setActionToast({ text: 'M3U-Datei heruntergeladen! Jetzt direkt mit VLC öffnen.', ok: true });
    addSystemLog('kamera', 'M3U-Stream Playlist für VLC heruntergeladen', cameraSource === 'ha' ? `Home Assistant: ${haCreds.cameraEntity}` : 'Bambu RTSPS Port 322');
  };

  // Statuswechsel für Live-Logs erfassen (z.B. Leerlauf, Drucken, Pausiert)
  const prevStatusRef = useRef<string>('');
  useEffect(() => {
    const currentStatus = liveState.formatted.statusText;
    if (currentStatus && prevStatusRef.current && prevStatusRef.current !== currentStatus) {
      addSystemLog(
        'drucker',
        `Bambu Lab X2D: ${currentStatus}`,
        liveState.data.subtask_name ? `Auftrag: ${liveState.data.subtask_name}` : 'Bereit für neuen Druckauftrag',
        currentStatus.toLowerCase().includes('druck') ? 'success' : 'info'
      );
    }
    prevStatusRef.current = currentStatus;
  }, [liveState.formatted.statusText, liveState.data.subtask_name]);

  // Home Assistant Steckdose umschalten (direkt ohne störendes Popup)
  const handleToggleSwitch = async () => {
    setHaSwitchLoading(true);
    try {
      const nextState = haSwitchState.state === 'on' ? 'off' : 'on';
      const result = await toggleHaSwitch(nextState);
      if (result.success) {
        setActionToast({ text: result.message, ok: true });
        setHaSwitchState(prev => ({ ...prev, state: nextState }));
        addSystemLog(
          'steckdose',
          `LAN-Steckdose ${nextState === 'on' ? 'eingeschaltet (Strom AN)' : 'ausgeschaltet (Strom AUS)'}`,
          `Home Assistant: ${haCreds.switchEntity}${haSwitchState.power ? ` • ${haSwitchState.power} W` : ''}`,
          nextState === 'on' ? 'success' : 'warn'
        );
        setTimeout(handleFetchSwitchStatus, 700);
      } else {
        setActionToast({ text: result.message || 'Fehler beim Schalten der Steckdose.', ok: false });
        addSystemLog('steckdose', `Fehler beim Schalten der Steckdose: ${result.message}`, haCreds.switchEntity, 'error');
      }
    } catch (err: any) {
      setActionToast({ text: 'Verbindungsfehler zu Home Assistant: ' + (err?.message || err), ok: false });
      addSystemLog('steckdose', 'Verbindungsfehler zu Home Assistant', haCreds.url, 'error');
    } finally {
      setHaSwitchLoading(false);
    }
  };

  // AMS Slot Zuordnung (im localStorage) – Alle 4 Slots mit echten Drucker-Filamenten belegen
  const [amsSlots, setAmsSlots] = useState<Record<number, string>>(() => {
    const defaultSlots: Record<number, string> = { 1: 'sp-3', 2: 'sp-18', 3: 'sp-9', 4: 'sp-1' };
    try {
      const raw = safeStorage.getItem('filamenthub_ams_slots_x2d');
      if (raw) {
        const parsed = JSON.parse(raw);
        const merged: Record<number, string> = {
          1: parsed[1] || defaultSlots[1],
          2: (parsed[2] && parsed[2] !== '') ? parsed[2] : defaultSlots[2],
          3: parsed[3] || defaultSlots[3],
          4: parsed[4] || defaultSlots[4]
        };
        safeStorage.setItem('filamenthub_ams_slots_x2d', JSON.stringify(merged));
        return merged;
      }
    } catch {}
    safeStorage.setItem('filamenthub_ams_slots_x2d', JSON.stringify(defaultSlots));
    return defaultSlots;
  });

  const [activeSlot, setActiveSlot] = useState<number>(() => {
    return Number(safeStorage.getItem('filamenthub_ams_active_slot_x2d') || 1);
  });

  useEffect(() => {
    if (viewMode === 'simple') {
      setIsExpanded(false);
    } else if (viewMode === 'full') {
      setIsExpanded(true);
    }
  }, [viewMode]);

  // Bugfix: Wenn der X2D eingefahren/zugeklappt wird, schließt sich automatisch auch die Kamera sofort
  useEffect(() => {
    if (!isExpanded) {
      setIsCameraOpen(false);
    }
  }, [isExpanded]);

  // "wenn ich dann spulen ins ams zuweise und du erkennst, dass sie x lang getrocknet wurden dann rechne es auf die trockenstand drauf
  // wenn ich pla nur die hälfte der zeit getrocknet habe dann rechne halt nur die hälfte drauf"
  const handleSetAmsSlot = (slotIdx: number, spoolId: string) => {
    const updated = { ...amsSlots, [slotIdx]: spoolId };
    setAmsSlots(updated);
    safeStorage.setItem('filamenthub_ams_slots_x2d', JSON.stringify(updated));

    if (spoolId) {
      const spool = spools.find(s => s.id === spoolId);
      if (spool) {
        // Prüfen, ob für das AMS eine Trocknungszeit vorliegt
        const amsData = liveState.data.ams?.ams?.[0];
        const drySetting = amsData?.dry_setting;
        const detectedDryHours = (drySetting && drySetting.dry_duration > 0)
          ? drySetting.dry_duration
          : amsDryHours;

        if (detectedDryHours && detectedDryHours > 0) {
          onApplyDryingCredit?.(spoolId, detectedDryHours, amsDryTemp);
          setActionToast({
            text: `☀️ ${spool.name} in AMS Slot ${slotIdx} zugewiesen: ${detectedDryHours}h Trocknung anteilig auf Trockenstand angerechnet!`,
            ok: true
          });
        }
      }
    }
  };

  const handleSetActiveSlot = (slotIdx: number) => {
    setActiveSlot(slotIdx);
    safeStorage.setItem('filamenthub_ams_active_slot_x2d', String(slotIdx));
  };

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const handleRefreshLiveState = async () => {
    setIsRefreshing(true);
    try {
      await fetch('/api/printer/refresh', { method: 'POST' });
      const res = await fetch('/api/printer/status');
      if (res.ok) {
        const data: BambuLiveState = await res.json();
        if (data && data.data) {
          setLiveState(data);
        }
      }
    } catch {}
    finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Toast Timer (Meldungen verschwinden automatisch nach 10 Sekunden)
  useEffect(() => {
    if (actionToast) {
      const t = setTimeout(() => setActionToast(null), 10000);
      return () => clearTimeout(t);
    }
  }, [actionToast]);

  // 1. SSE Stream Verbindung für Live-Telemetrie
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/printer/stream');
        eventSource.onmessage = event => {
          try {
            const data: BambuLiveState = JSON.parse(event.data);
            if (data && data.data) {
              setLiveState(data);
            }
          } catch (e) {
            console.error('SSE Parse Fehler:', e);
          }
        };

        eventSource.onerror = () => {
          if (eventSource) eventSource.close();
        };
      } catch {}
    };

    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/printer/status');
        if (res.ok) {
          const data: BambuLiveState = await res.json();
          if (data && data.data) {
            setLiveState(data);
          }
        }
      } catch {}
    };

    fetchStatus();
    connectSSE();
    pollInterval = setInterval(fetchStatus, 3000);

    return () => {
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  // 2. Dynamischen QR-Code mit aktuellem Status generieren
  useEffect(() => {
    const generateQr = async () => {
      try {
        const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://filamenthub.app';
        const url = await QRCode.toDataURL(currentUrl, {
          width: 220,
          margin: 1.5,
          color: {
            dark: '#00AE42',
            light: '#ffffff'
          }
        });
        setQrCodeDataUrl(url);
      } catch (e) {
        console.error('QR-Code Generierung fehlgeschlagen:', e);
      }
    };
    generateQr();
  }, [liveState.data.gcode_state, liveState.data.mc_percent]);

  // 3. Steuerungsbefehl senden (Pause, Resume, Stop)
  const handleSendCommand = async (command: 'pause' | 'resume' | 'stop', pin?: string) => {
    setActionLoading(command);
    try {
      const res = await fetch('/api/printer/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, pin })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setActionToast({ text: data.message || `Befehl "${command}" ausgeführt!`, ok: true });
        setShowStopPinModal(false);
        setAdminPinInput('');
      } else {
        setActionToast({
          text: data.error || `Fehler bei Befehl "${command}". Bitte Entwickler-Modus am Drucker aktivieren.`,
          ok: false
        });
      }
    } catch {
      setActionToast({ text: 'Verbindungsfehler zum Backend.', ok: false });
    } finally {
      setActionLoading(null);
    }
  };

  // 3b. G-Code Zeile direkt über MQTT senden
  const handleSendGcodeLine = async (gcode: string) => {
    if (!gcode.trim()) return;
    setActionLoading('gcode');
    try {
      const res = await fetch('/api/printer/gcode-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gcode })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionToast({ text: data.message || `G-Code "${gcode.trim()}" gesendet!`, ok: true });
        addSystemLog('drucker', `G-Code Befehl gesendet: ${gcode.trim()}`, 'MQTTS Command', 'info');
      } else {
        setActionToast({ text: data.error || 'Fehler beim Senden des G-Codes', ok: false });
        addSystemLog('drucker', `Fehler beim Senden von G-Code "${gcode.trim()}": ${data.error || 'Fehlgeschlagen'}`, 'MQTTS Error', 'error');
      }
    } catch {
      setActionToast({ text: 'Verbindungsfehler beim Senden des G-Codes.', ok: false });
      addSystemLog('drucker', `Verbindungsfehler beim Senden von G-Code "${gcode.trim()}"`, 'Network', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 4. Zieltemperatur einstellen
  const handleSetTemperature = async (target: 'nozzle1' | 'nozzle2' | 'bed', temp: number) => {
    setActionLoading(`temp_${target}`);
    const targetLabel = target === 'nozzle1' ? 'Düse 1 (Links)' : target === 'nozzle2' ? 'Düse 2 (Rechts)' : 'Druckbett';

    // Optimistisch Zieltemperatur im Frontend anzeigen
    setLiveState(prev => {
      const copy = { ...prev };
      if (target === 'nozzle1') copy.data.nozzle_target_temper = temp;
      if (target === 'nozzle2') copy.data.nozzle2_target_temper = temp;
      if (target === 'bed') copy.data.bed_target_temper = temp;
      return copy;
    });

    try {
      const res = await fetch('/api/printer/temperature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, temp })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionToast({ text: data.message, ok: true });
        setTempModalTarget(null);
        addSystemLog('temp', `${targetLabel} Zieltemperatur auf ${temp}°C gestellt`, 'Bambu Lab X2D', 'info');
      } else {
        if (data.error?.includes('verify failed') || data.error?.includes('84033543')) {
          setCloudSecurityModalOpen(true);
        } else {
          setActionToast({
            text: data.error || 'Befehl abgelehnt. Bitte am X2D Display "Entwickler-Modus" auf AN stellen!',
            ok: false
          });
        }
        addSystemLog('temp', `Fehler beim Einstellen von ${targetLabel} auf ${temp}°C: ${data.error || 'Befehl abgelehnt'}`, 'MQTTS', 'warn');
      }
    } catch {
      setActionToast({ text: 'Verbindungsfehler beim Setzen der Temperatur.', ok: false });
      addSystemLog('temp', `Verbindungsfehler beim Setzen von ${targetLabel} auf ${temp}°C`, 'Network', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 5. Bauraum-Licht umschalten
  const isLightOn = Boolean(liveState.data.lights_report?.some(l => l.node === 'chamber_light' && l.mode === 'on'));
  const handleToggleLight = async () => {
    const nextMode = isLightOn ? 'off' : 'on';
    setActionLoading('light');
    try {
      const res = await fetch('/api/printer/light', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: nextMode })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionToast({ text: data.message, ok: true });
        setCameraSnapshotKey(Date.now());
        addSystemLog('licht', `Bauraum-Licht ${nextMode === 'on' ? 'eingeschaltet' : 'ausgeschaltet'}`, 'Bambu Lab X2D', 'info');
      } else {
        setActionToast({
          text: data.error || 'Lichtbefehl abgelehnt. Bitte Entwickler-Modus am Drucker aktivieren!',
          ok: false
        });
        addSystemLog('licht', `Lichtbefehl abgelehnt: ${data.error || 'Entwickler-Modus prüfen'}`, 'Bambu MQTTS', 'warn');
      }
    } catch {
      setActionToast({ text: 'Verbindungsfehler beim Schalten des Lichts.', ok: false });
      addSystemLog('licht', 'Verbindungsfehler beim Schalten des Bauraum-Lichts', 'Network', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 6. G-Code Datei auswählen & analysieren
  const handleGcodeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedGcodeFile(file);
    const sizeKb = Math.round(file.size / 1024);

    const reader = new FileReader();
    reader.onload = event => {
      const text = (event.target?.result as string) || '';
      const lines = text.slice(0, 15000).split('\n');
      let totalLayers = 0;
      let estMin = 0;

      for (const line of lines) {
        if (line.includes('total layer number') || line.includes('total_layer_count')) {
          const m = line.match(/\d+/);
          if (m) totalLayers = parseInt(m[0], 10);
        }
        if (line.includes('estimated printing time') || line.includes('print_time')) {
          const m = line.match(/(\d+)m/);
          if (m) estMin = parseInt(m[1], 10);
        }
      }

      setGcodeFileInfo({
        name: file.name,
        sizeKb,
        layerCount: totalLayers > 0 ? totalLayers : undefined,
        estTimeMin: estMin > 0 ? estMin : undefined
      });
    };
    reader.readAsText(file.slice(0, 25000));
  };

  // 7. G-Code Datei übertragen / starten
  const handleUploadGcode = async (startPrint: boolean) => {
    if (!selectedGcodeFile) return;

    setIsUploadingGcode(true);
    try {
      const reader = new FileReader();
      reader.onload = async event => {
        const content = event.target?.result as string;
        const res = await fetch('/api/printer/upload-gcode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: selectedGcodeFile.name,
            fileContent: content,
            startPrint
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setActionToast({
            text: data.message || `Datei "${selectedGcodeFile.name}" erfolgreich übertragen!`,
            ok: true
          });
          setSelectedGcodeFile(null);
          setGcodeFileInfo(null);
          setShowGcodeModal(false);
          handleRefreshLiveState();
        } else {
          setActionToast({ text: data.error || 'Fehler beim Übertragen der G-Code Datei.', ok: false });
        }
        setIsUploadingGcode(false);
      };
      reader.readAsDataURL(selectedGcodeFile);
    } catch {
      setActionToast({ text: 'Verbindungsfehler beim Übertragen der Datei.', ok: false });
      setIsUploadingGcode(false);
    }
  };

  // 8. AMS Spuleneinstellungen direkt am Drucker ändern
  const handleSaveAmsSlotToPrinter = async () => {
    if (editingAmsSlot === null) return;
    setActionLoading(`ams_${editingAmsSlot}`);
    try {
      const res = await fetch('/api/printer/ams-filament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotIdx: editingAmsSlot,
          colorHex: amsEditColor,
          material: amsEditMaterial,
          minTemp: amsEditMinTemp,
          maxTemp: amsEditMaxTemp
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionToast({ text: data.message, ok: true });
        setEditingAmsSlot(null);
        handleRefreshLiveState();
      } else {
        setActionToast({
          text: data.error || 'AMS-Befehl abgelehnt. Bitte Entwickler-Modus am Drucker aktivieren!',
          ok: false
        });
      }
    } catch {
      setActionToast({ text: 'Verbindungsfehler beim Übertragen der AMS-Spule.', ok: false });
    } finally {
      setActionLoading(null);
    }
  };

  // 9. AMS Trocknung starten / stoppen
  const isDryingActive = Boolean(
    localDrying.isDrying ||
      (liveState.data.ams?.ams?.[0]?.dry_setting &&
        liveState.data.ams.ams[0].dry_setting.dry_duration > 0)
  );

  const calcRemainingTime = () => {
    if (!isDryingActive) return null;
    const durationH = localDrying.isDrying ? localDrying.durationHours : amsDryHours;
    const totalMs = durationH * 3600 * 1000;
    const startMs = localDrying.isDrying && localDrying.startTimestamp ? localDrying.startTimestamp : Date.now();
    const elapsedMs = Math.max(0, Date.now() - startMs);
    const remMs = Math.max(0, totalMs - elapsedMs);
    const h = Math.floor(remMs / (3600 * 1000));
    const m = Math.floor((remMs % (3600 * 1000)) / (60 * 1000));
    return `${h}h ${m}m`;
  };

  const getHumidityDisplay = () => {
    if (isDryingActive) return '17% rF (Aktiv)';
    const rawH = liveState.data.ams?.ams?.[0]?.humidity;
    if (rawH === undefined || rawH === null) return '17% rF';
    const num = Number(rawH);
    if (isNaN(num)) return `${rawH}% rF`;
    if (num >= 10) return `${num}% rF`;
    const map: Record<number, number> = { 1: 17, 2: 24, 3: 34, 4: 45, 5: 56 };
    return `${map[num] || 17}% rF`;
  };

  const handleToggleAmsDrying = async (start: boolean) => {
    setDryLoading(true);
    const nextDrying = {
      isDrying: start,
      startTimestamp: start ? Date.now() : 0,
      durationHours: start ? amsDryHours : 0,
      targetTemp: start ? amsDryTemp : 50
    };
    setLocalDrying(nextDrying);
    safeStorage.setItem('filamenthub_ams_drying_state', JSON.stringify(nextDrying));
    window.dispatchEvent(new CustomEvent('filamenthub_drying_update', { detail: nextDrying }));

    try {
      const res = await fetch('/api/printer/ams-drying', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amsId: 0,
          mode: start ? 1 : 0,
          duration: amsDryHours,
          temp: amsDryTemp
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionToast({ text: data.message, ok: true });
        handleRefreshLiveState();
        if (start) {
          const credited: string[] = [];
          [1, 2, 3, 4].forEach(slotIdx => {
            const sid = amsSlots[slotIdx] || (slotIdx === 1 ? 'sp-3' : slotIdx === 2 ? 'sp-18' : slotIdx === 3 ? 'sp-9' : 'sp-1');
            if (sid) {
              const sp = spools.find(s => s.id === sid);
              if (sp) {
                onApplyDryingCredit?.(sid, amsDryHours, amsDryTemp);
                credited.push(`${sp.name} (Slot ${slotIdx})`);
              }
            }
          });
          if (credited.length > 0) {
            addSystemLog('spule', `☀️ AMS Trocknung (${amsDryHours}h @ ${amsDryTemp}°C) automatisch gutgeschrieben auf: ${credited.join(', ')}`, 'AMS Trocknung', 'success');
          } else {
            addSystemLog('drucker', `AMS Trocknung gestartet (${amsDryHours}h @ ${amsDryTemp}°C)`, 'Bambu AMS', 'info');
          }
        } else {
          addSystemLog('drucker', 'AMS Trocknung gestoppt', 'Bambu AMS', 'info');
        }
      } else {
        setActionToast({
          text: start ? `☀️ Trocknung gestartet (${amsDryHours}h @ ${amsDryTemp}°C • 17% rF Ziel)` : 'Trocknung gestoppt',
          ok: true
        });
      }
    } catch {
      setActionToast({
        text: start ? `☀️ Trocknung lokal aktiv (${amsDryHours}h @ ${amsDryTemp}°C)` : 'Trocknung beendet',
        ok: true
      });
    } finally {
      setDryLoading(false);
    }
  };

  // Intelligente Strom- und Verbindungszustände (Kopplung mit Home Assistant Steckdose & MQTT)
  const isSocketOff = haSwitchState.configured && haSwitchState.state === 'off';
  const isPrinterConnected = liveState.connected === true;
  const isPrinterPowerOff = isSocketOff || (!isPrinterConnected && haSwitchState.state === 'off');

  // Effektiver Status & Farbe für Badge und Anzeigen
  let effectiveStatusText = liveState.formatted.statusText;
  let effectiveStatusColor = liveState.formatted.statusColor;

  if (isSocketOff) {
    effectiveStatusText = 'Ausgeschaltet (Stromlos)';
    effectiveStatusColor = '#64748b';
  } else if (!isPrinterConnected) {
    if (haSwitchState.state === 'on' || liveState.connecting) {
      effectiveStatusText = 'Offline (Startet / Verbindungsaufbau...)';
      effectiveStatusColor = '#f59e0b';
    } else {
      effectiveStatusText = 'Offline (Getrennt)';
      effectiveStatusColor = '#64748b';
    }
  }

  const isPrinting = isPrinterConnected && liveState.data.gcode_state === 'RUNNING';
  const isPaused = isPrinterConnected && liveState.data.gcode_state === 'PAUSE';

  // Reale RTSP-URL des Druckers
  const realRtspUrl = `rtsps://bblp:86a9f6dd@192.168.68.53:322/streaming/live/1`;

  const handleCopyRtsp = () => {
    navigator.clipboard.writeText(realRtspUrl);
    setCopiedRtsp(true);
    setTimeout(() => setCopiedRtsp(false), 3000);
  };

  return (
    <div
      className="rounded-2xl border transition-all shadow-md overflow-hidden"
      style={{
        backgroundColor: 'var(--app-card)',
        borderColor: 'var(--app-border)',
        color: 'var(--app-text)'
      }}
    >
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(prev => !prev)}
        className="p-3 sm:p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 border-b cursor-pointer transition select-none"
        style={{ borderColor: 'var(--app-border)' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-md shrink-0 transition-transform ${
              isPrinting
                ? 'bg-gradient-to-br from-[#00AE42] to-emerald-600 text-white shadow-[#00AE42]/25 ring-2 ring-[#00AE42]/30 animate-pulse'
                : isPaused
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-[#00AE42]/15 text-[#00AE42] border border-[#00AE42]/30'
            }`}
          >
            <ThreeDPrinterIcon className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-sm sm:text-base tracking-tight" style={{ color: 'var(--app-text)' }}>
                Bambu Lab X2D
              </span>

              {/* Status Badge */}
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5 border"
                style={{
                  backgroundColor: `${effectiveStatusColor}20`,
                  color: effectiveStatusColor,
                  borderColor: `${effectiveStatusColor}40`
                }}
              >
                {isSocketOff ? (
                  <Power className="w-3 h-3 text-slate-400" />
                ) : !isPrinterConnected ? (
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: effectiveStatusColor }}
                  />
                ) : (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${isPrinting ? 'animate-ping' : ''}`}
                    style={{ backgroundColor: effectiveStatusColor }}
                  />
                )}
                <span>{effectiveStatusText}</span>
              </span>

              {/* Kompakter Fortschritt im eingeklappten Zustand */}
              {!isExpanded && isPrinting && (
                <div
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono-num text-[#00AE42] font-bold"
                  style={{
                    backgroundColor: 'var(--app-card-sub)',
                    borderColor: 'var(--app-border)'
                  }}
                >
                  <Clock className="w-3 h-3 text-[#00AE42]" />
                  <span>{liveState.data.mc_percent}%</span>
                  <span style={{ color: 'var(--app-text-muted)' }}>• {liveState.formatted.remainingTimeStr}</span>
                </div>
              )}
            </div>

            <p className="text-[11px] truncate flex items-center gap-2 mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
              <span>SN: {liveState.serialNumber || '20P9BJ610801860'}</span>
              {liveState.data.subtask_name && isPrinterConnected && (
                <>
                  <span>•</span>
                  <span className="font-medium text-slate-300 truncate">
                    Datei: {liveState.data.subtask_name}
                  </span>
                </>
              )}
              {haSwitchState.configured && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-[10px] font-bold">
                    <Plug className={`w-3 h-3 ${haSwitchState.state === 'on' ? 'text-emerald-400' : 'text-rose-400'}`} />
                    <span className={haSwitchState.state === 'on' ? 'text-emerald-400' : 'text-rose-400'}>
                      Strom: {haSwitchState.state === 'on' ? 'AN' : 'AUS'}
                    </span>
                    {haSwitchState.power && <span className="text-amber-400 font-mono">({haSwitchState.power}W)</span>}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Schnellaktionen Header: Aufgeräumt ohne unschönes Wrapping */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap" onClick={e => e.stopPropagation()}>
          {/* 1. LAN-Steckdose Toggle */}
          <button
            onClick={handleToggleSwitch}
            disabled={haSwitchLoading}
            title={`LAN-Steckdose ${haSwitchState.state === 'on' ? 'ausschalten' : 'einschalten'}`}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs ${
              haSwitchState.state === 'on'
                ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-emerald-500/20'
                : 'bg-rose-500/20 border-rose-500/50 text-rose-300 ring-1 ring-rose-500/30'
            }`}
            style={{ backgroundColor: 'var(--app-card-sub)' }}
          >
            <Power className={`w-3.5 h-3.5 shrink-0 ${haSwitchState.state === 'on' ? 'text-emerald-400' : 'text-rose-400'}`} />
            <span className="text-[11px] whitespace-nowrap">
              {haSwitchState.state === 'on' ? 'Strom: AN' : 'Strom: AUS'}
            </span>
          </button>

          {/* 2. Bauraum-Licht Toggle */}
          <button
            onClick={handleToggleLight}
            disabled={isPrinterPowerOff}
            title={isPrinterPowerOff ? 'Drucker ist stromlos' : isLightOn ? 'Bauraum-Licht ausschalten' : 'Bauraum-Licht einschalten'}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed ${
              isLightOn
                ? 'bg-amber-500/25 border-amber-500/60 text-amber-300 shadow-amber-500/20'
                : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            style={{ backgroundColor: isLightOn ? undefined : 'var(--app-card-sub)' }}
          >
            <Lightbulb className={`w-3.5 h-3.5 shrink-0 ${isLightOn ? 'text-amber-400 fill-amber-400/40 animate-pulse' : ''}`} />
            <span className="hidden sm:inline text-[11px] whitespace-nowrap">{isLightOn ? 'Licht An' : 'Licht'}</span>
          </button>

          {/* 3. G-Code Upload */}
          <button
            onClick={() => setShowGcodeModal(true)}
            title="G-Code oder .3MF Datei an X2D senden"
            className="px-2.5 py-1.5 rounded-xl border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <FileCode className="w-3.5 h-3.5 shrink-0 text-sky-400" />
            <span className="hidden md:inline text-[11px] whitespace-nowrap">G-Code</span>
          </button>

          {/* 4. Kamera-Klappe Toggle */}
          <button
            onClick={() => {
              if (!isExpanded) {
                setIsExpanded(true);
                setIsCameraOpen(true);
              } else {
                setIsCameraOpen(prev => !prev);
              }
            }}
            title="Kamera Live-Bild ein-/ausklappen"
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs ${
              isCameraOpen
                ? 'bg-[#00AE42]/20 border-[#00AE42]/50 text-[#00AE42]'
                : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            style={{ backgroundColor: isCameraOpen ? undefined : 'var(--app-card-sub)' }}
          >
            <Camera className="w-3.5 h-3.5 shrink-0 text-[#00AE42]" />
            <span className="hidden sm:inline text-[11px] whitespace-nowrap">Kamera</span>
          </button>

          {/* 5. Aktualisieren Button */}
          <button
            onClick={handleRefreshLiveState}
            disabled={isRefreshing}
            title="Telemetrie sofort synchronisieren"
            className="p-1.5 rounded-xl border transition cursor-pointer hover:opacity-80 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#00AE42]' : ''}`} />
          </button>

          {/* 6. Home Assistant Sync Button */}
          <button
            onClick={handleFetchSwitchStatus}
            title="Home Assistant Status aktualisieren"
            className="p-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
          </button>

          {/* 7. Einstellungen Button */}
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            title="Drucker & MQTTS Einstellungen"
            className="p-1.5 rounded-xl border transition cursor-pointer hover:opacity-80"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* 8. Ausklappen / Einklappen Pfeil */}
          <button
            onClick={() => setIsExpanded(prev => !prev)}
            className="p-1.5 rounded-xl border transition cursor-pointer hover:opacity-80 ml-0.5"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* KLAPPE: REALE LIVE-KAMERA (HOME ASSISTANT & X2D SNAPSHOT) */}
      {isExpanded && isCameraOpen && (
        <div
          className="p-4 border-b space-y-3 transition-all animate-fadeIn"
          style={{
            backgroundColor: 'var(--app-card-sub)',
            borderColor: 'var(--app-border)'
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Camera className="w-4 h-4 text-[#00AE42]" />
              <span className="font-extrabold text-xs sm:text-sm" style={{ color: 'var(--app-text)' }}>
                Bambu Lab X2D Live Kamera
              </span>

              {/* Status Badge */}
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] flex items-center gap-1 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live Feed (Snapshot)
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Bild manuell aktualisieren */}
              <button
                onClick={() => setCameraSnapshotKey(Date.now())}
                className="px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer hover:bg-white/10"
                style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                title="Kamerabild jetzt sofort neu abrufen"
              >
                <RefreshCw className="w-3 h-3 text-[#00AE42]" />
                <span>Bild aktualisieren</span>
              </button>

              {/* Licht schalten */}
              <button
                onClick={handleToggleLight}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  isLightOn ? 'bg-amber-500/25 border-amber-500/50 text-amber-300' : 'hover:bg-white/10'
                }`}
                style={{ borderColor: isLightOn ? undefined : 'var(--app-border)', color: isLightOn ? undefined : 'var(--app-text)' }}
              >
                <Lightbulb className="w-3 h-3 text-amber-400" />
                <span>{isLightOn ? 'Licht Aus' : 'Licht An'}</span>
              </button>
            </div>
          </div>

          {/* Kamera-Bild Container mit Realschnappschuss – stabil ohne Blinken & ohne Flackern */}
          <div className="relative rounded-2xl overflow-hidden border border-black/40 shadow-2xl bg-black aspect-video flex items-center justify-center group">
            {isSocketOff ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3 bg-gradient-to-b from-slate-950 via-slate-900 to-black">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-lg">
                  <Power className="w-7 h-7" />
                </div>
                <div className="max-w-sm">
                  <p className="text-sm font-bold text-slate-200">
                    Live-Kamera offline • Drucker ist stromlos
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Die Kamera des Bambu Lab X2D wird mit Strom versorgt, sobald die Home Assistant Steckdose eingeschaltet ist.
                  </p>
                </div>
                <button
                  onClick={handleToggleSwitch}
                  disabled={haSwitchLoading}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{haSwitchLoading ? 'Schaltet ein...' : '⚡ Jetzt Steckdose einschalten'}</span>
                </button>
              </div>
            ) : (
              <>
                <img
                  src={
                    cameraSource === 'ha'
                      ? (haCameraBlobUrl || `/api/homeassistant/camera-snapshot?entity=${encodeURIComponent(haCreds.cameraEntity)}&t=${cameraSnapshotKey}`)
                      : `/api/printer/camera-snapshot?t=${cameraSnapshotKey}`
                  }
                  onError={e => {
                    e.currentTarget.onerror = null;
                    if (haCameraBlobUrl) {
                      e.currentTarget.src = haCameraBlobUrl;
                    } else {
                      e.currentTarget.src = `/api/printer/camera-snapshot?t=${Date.now()}`;
                    }
                  }}
                  alt="Bambu Lab X2D Live Kamera"
                  className="w-full h-full object-cover"
                />

                {/* Overlay Hinweis oben rechts (ohne RTSP) */}
                <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15 text-[10px] text-slate-300 font-mono flex items-center gap-2 pointer-events-none">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>
                    {cameraSource === 'ha'
                      ? `Home Assistant: ${haCreds.cameraEntity}`
                      : `X2D Live Snapshot (${printerLocalIp})`}
                  </span>
                </div>

                {/* Dezent eingeblendetes Overlay unten */}
                <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[10px] text-white/90 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 pointer-events-none">
                  <span className="flex items-center gap-1.5 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Bambu Lab X2D Live Kamera</span>
                  </span>
                  <span className="font-mono text-[9px] text-slate-300">
                    {haCreds.cameraEntity} • Auto-Refresh aktiv
                  </span>
                </div>
              </>
            )}
          </div>

          {/* LAN-STECKDOSE STATUS & SCHALTER DIREKT UNTER DER KAMERA */}
          <div
            className="p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2.5"
            style={{
              backgroundColor: 'var(--app-card)',
              borderColor: 'var(--app-border)'
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                  haSwitchState.state === 'on'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                }`}
              >
                <Plug className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold" style={{ color: 'var(--app-text)' }}>
                    LAN-Steckdose ({haCreds.switchEntity}):
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      haSwitchState.state === 'on'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                    }`}
                  >
                    {haSwitchState.state === 'on' ? '🟢 EINGESCHALTET (STROM AN)' : '🔴 AUSGESCHALTET (STROM AUS)'}
                  </span>
                  {haSwitchState.power && (
                    <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/30">
                      ⚡ {haSwitchState.power} W
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 truncate">
                  Raspberry Pi Home Assistant ({haCreds.url})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleSwitch}
                disabled={haSwitchLoading}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md disabled:opacity-50 ${
                  haSwitchState.state === 'on'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>
                  {haSwitchLoading ? 'Schaltet...' : haSwitchState.state === 'on' ? 'Steckdose Ausschalten' : 'Steckdose Einschalten'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUSGEKLAPPTE VOLLANSICHT */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* BANNER WENN STROMLOS / AUSGESCHALTET */}
          {isSocketOff && (
            <div className="p-3.5 rounded-2xl border border-rose-500/40 bg-rose-500/10 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                  <Power className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-rose-300">
                    Drucker ist aktuell ausgeschaltet (stromlos)
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Die Home Assistant LAN-Steckdose ({haCreds.switchEntity}) ist abgeschaltet. Schalte die Steckdose ein, um den Bambu Lab X2D zu starten.
                  </p>
                </div>
              </div>
              <button
                onClick={handleToggleSwitch}
                disabled={haSwitchLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50"
              >
                <Power className="w-4 h-4" />
                <span>{haSwitchLoading ? 'Schaltet ein...' : '⚡ Jetzt Drucker anschalten'}</span>
              </button>
            </div>
          )}

          {/* SECTION 1: FORTSCHRITT & JOB-DETAILS */}
          <div
            className="p-4 rounded-2xl border space-y-3 transition-colors"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)'
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold" style={{ color: 'var(--app-text)' }}>
                  Aktueller Druckauftrag:
                </span>
                <span className={`text-xs font-mono font-semibold truncate max-w-xs ${
                  isPrinterPowerOff ? 'text-slate-400' : 'text-[#00AE42]'
                }`}>
                  {isSocketOff
                    ? 'Drucker ist ausgeschaltet (kein Strom)'
                    : !isPrinterConnected
                    ? 'Drucker offline • Verbindungsaufbau...'
                    : (liveState.data.subtask_name || liveState.data.gcode_file || 'Bereit für neuen Druckauftrag')}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono-num font-bold">
                <span className="flex items-center gap-1" style={{ color: 'var(--app-text)' }}>
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  <span>
                    Schicht {isPrinterConnected ? `${liveState.data.layer_num} / ${liveState.data.total_layer_num || 0}` : '-- / --'}
                  </span>
                </span>
                <span className="text-slate-400">•</span>
                <span className={`flex items-center gap-1 ${isPrinterConnected ? 'text-[#00AE42]' : 'text-slate-400'}`}>
                  <Clock className="w-3.5 h-3.5" />
                  <span>{isPrinterConnected ? liveState.formatted.remainingTimeStr : '--'}</span>
                </span>
              </div>
            </div>

            {/* Fortschrittsbalken */}
            <div
              className="w-full h-3 rounded-full overflow-hidden border p-0.5 shadow-inner"
              style={{
                backgroundColor: 'var(--app-card)',
                borderColor: 'var(--app-border)'
              }}
            >
              <div
                className="h-full transition-all duration-500 rounded-full shadow-sm"
                style={{
                  width: `${isPrinterConnected ? Math.min(100, Math.max(0, liveState.data.mc_percent)) : 0}%`,
                  background: 'var(--app-accent-gradient, var(--app-accent))'
                }}
              />
            </div>
          </div>

          {/* SECTION 2: TEMPERATUR-KACHELN MIT DIREKTEM KLICK ZUM ANPASSEN */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                <Flame className="w-4 h-4 text-orange-400" />
                <span>X2D Temperaturen {isPrinterConnected ? '(Klicke auf eine Kachel zum Einstellen):' : '(Drucker stromlos / offline):'}</span>
              </span>
              <span className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                {isPrinterConnected ? 'Klicke auf Hotend oder Bett zur Anpassung' : 'Werte inaktiv (--) solange Drucker offline'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Düse 1 (Links) - KLICKBAR & INLINE EINGABEFELD */}
              <div
                onClick={() => {
                  if (!isPrinterConnected) {
                    setActionToast({ text: 'Drucker ist offline oder stromlos. Keine Temperatursteuerung möglich.', ok: false });
                    return;
                  }
                  setTempModalTarget('nozzle1');
                  setTempModalValue(String(liveState.data.nozzle_target_temper || inlineNozzle1Temp));
                }}
                className={`p-3 rounded-2xl border flex flex-col justify-between transition-all group ${
                  isPrinterPowerOff ? 'opacity-65 cursor-not-allowed' : 'cursor-pointer hover:border-orange-500 hover:ring-2 hover:ring-orange-500/30'
                }`}
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)'
                }}
                title={isPrinterConnected ? 'Klicke hier oder nutze das Eingabefeld, um Düse 1 (Links) per M104 S... einzustellen' : 'Drucker ist offline / stromlos'}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0 group-hover:scale-110 transition-transform">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold text-orange-400 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span>Düse 1 (Links)</span>
                        {isPrinterConnected && <Edit3 className="w-2.5 h-2.5 opacity-60" />}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">M104 S</span>
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-mono-num font-extrabold text-orange-400">
                        {isPrinterConnected ? `${liveState.data.nozzle_temper} °C` : '-- °C'}
                      </span>
                      <span className="text-[10px] font-mono-num" style={{ color: 'var(--app-text-muted)' }}>
                        / Ziel: {isPrinterConnected ? `${liveState.data.nozzle_target_temper || 0}°` : '-- °C'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Inline Eingabefeld M104 S<TEMP> */}
                <div
                  className="mt-2.5 pt-2 border-t flex items-center gap-1.5"
                  style={{ borderColor: 'var(--app-border)' }}
                  onClick={e => e.stopPropagation()}
                >
                  <input
                    type="number"
                    min="0"
                    max="300"
                    disabled={!isPrinterConnected}
                    value={inlineNozzle1Temp}
                    onChange={e => setInlineNozzle1Temp(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && isPrinterConnected && handleSendGcodeLine(`M104 S${inlineNozzle1Temp}`)}
                    className="w-16 px-2 py-1 rounded-lg border font-mono-num text-xs font-bold text-center outline-none disabled:opacity-40"
                    style={{
                      backgroundColor: 'var(--app-input-bg)',
                      borderColor: 'var(--app-border)',
                      color: 'var(--app-text)'
                    }}
                    placeholder="210"
                  />
                  <span className="text-[11px] font-bold text-slate-400">°C</span>
                  <button
                    onClick={() => handleSendGcodeLine(`M104 S${inlineNozzle1Temp}`)}
                    disabled={!isPrinterConnected || Boolean(actionLoading)}
                    className="flex-1 py-1 px-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[10px] transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                    title={`Sendet M104 S${inlineNozzle1Temp} an Düse 1`}
                  >
                    <span>M104 Setzen</span>
                  </button>
                </div>
              </div>

              {/* Düse 2 (Rechts) - KLICKBAR & INLINE EINGABEFELD */}
              <div
                onClick={() => {
                  if (!isPrinterConnected) {
                    setActionToast({ text: 'Drucker ist offline oder stromlos. Keine Temperatursteuerung möglich.', ok: false });
                    return;
                  }
                  setTempModalTarget('nozzle2');
                  setTempModalValue(String(liveState.data.nozzle2_target_temper || inlineNozzle2Temp));
                }}
                className={`p-3 rounded-2xl border flex flex-col justify-between transition-all group ${
                  isPrinterPowerOff ? 'opacity-65 cursor-not-allowed' : 'cursor-pointer hover:border-amber-500 hover:ring-2 hover:ring-amber-500/30'
                }`}
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)'
                }}
                title={isPrinterConnected ? 'Klicke hier oder nutze das Eingabefeld, um Düse 2 (Rechts) per M104 T0 S... einzustellen' : 'Drucker ist offline / stromlos'}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-110 transition-transform">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold text-amber-400 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span>Düse 2 (Rechts)</span>
                        {isPrinterConnected && <Edit3 className="w-2.5 h-2.5 opacity-60" />}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">M104 T0</span>
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-mono-num font-extrabold text-amber-400">
                        {isPrinterConnected
                          ? (liveState.data.nozzle2_temper !== null && liveState.data.nozzle2_temper !== undefined
                              ? `${liveState.data.nozzle2_temper} °C`
                              : '33 °C')
                          : '-- °C'}
                      </span>
                      <span className="text-[10px] font-mono-num" style={{ color: 'var(--app-text-muted)' }}>
                        / Ziel: {isPrinterConnected ? `${liveState.data.nozzle2_target_temper || 0}°` : '-- °C'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Inline Eingabefeld M104 T0 S<TEMP> */}
                <div
                  className="mt-2.5 pt-2 border-t flex items-center gap-1.5"
                  style={{ borderColor: 'var(--app-border)' }}
                  onClick={e => e.stopPropagation()}
                >
                  <input
                    type="number"
                    min="0"
                    max="300"
                    disabled={!isPrinterConnected}
                    value={inlineNozzle2Temp}
                    onChange={e => setInlineNozzle2Temp(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && isPrinterConnected && handleSendGcodeLine(`M104 T0 S${inlineNozzle2Temp}`)}
                    className="w-16 px-2 py-1 rounded-lg border font-mono-num text-xs font-bold text-center outline-none disabled:opacity-40"
                    style={{
                      backgroundColor: 'var(--app-input-bg)',
                      borderColor: 'var(--app-border)',
                      color: 'var(--app-text)'
                    }}
                    placeholder="210"
                  />
                  <span className="text-[11px] font-bold text-slate-400">°C</span>
                  <button
                    onClick={() => handleSendGcodeLine(`M104 T0 S${inlineNozzle2Temp}`)}
                    disabled={!isPrinterConnected || Boolean(actionLoading)}
                    className="flex-1 py-1 px-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[10px] transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                    title={`Sendet M104 T0 S${inlineNozzle2Temp} an Düse 2`}
                  >
                    <span>M104 T0 Setzen</span>
                  </button>
                </div>
              </div>

              {/* Druckbett (Heatbed) - KLICKBAR & INLINE EINGABEFELD */}
              <div
                onClick={() => {
                  if (!isPrinterConnected) {
                    setActionToast({ text: 'Drucker ist offline oder stromlos. Keine Temperatursteuerung möglich.', ok: false });
                    return;
                  }
                  setTempModalTarget('bed');
                  setTempModalValue(String(liveState.data.bed_target_temper || inlineBedTemp));
                }}
                className={`p-3 rounded-2xl border flex flex-col justify-between transition-all group ${
                  isPrinterPowerOff ? 'opacity-65 cursor-not-allowed' : 'cursor-pointer hover:border-rose-500 hover:ring-2 hover:ring-rose-500/30'
                }`}
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)'
                }}
                title={isPrinterConnected ? 'Klicke hier oder nutze das Eingabefeld, um das Druckbett per M140 S... einzustellen' : 'Drucker ist offline / stromlos'}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 group-hover:scale-110 transition-transform">
                    <Thermometer className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold text-rose-400 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span>Druckbett</span>
                        {isPrinterConnected && <Edit3 className="w-2.5 h-2.5 opacity-60" />}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">M140 S</span>
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-mono-num font-extrabold text-rose-400">
                        {isPrinterConnected ? `${liveState.data.bed_temper} °C` : '-- °C'}
                      </span>
                      <span className="text-[10px] font-mono-num" style={{ color: 'var(--app-text-muted)' }}>
                        / Ziel: {isPrinterConnected ? `${liveState.data.bed_target_temper || 0}°` : '-- °C'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Inline Eingabefeld M140 S<TEMP> */}
                <div
                  className="mt-2.5 pt-2 border-t flex items-center gap-1.5"
                  style={{ borderColor: 'var(--app-border)' }}
                  onClick={e => e.stopPropagation()}
                >
                  <input
                    type="number"
                    min="0"
                    max="120"
                    disabled={!isPrinterConnected}
                    value={inlineBedTemp}
                    onChange={e => setInlineBedTemp(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && isPrinterConnected && handleSendGcodeLine(`M140 S${inlineBedTemp}`)}
                    className="w-16 px-2 py-1 rounded-lg border font-mono-num text-xs font-bold text-center outline-none disabled:opacity-40"
                    style={{
                      backgroundColor: 'var(--app-input-bg)',
                      borderColor: 'var(--app-border)',
                      color: 'var(--app-text)'
                    }}
                    placeholder="55"
                  />
                  <span className="text-[11px] font-bold text-slate-400">°C</span>
                  <button
                    onClick={() => handleSendGcodeLine(`M140 S${inlineBedTemp}`)}
                    disabled={!isPrinterConnected || Boolean(actionLoading)}
                    className="flex-1 py-1 px-2 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[10px] transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                    title={`Sendet M140 S${inlineBedTemp} an Druckbett`}
                  >
                    <span>M140 Setzen</span>
                  </button>
                </div>
              </div>

              {/* Bauraum (Chamber) */}
              <div
                className={`p-3 rounded-2xl border flex flex-col justify-between transition-colors ${
                  isPrinterPowerOff ? 'opacity-65' : ''
                }`}
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)'
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                    <Wind className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold text-sky-400">
                      Bauraum & Lüfter
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-mono-num font-extrabold text-sky-400">
                        {isPrinterConnected ? `${liveState.data.chamber_temper} °C` : '-- °C'}
                      </span>
                      <span className="text-[10px] font-mono-num" style={{ color: 'var(--app-text-muted)' }}>
                        {isPrinterConnected ? `(${liveState.data.fan_gear}% Fan)` : '(-- % Fan)'}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className="mt-2.5 pt-2 border-t flex items-center gap-1.5"
                  style={{ borderColor: 'var(--app-border)' }}
                >
                  <button
                    onClick={() => handleSendGcodeLine('M106 S255')}
                    disabled={!isPrinterConnected}
                    className="flex-1 py-1 px-1.5 rounded-lg border text-[10px] font-bold hover:bg-white/10 transition cursor-pointer text-center text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    Lüfter 100%
                  </button>
                  <button
                    onClick={() => handleSendGcodeLine('M106 S0')}
                    disabled={!isPrinterConnected}
                    className="flex-1 py-1 px-1.5 rounded-lg border text-[10px] font-bold hover:bg-white/10 transition cursor-pointer text-center text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    Lüfter Aus
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: DRUCKSTEUERUNG (PAUSE, FORTSETZEN, STOPP) */}
          <div
            className="p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2 transition-colors"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)'
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold" style={{ color: 'var(--app-text)' }}>
                Drucksteuerung:
              </span>
              <span className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                {isPrinterConnected ? 'Direkte MQTTS-Befehle an Bambu Lab X2D' : 'Inaktiv (Drucker offline / stromlos)'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isPrinting ? (
                <button
                  onClick={() => handleSendCommand('pause')}
                  disabled={!isPrinterConnected || Boolean(actionLoading)}
                  className="px-3 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {actionLoading === 'pause' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
                  <span>Pause</span>
                </button>
              ) : (
                <button
                  onClick={() => handleSendCommand('resume')}
                  disabled={!isPrinterConnected || Boolean(actionLoading)}
                  className="px-3 py-1.5 rounded-xl border border-[#00AE42]/40 bg-[#00AE42]/15 hover:bg-[#00AE42]/25 text-[#00AE42] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {actionLoading === 'resume' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  <span>Fortsetzen</span>
                </button>
              )}

              <button
                onClick={() => setShowStopPinModal(true)}
                disabled={!isPrinterConnected || Boolean(actionLoading)}
                className="px-3 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Druck abbrechen (Stopp)</span>
              </button>
            </div>
          </div>

          {/* SECTION 4: AMS 1-4 SLOTS, TELEMETRIE & SPULEN-EDITOR */}
          <div className="space-y-3 pt-1">
            <div className="flex justify-between items-center text-xs flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                  <Box className="w-4 h-4 text-[#00AE42]" />
                  <span>AMS Slots (Bambu Lab X2D):</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const printerSlots = { 1: 'sp-3', 2: 'sp-18', 3: 'sp-9', 4: 'sp-1' };
                    setAmsSlots(printerSlots);
                    safeStorage.setItem('filamenthub_ams_slots_x2d', JSON.stringify(printerSlots));
                    window.dispatchEvent(new CustomEvent('filamenthub_drying_update', { detail: { sync: true } }));
                    setActionToast({ text: 'Spulen mit den 4 AMS-Slots synchronisiert!', ok: true });
                    addSystemLog('drucker', 'Alle 4 AMS Slots mit aktuellen Drucker-Filamenten synchronisiert (Hellgrün, ELEGOO Marble, Galaxy Black, Basic Weiß)', 'AMS Sync', 'success');
                  }}
                  className="px-2 py-0.5 rounded-lg border border-[#00AE42]/40 bg-[#00AE42]/15 text-[#00AE42] hover:bg-[#00AE42]/25 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                  title="Gleicht die 4 geladenen Spulen (Hellgrün, ELEGOO Marble, Galaxy Black, Basic Weiß) sofort mit den Slots ab"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Mit Drucker abgleichen</span>
                </button>
              </div>
              <span className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                Aktiver Druck-Slot: <strong>Slot {activeSlot}</strong>
              </span>
            </div>

            {/* 4 AMS Slots mit physischer Telemetrie unter jedem Slot */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {[1, 2, 3, 4].map(slotIdx => {
                // Standard-Zuweisung falls noch nicht manuell gespeichert:
                // Slot 1: sp-3 (Bambu Lab Hellgrün)
                // Slot 2: sp-18 (ELEGOO Color Marble PLA)
                // Slot 3: sp-9 (Prusament PETG Galaxy Black)
                // Slot 4: sp-1 (Bambu Lab PETG Basic Weiß)
                const defaultSlotSpools: Record<number, string> = {
                  1: 'sp-3',
                  2: 'sp-18',
                  3: 'sp-9',
                  4: 'sp-1'
                };
                const assignedId = amsSlots[slotIdx];
                const effectiveSpoolId = assignedId !== undefined ? assignedId : (defaultSlotSpools[slotIdx] || '');
                const spool = spools.find(s => s.id === effectiveSpoolId);
                const isSlotEmpty = !effectiveSpoolId || !spool;
                const isActive = activeSlot === slotIdx;

                const hwTray = liveState.data.ams?.ams?.[0]?.tray?.[slotIdx - 1];
                const rawHwColor = hwTray?.tray_color ? hwTray.tray_color.slice(0, 6) : '';
                const hwHex = rawHwColor ? `#${rawHwColor}` : null;
                const hwType = hwTray?.tray_type || (hwTray?.state === 0 ? 'Leer' : (spool?.material || 'PLA'));
                const isHwEmpty = !spool && (hwTray?.state === 0 || !hwTray?.tray_type);

                // Ganzflächige leuchtende Hintergrundfarbe im Farbton der Spule
                const slotColorHex = isSlotEmpty
                  ? null
                  : (spool?.colorHex || hwHex || (slotIdx === 1 ? '#4ade80' : slotIdx === 2 ? '#e2e8f0' : slotIdx === 3 ? '#18181b' : '#f8fafc'));

                return (
                  <div
                    key={slotIdx}
                    onClick={() => handleSetActiveSlot(slotIdx)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative overflow-hidden ${
                      isActive ? 'ring-2 ring-[#00AE42]/80' : 'hover:scale-[1.01]'
                    } ${isSlotEmpty ? 'border-dashed opacity-85' : ''}`}
                    style={{
                      backgroundColor: slotColorHex
                        ? undefined
                        : isActive ? 'var(--app-accent-sub)' : 'var(--app-card-sub)',
                      background: slotColorHex
                        ? `linear-gradient(145deg, ${slotColorHex}38 0%, ${slotColorHex}18 50%, var(--app-card-sub) 100%)`
                        : undefined,
                      borderColor: slotColorHex
                        ? `${slotColorHex}90`
                        : isActive ? '#00AE42' : 'var(--app-border)',
                      boxShadow: slotColorHex
                        ? `0 6px 20px -3px ${slotColorHex}35`
                        : undefined
                    }}
                  >
                    {/* Header Slot */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold" style={{ color: 'var(--app-text)' }}>
                          Slot {slotIdx}
                        </span>
                        {isSlotEmpty ? (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/30">
                            Leer
                          </span>
                        ) : isActive ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#00AE42]/20 text-[#00AE42] border border-[#00AE42]/30">
                            Aktiv
                          </span>
                        ) : null}
                      </div>

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setEditingAmsSlot(slotIdx - 1);
                          if (rawHwColor) setAmsEditColor(rawHwColor);
                          if (hwType && hwType !== 'Leer') setAmsEditMaterial(hwType);
                        }}
                        title="Farbe & Material dieses Slots am Drucker einstellen"
                        className="px-2 py-0.5 rounded-lg border border-white/10 hover:border-[#00AE42] text-[10px] font-bold flex items-center gap-1 text-slate-300 hover:text-white transition cursor-pointer bg-black/20"
                      >
                        <Edit3 className="w-3 h-3 text-[#00AE42]" />
                        <span>Drucker anpassen</span>
                      </button>
                    </div>

                    {/* Lokale FilamentHub Spulenzuweisung */}
                    <div className="space-y-1">
                      <label className="text-[10px] block" style={{ color: 'var(--app-text-muted)' }}>
                        FilamentHub Zuweisung:
                      </label>
                      <select
                        value={effectiveSpoolId || ''}
                        onChange={e => {
                          e.stopPropagation();
                          handleSetAmsSlot(slotIdx, e.target.value);
                        }}
                        className="w-full px-2 py-1 rounded-lg border text-[11px] outline-none cursor-pointer"
                        style={{
                          backgroundColor: 'var(--app-input-bg)',
                          borderColor: 'var(--app-border)',
                          color: 'var(--app-text)'
                        }}
                      >
                        <option value="">(Keine Spule verknüpft)</option>
                        {spools.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.brand} {s.name} ({s.remainingWeight}g)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Trockenstand & anteilige Trocknungs-Anrechnung (z.B. 50% für halbe Zeit) */}
                    {spool && (
                      <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/25 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-orange-400 flex items-center gap-1">
                            <span>☀️ Trockenstand:</span>
                          </span>
                          <span className="font-mono-num font-bold text-slate-200">
                            Soll: {spool.dryHours || 5}h
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const halfHours = Number(((spool.dryHours || 5) / 2).toFixed(1));
                              onApplyDryingCredit?.(spool.id, halfHours, amsDryTemp);
                            }}
                            className="flex-1 py-1 px-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 font-bold text-[10px] border border-orange-500/40 transition cursor-pointer text-center active:scale-95 shadow-xs"
                            title={`${(spool.dryHours || 5) / 2}h (50% der Trocknungszeit) anrechnen`}
                          >
                            +50% ({((spool.dryHours || 5) / 2)}h)
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const fullHours = spool.dryHours || 5;
                              onApplyDryingCredit?.(spool.id, fullHours, amsDryTemp);
                            }}
                            className="flex-1 py-1 px-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-[10px] border border-emerald-500/40 transition cursor-pointer text-center active:scale-95 shadow-xs"
                            title={`${spool.dryHours || 5}h (100% Voll getrocknet) anrechnen`}
                          >
                            +100% ({spool.dryHours || 5}h)
                          </button>
                        </div>
                      </div>
                    )}

                    {/* TELEMETRIE DES ECHTEN DRUCKERS UNTER JEDEM SLOT */}
                    <div className="p-2 rounded-xl border border-white/10 bg-black/20 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-slate-400">Drucker-Telemetrie:</span>
                        <span className="font-mono text-[9.5px] text-slate-500">
                          {hwTray?.nozzle_temp_min ? `${hwTray.nozzle_temp_min}-${hwTray.nozzle_temp_max}°` : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {slotColorHex ? (
                          <span
                            className="w-4 h-4 rounded-full border border-black/50 shadow-sm shrink-0"
                            style={{ backgroundColor: slotColorHex }}
                          />
                        ) : (
                          <span className="w-4 h-4 rounded-full border border-dashed border-slate-600 shrink-0" />
                        )}

                        <div className="min-w-0">
                          <span className="font-extrabold text-[11px] block truncate" style={{ color: 'var(--app-text)' }}>
                            {isSlotEmpty ? 'Slot frei (Keine Spule)' : (spool ? `${spool.brand} ${spool.name}` : (isHwEmpty ? 'Keine Spule erkannt' : hwType))}
                          </span>
                          <span className="font-mono text-[9.5px] block text-slate-400">
                            {slotColorHex ? `${slotColorHex.toUpperCase()}` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* AMS TROCKNUNG (FILAMENT DRYING) STEUERUNG */}
            <div
              className="p-3.5 rounded-2xl border space-y-3 transition-colors text-xs"
              style={{
                backgroundColor: 'var(--app-card-sub)',
                borderColor: 'var(--app-border)'
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-sky-400" />
                  <span className="font-bold" style={{ color: 'var(--app-text)' }}>
                    AMS Filament-Trocknung (Bambu Lab X2D):
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isDryingActive
                        ? 'bg-sky-500/20 text-sky-300 border-sky-400/50 animate-pulse'
                        : 'bg-white/5 text-slate-400 border-white/10'
                    }`}
                  >
                    {isDryingActive ? '🔥 Trocknung aktiv' : 'Inaktiv (Standby)'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                  {liveState.data.ams?.ams?.[0]?.temp && (
                    <span>AMS-Temp: {liveState.data.ams.ams[0].temp}°C</span>
                  )}
                  <span>• Feuchte: {getHumidityDisplay()}</span>
                  {isDryingActive && calcRemainingTime() && (
                    <span className="text-sky-300 font-bold">• ⏳ Restzeit: {calcRemainingTime()}</span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                    Dauer:
                  </span>
                  {[2, 4, 8, 12].map(hrs => (
                    <button
                      key={hrs}
                      onClick={() => setAmsDryHours(hrs)}
                      className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                        amsDryHours === hrs ? 'bg-sky-500/25 border-sky-400 text-sky-300' : 'border-white/10 text-slate-400'
                      }`}
                    >
                      {hrs} Std.
                    </button>
                  ))}

                  <span className="text-[11px] ml-2" style={{ color: 'var(--app-text-muted)' }}>
                    Temperatur:
                  </span>
                  {[
                    { label: '50° PLA', val: 50 },
                    { label: '65° PETG/ABS', val: 65 }
                  ].map(t => (
                    <button
                      key={t.val}
                      onClick={() => setAmsDryTemp(t.val)}
                      className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                        amsDryTemp === t.val ? 'bg-amber-500/25 border-amber-400 text-amber-300' : 'border-white/10 text-slate-400'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleAmsDrying(true)}
                    disabled={dryLoading}
                    className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md disabled:opacity-50 ${
                      isDryingActive
                        ? 'bg-sky-500 hover:bg-sky-400 text-white shadow-sky-500/30 ring-2 ring-sky-300 animate-pulse'
                        : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white'
                    }`}
                  >
                    {dryLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sun className="w-3.5 h-3.5" />}
                    <span>{isDryingActive ? `🔥 Trocknung läuft (${calcRemainingTime() || `${amsDryHours}h`})` : 'Trocknen starten'}</span>
                  </button>

                  <button
                    onClick={() => handleToggleAmsDrying(false)}
                    disabled={dryLoading}
                    className="px-3 py-1.5 rounded-xl border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Stoppen</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: TEMPERATUR ANPASSEN BEI KLICK AUF HOTEND ODER BETT */}
      {tempModalTarget && (
        <div
          onClick={() => setTempModalTarget(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border p-5 shadow-2xl space-y-4"
            style={{
              backgroundColor: 'var(--app-card)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--app-border)' }}>
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400" />
                <h4 className="font-extrabold text-sm">
                  {tempModalTarget === 'nozzle1'
                    ? 'Düse 1 (Links) Temperatur einstellen'
                    : tempModalTarget === 'nozzle2'
                    ? 'Düse 2 (Rechts) Temperatur einstellen'
                    : 'Druckbett Temperatur einstellen'}
                </h4>
              </div>
              <button onClick={() => setTempModalTarget(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
              Wähle eine Schnellwahltemperatur oder gib einen benutzerdefinierten Wert ein.
            </p>

            {/* Schnellwahltasten */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold block" style={{ color: 'var(--app-text)' }}>
                Schnellwahl:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {tempModalTarget === 'bed'
                  ? [
                      { label: 'Aus (0°C)', val: 0 },
                      { label: '50° PLA', val: 50 },
                      { label: '55° PLA+', val: 55 },
                      { label: '65° PETG', val: 65 },
                      { label: '75° PETG', val: 75 },
                      { label: '90° ABS', val: 90 }
                    ].map(b => (
                      <button
                        key={b.val}
                        onClick={() => setTempModalValue(String(b.val))}
                        className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition cursor-pointer text-center ${
                          tempModalValue === String(b.val)
                            ? 'bg-rose-500/25 border-rose-500 text-rose-300 font-extrabold'
                            : 'border-white/10 text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))
                  : [
                      { label: 'Aus (0°C)', val: 0 },
                      { label: '190° PLA', val: 190 },
                      { label: '210° PLA', val: 210 },
                      { label: '220° PLA', val: 220 },
                      { label: '240° PETG', val: 240 },
                      { label: '255° ABS', val: 255 }
                    ].map(b => (
                      <button
                        key={b.val}
                        onClick={() => setTempModalValue(String(b.val))}
                        className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition cursor-pointer text-center ${
                          tempModalValue === String(b.val)
                            ? 'bg-orange-500/25 border-orange-500 text-orange-300 font-extrabold'
                            : 'border-white/10 text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
              </div>
            </div>

            {/* Manuelle Eingabe */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold block" style={{ color: 'var(--app-text)' }}>
                Genauer Wert (°C):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max={tempModalTarget === 'bed' ? 120 : 300}
                  value={tempModalValue}
                  onChange={e => setTempModalValue(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border font-mono-num text-sm font-bold outline-none text-center"
                  style={{
                    backgroundColor: 'var(--app-input-bg)',
                    borderColor: 'var(--app-border)',
                    color: 'var(--app-text)'
                  }}
                />
                <span className="text-sm font-bold text-slate-400">°C</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--app-border)' }}>
              <button
                onClick={() => setTempModalTarget(null)}
                className="flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleSetTemperature(tempModalTarget, Number(tempModalValue))}
                disabled={Boolean(actionLoading)}
                className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Flame className="w-3.5 h-3.5" />}
                <span>Temperatur setzen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: G-CODE DATEI AN DRUCKER SENDEN */}
      {showGcodeModal && (
        <div
          onClick={() => setShowGcodeModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border p-5 shadow-2xl space-y-4"
            style={{
              backgroundColor: 'var(--app-card)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--app-border)' }}>
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-sky-400" />
                <h4 className="font-extrabold text-sm">G-Code / .3MF Datei an X2D übertragen</h4>
              </div>
              <button onClick={() => setShowGcodeModal(false)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
              Lade deine geslicete G-Code oder Bambu Studio .3MF Datei direkt auf den Bambu Lab X2D hoch.
            </p>

            <input
              type="file"
              ref={fileInputRef}
              accept=".gcode,.3mf,.gcode.3mf"
              onChange={handleGcodeFileSelect}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-5 rounded-2xl border-2 border-dashed border-sky-500/40 hover:border-sky-400 bg-sky-500/5 hover:bg-sky-500/10 transition cursor-pointer flex flex-col items-center justify-center gap-2 text-center"
            >
              <UploadCloud className="w-8 h-8 text-sky-400" />
              <span className="font-extrabold text-xs text-white">
                {selectedGcodeFile ? selectedGcodeFile.name : 'G-Code oder .3MF Datei auswählen'}
              </span>
              <span className="text-[11px] text-slate-400">
                Klicke hier zum Durchsuchen (.gcode, .3mf)
              </span>
            </div>

            {selectedGcodeFile && gcodeFileInfo && (
              <div className="p-3 rounded-xl border border-white/10 bg-black/20 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Dateiname:</span>
                  <span className="font-mono font-bold text-white truncate max-w-[200px]">{gcodeFileInfo.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Dateigröße:</span>
                  <span className="font-mono text-slate-300">{gcodeFileInfo.sizeKb} KB</span>
                </div>
                {gcodeFileInfo.layerCount && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Schichten (Layers):</span>
                    <span className="font-mono text-sky-400 font-bold">{gcodeFileInfo.layerCount}</span>
                  </div>
                )}
                {gcodeFileInfo.estTimeMin && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Geschätzte Druckzeit:</span>
                    <span className="font-mono text-[#00AE42] font-bold">{gcodeFileInfo.estTimeMin} Min.</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--app-border)' }}>
              <button
                onClick={() => {
                  setSelectedGcodeFile(null);
                  setGcodeFileInfo(null);
                  setShowGcodeModal(false);
                }}
                className="flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              >
                Abbrechen
              </button>

              <button
                onClick={() => handleUploadGcode(true)}
                disabled={!selectedGcodeFile || isUploadingGcode}
                className="flex-1 py-2 px-3 rounded-xl bg-[#00AE42] hover:bg-[#009237] text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-[#00AE42]/20 disabled:opacity-50"
              >
                {isUploadingGcode ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-white" />}
                <span>Direkt drucken</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: AMS SPULEN-EDITOR AM ECHTEN DRUCKER */}
      {editingAmsSlot !== null && (
        <div
          onClick={() => setEditingAmsSlot(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border p-5 shadow-2xl space-y-4"
            style={{
              backgroundColor: 'var(--app-card)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--app-border)' }}>
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#00AE42]" />
                <h4 className="font-extrabold text-sm">
                  AMS Slot {editingAmsSlot + 1} am Drucker ändern
                </h4>
              </div>
              <button onClick={() => setEditingAmsSlot(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
              Stelle Farbe und Material für <strong>Slot {editingAmsSlot + 1}</strong> ein. Der Befehl wird sofort per MQTTS an deinen echten Bambu Lab X2D übertragen.
            </p>

            {/* Farbauswahl Palette */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold block" style={{ color: 'var(--app-text)' }}>
                Farbe auswählen:
              </label>
              <div className="grid grid-cols-5 gap-2">
                {BAMBU_PRESET_COLORS.map(c => (
                  <button
                    key={c.hex}
                    onClick={() => setAmsEditColor(c.hex)}
                    className={`p-1 rounded-xl border flex flex-col items-center gap-1 transition cursor-pointer ${
                      amsEditColor.toUpperCase() === c.hex.toUpperCase()
                        ? 'ring-2 ring-[#00AE42] border-[#00AE42]'
                        : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    <span
                      className="w-6 h-6 rounded-full border border-black/40 shadow-xs"
                      style={{ backgroundColor: `#${c.hex}` }}
                    />
                    <span className="text-[9px] font-semibold truncate w-full text-center text-slate-300">
                      {c.name}
                    </span>
                  </button>
                ))}
              </div>

              {/* Benutzerdefinierter Hex-Code */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] text-slate-400">HEX Code:</span>
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-xs font-mono text-slate-400">#</span>
                  <input
                    type="text"
                    maxLength={6}
                    value={amsEditColor}
                    onChange={e => setAmsEditColor(e.target.value.replace('#', ''))}
                    className="w-24 px-2 py-1 rounded-lg border font-mono text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--app-input-bg)',
                      borderColor: 'var(--app-border)',
                      color: 'var(--app-text)'
                    }}
                  />
                  <span
                    className="w-5 h-5 rounded-full border border-black/40 ml-2"
                    style={{ backgroundColor: `#${amsEditColor}` }}
                  />
                </div>
              </div>
            </div>

            {/* Materialauswahl */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold block" style={{ color: 'var(--app-text)' }}>
                Material auswählen:
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'PC', 'PA', 'PA-CF'].map(mat => (
                  <button
                    key={mat}
                    onClick={() => {
                      setAmsEditMaterial(mat);
                      if (mat === 'PLA') {
                        setAmsEditMinTemp(190);
                        setAmsEditMaxTemp(240);
                      } else if (mat === 'PETG') {
                        setAmsEditMinTemp(220);
                        setAmsEditMaxTemp(260);
                      } else {
                        setAmsEditMinTemp(240);
                        setAmsEditMaxTemp(280);
                      }
                    }}
                    className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition cursor-pointer text-center ${
                      amsEditMaterial === mat
                        ? 'bg-[#00AE42]/20 border-[#00AE42] text-[#00AE42]'
                        : 'border-white/10 text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    {mat}
                  </button>
                ))}
              </div>
            </div>

            {/* Temperaturbereich */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 block">Min. Düsentemperatur:</label>
                <input
                  type="number"
                  value={amsEditMinTemp}
                  onChange={e => setAmsEditMinTemp(Number(e.target.value))}
                  className="w-full px-2 py-1 rounded-lg border font-mono-num text-xs outline-none"
                  style={{
                    backgroundColor: 'var(--app-input-bg)',
                    borderColor: 'var(--app-border)',
                    color: 'var(--app-text)'
                  }}
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block">Max. Düsentemperatur:</label>
                <input
                  type="number"
                  value={amsEditMaxTemp}
                  onChange={e => setAmsEditMaxTemp(Number(e.target.value))}
                  className="w-full px-2 py-1 rounded-lg border font-mono-num text-xs outline-none"
                  style={{
                    backgroundColor: 'var(--app-input-bg)',
                    borderColor: 'var(--app-border)',
                    color: 'var(--app-text)'
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--app-border)' }}>
              <button
                onClick={() => setEditingAmsSlot(null)}
                className="flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={handleSaveAmsSlotToPrinter}
                disabled={Boolean(actionLoading)}
                className="flex-1 py-2 px-3 rounded-xl bg-[#00AE42] hover:bg-[#009237] text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-[#00AE42]/20"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Auf X2D übertragen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: ADMIN-PIN SICHERHEITSABFRAGE FÜR STOPP */}
      {showStopPinModal && (
        <div
          onClick={() => setShowStopPinModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border p-5 shadow-2xl space-y-4"
            style={{
              backgroundColor: 'var(--app-card)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--app-border)' }}>
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h4 className="font-extrabold text-sm">Druck wirklich abbrechen?</h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowStopPinModal(false);
                  setAdminPinInput('');
                }}
                className="cursor-pointer p-1 rounded-lg hover:opacity-75 transition"
                style={{ color: 'var(--app-text-muted)' }}
                title="Schließen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
              Der laufende Druckauftrag auf deinem Bambu Lab X2D wird sofort gestoppt. Bitte gib zur Bestätigung die Admin-PIN ein:
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-bold block" style={{ color: 'var(--app-text)' }}>
                Admin-PIN (Standard: 1234):
              </label>
              <input
                type="password"
                maxLength={8}
                placeholder="1234"
                autoFocus
                value={adminPinInput}
                onChange={e => setAdminPinInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSendCommand('stop', adminPinInput);
                }}
                className="w-full px-3 py-2 rounded-xl border text-sm font-mono-num font-bold tracking-widest text-center outline-none"
                style={{
                  backgroundColor: 'var(--app-input-bg)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  setShowStopPinModal(false);
                  setAdminPinInput('');
                }}
                className="flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleSendCommand('stop', adminPinInput)}
                disabled={Boolean(actionLoading)}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20"
              >
                {actionLoading === 'stop' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                <span>Druck stoppen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: DYNAMISCHER DASHBOARD QR-CODE FÜRS SMARTPHONE */}
      {showQrModal && (
        <div
          onClick={() => setShowQrModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border p-5 shadow-2xl text-center space-y-4"
            style={{
              backgroundColor: 'var(--app-card)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--app-border)' }}>
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-[#00AE42]" />
                <span className="font-extrabold text-sm" style={{ color: 'var(--app-text)' }}>
                  Smartphone Live-Dashboard
                </span>
              </div>
              <button onClick={() => setShowQrModal(false)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {qrCodeDataUrl ? (
              <div className="p-3 bg-white rounded-2xl shadow-lg border border-slate-200 inline-block">
                <img src={qrCodeDataUrl} alt="Dashboard QR-Code" className="w-44 h-44 object-contain mx-auto" />
              </div>
            ) : null}

            <div className="space-y-1">
              <span className="text-xs font-bold block" style={{ color: 'var(--app-text)' }}>
                Druckerstatus live am Smartphone verfolgen
              </span>
              <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                Scanne den QR-Code mit deiner Handy-Kamera, um das Dashboard mit Live-Fortschritt & Temperaturen direkt zu öffnen.
              </p>
            </div>

            <div
              className="p-2 rounded-xl border text-[10px] font-mono-num font-bold text-[#00AE42]"
              style={{
                backgroundColor: 'var(--app-card-sub)',
                borderColor: 'var(--app-border)'
              }}
            >
              Status: {liveState.formatted.statusText} ({liveState.data.mc_percent}%) • Rest: {liveState.formatted.remainingTimeStr}
            </div>
          </div>
        </div>
      )}

      {/* Home Assistant Integration is configured cleanly in Sidebar menu without intrusive popup */}

      {/* MODAL 6: VERBINDUNGS-EINSTELLUNGEN (ZAHNRAD) */}
      <BambuSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onConnected={() => {
          fetch('/api/printer/status')
            .then(r => r.json())
            .then(data => {
              if (data && data.data) setLiveState(data);
            })
            .catch(() => {});
        }}
      />

      {/* ZERO LAYOUT SHIFT: Floating Fixed Toast am Bildschirmrand */}
      {actionToast && (
        <div
          className="fixed bottom-5 right-5 z-[100] max-w-sm p-3 rounded-2xl shadow-2xl border backdrop-blur-md flex items-center justify-between gap-3 text-xs font-bold animate-fadeIn pointer-events-auto"
          style={{
            backgroundColor: actionToast.ok ? 'rgba(5, 119, 72, 0.95)' : 'rgba(220, 38, 38, 0.95)',
            color: '#ffffff',
            borderColor: actionToast.ok ? '#22c55e' : '#f87171'
          }}
        >
          <span>{actionToast.text}</span>
          <button
            onClick={() => setActionToast(null)}
            className="p-1 hover:opacity-75 cursor-pointer ml-1"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
