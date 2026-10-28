import React, { useState, useEffect, useRef, useMemo } from 'react';
import { homeAssistantApi, printerApi } from '../api';
import QRCode from 'qrcode';
import { FunFactsModal } from './FunFactsModal';
import { SelfHostModal } from './SelfHostModal';
import { safeStorage } from '../utils/safeStorage';
import {
  X,
  Disc,
  Bot,
  FileCode2,
  Calculator,
  Wrench,
  Sparkles,
  Server,
  UploadCloud,
  Layers,
  PlusCircle,
  QrCode,
  RefreshCw,
  Download,
  Upload,
  Database,
  Camera,
  Smartphone,
  Settings,
  RotateCcw,
  Check,
  Copy,
  ExternalLink,
  Flame,
  Scale,
  Sliders,
  HelpCircle,
  Package,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  Home,
  Thermometer,
  Lightbulb,
  Plug,
  Droplets,
  Search,
  Lock,
  Key,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import {
  AppSettings,
  BrandConfig,
  GCodeAnalysis,
  MaterialDryingConfig,
  MaterialType,
  SidebarTab,
  Spool,
  VersionProfile,
  ViewMode
} from '../types/filament';
import { ThemeBrightness, ThemeAccent } from '../types/theme';
import { ThemeSelector } from './ThemeSelector';
import { parseGCodeContent } from '../utils/gcodeParser';
import { BRAND_DATABASE, MATERIAL_PRESETS } from '../data/defaultSpools';
import { addSystemLog } from '../utils/logService';
import {
  DEFAULT_NABU_URL,
  getHaCredentials,
  saveHaCredentials,
  testHaConnection,
  triggerHaAutomation,
  toggleHaLight
} from '../utils/haClient';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
  spools: Spool[];
  onDeductWeight: (spoolId: string, grams: number) => void;
  onMarkDried: (spoolId: string) => void;
  onOpenNewSpool: (prefill?: Partial<Spool>) => void;
  onOpenQr: () => void;
  onSyncCloud: () => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onRestoreDefaultSpools: () => void;
  versionProfiles: VersionProfile[];
  activeVersionId: string;
  onSelectVersion: (versionId: string) => void;
  onCreateVersionProfile: (versionName: string) => void;
  onOpenCamera: () => void;
  onOpenPWAInstall: () => void;
  themeBrightness: ThemeBrightness;
  themeAccent: ThemeAccent;
  onSetBrightness: (b: ThemeBrightness) => void;
  onSetAccent: (a: ThemeAccent) => void;
  // Einstellungs-Hub Props
  appSettings: AppSettings;
  onUpdateMaterialPreset: (material: string, config: MaterialDryingConfig) => void;
  onResetMaterialPreset: (material: string) => void;
  onUpdateBrandPreset: (brand: string, config: BrandConfig) => void;
  onResetBrandPreset: (brand: string) => void;
  onUpdateEibosBagTara: (tara: number) => void;
  onUpdateCardSize?: (size: number) => void;
  onResetAllSettings: () => void;
  cloudDbUrl: string;
  syncStatus: { label: string; ok: boolean };
}

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
}

const MATERIAL_OPTIONS: MaterialType[] = [
  'PLA',
  'PLA+',
  'PETG',
  'TPU',
  'ABS',
  'ASA',
  'PA / Nylon',
  'PC',
  'PET-CF / PA-CF'
];

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  viewMode,
  onSetViewMode,
  spools,
  onDeductWeight,
  onMarkDried,
  onOpenNewSpool,
  onOpenQr,
  onSyncCloud,
  onExportBackup,
  onImportBackup,
  onRestoreDefaultSpools,
  versionProfiles,
  activeVersionId,
  onSelectVersion,
  onCreateVersionProfile,
  onOpenCamera,
  onOpenPWAInstall,
  themeBrightness,
  themeAccent,
  onSetBrightness,
  onSetAccent,
  appSettings,
  onUpdateMaterialPreset,
  onResetMaterialPreset,
  onUpdateBrandPreset,
  onResetBrandPreset,
  onUpdateEibosBagTara,
  onUpdateCardSize,
  onResetAllSettings,
  cloudDbUrl,
  syncStatus
}) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('settings');

  // KI-Agent State
  const [aiInput, setAiInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      text: `Hallo! Ich kenne alle deine ${spools.length} Spulen und Standardwerte. Sag mir einfach, was ich abziehen, eintragen, trocknen oder berechnen soll!`,
      isUser: false,
      timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // G-Code State
  const [gcodeData, setGcodeData] = useState<GCodeAnalysis | null>(null);

  // Kostenrechner State
  const [calcSpoolId, setCalcSpoolId] = useState<string>(spools[0]?.id || '');
  const [calcGrams, setCalcGrams] = useState<number>(85);
  const [calcPricePerKg, setCalcPricePerKg] = useState<number>(
    spools[0]?.pricePerKg || 19.99
  );
  const [calcPrintHours, setCalcPrintHours] = useState<number>(3.5);
  const [calcPrinterWatts, setCalcPrinterWatts] = useState<number>(150);
  const [calcKwhPrice, setCalcKwhPrice] = useState<number>(0.35);
  const [calcWearEuro, setCalcWearEuro] = useState<number>(0.30);

  // Versions-Erstellung State
  const [showNewVersionInput, setShowNewVersionInput] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Auto-Close: Wenn ein Profil gewählt wird, oder wenn außerhalb geklickt oder die Seite gescrollt wird
  useEffect(() => {
    if (!isProfileDropdownOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    const handleScroll = (e: Event) => {
      // Wenn innerhalb der Profil-Ausklappliste gescrollt wird, Menü NICHT schließen!
      if (profileDropdownRef.current && profileDropdownRef.current.contains(e.target as Node)) {
        return;
      }
      setIsProfileDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isProfileDropdownOpen]);

  // Fun Facts & Self-Hosting Modal State
  const [showFunFacts, setShowFunFacts] = useState<boolean>(false);
  const [showSelfHost, setShowSelfHost] = useState<boolean>(false);

  // Einstellungen Sub-State
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialType>('PLA');
  const [matInterval, setMatInterval] = useState<number>(30);
  const [matTemp, setMatTemp] = useState<number>(50);
  const [matHours, setMatHours] = useState<number>(5);
  const [matSavedSuccess, setMatSavedSuccess] = useState<boolean>(false);

  const [selectedBrand, setSelectedBrand] = useState<string>('Bambu Lab');
  const [brandTara, setBrandTara] = useState<number>(250);
  const [brandDefaultPrice, setBrandDefaultPrice] = useState<number>(19.99);
  const [brandSavedSuccess, setBrandSavedSuccess] = useState<boolean>(false);

  const [eibosTaraInput, setEibosTaraInput] = useState<number>(appSettings.eibosBagTara || 35);
  const [eibosSavedSuccess, setEibosSavedSuccess] = useState<boolean>(false);

  // QR-Code Kopplung im Einstellungsreiter
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [settingsSubTab, setSettingsSubTab] = useState<'themes' | 'presets' | 'homeassistant'>('themes');

  // Home Assistant Bambu Lab X2D Telemetrie & Sensor-Pfade (60 Entitäten)
  const [haTelemetry, setHaTelemetry] = useState<any>(null);
  const [haLoading, setHaLoading] = useState<boolean>(false);
  const [haLightActive, setHaLightActive] = useState<boolean>(false);
  const [haActionToast, setHaActionToast] = useState<string | null>(null);

  // Mapped Sensor Paths
  const [ventilationDryerPath, setVentilationDryerPath] = useState<string>(() => {
    return safeStorage.getItem('ha_path_ventilation_dryer') || 'Sensor.X2D.Allowed.Settings.Ventilation.And.Dryer';
  });
  const [sensorSearchQuery, setSensorSearchQuery] = useState<string>('');
  const [sensorCategoryFilter, setSensorCategoryFilter] = useState<'all' | 'ventilation_dryer' | 'sensor' | 'diagnostic' | 'switch'>('all');
  const [copiedEntityId, setCopiedEntityId] = useState<string | null>(null);

  // Nabu Casa & Home Assistant Vault State (Dauerhaft gespeichert)
  const [isNabuVaultOpen, setIsNabuVaultOpen] = useState<boolean>(() => {
    return safeStorage.getItem('ha_vault_open') !== 'false';
  });
  const [nabuUrlInput, setNabuUrlInput] = useState<string>(() => {
    const creds = getHaCredentials();
    return creds.url || DEFAULT_NABU_URL;
  });
  const [nabuTokenInput, setNabuTokenInput] = useState<string>(() => {
    const creds = getHaCredentials();
    return creds.token || '';
  });
  const [showNabuToken, setShowNabuToken] = useState<boolean>(false);
  const [nabuSavedSuccess, setNabuSavedSuccess] = useState<boolean>(false);
  const [nabuTesting, setNabuTesting] = useState<boolean>(false);
  const [nabuTestResult, setNabuTestResult] = useState<{ success: boolean; message: string; isUnauthorized?: boolean } | null>(null);
  const [haTriggering, setHaTriggering] = useState<boolean>(false);
  const [haTriggerResult, setHaTriggerResult] = useState<{ success: boolean; message: string } | null>(null);

  // Neueste Versionen immer an oberster Stelle anzeigen (umgekehrte Reihenfolge)
  const sortedVersionProfiles = useMemo(() => {
    return [...versionProfiles].slice().reverse();
  }, [versionProfiles]);

  // Auto-Dismiss für alle Benachrichtigungen nach exakt 10 Sekunden (gemäß Benutzeranforderung)
  useEffect(() => {
    if (!haActionToast) return;
    const t = setTimeout(() => setHaActionToast(null), 10000);
    return () => clearTimeout(t);
  }, [haActionToast]);

  useEffect(() => {
    if (!nabuTestResult) return;
    const t = setTimeout(() => setNabuTestResult(null), 10000);
    return () => clearTimeout(t);
  }, [nabuTestResult]);

  useEffect(() => {
    if (!haTriggerResult) return;
    const t = setTimeout(() => setHaTriggerResult(null), 10000);
    return () => clearTimeout(t);
  }, [haTriggerResult]);

  // Initiales Laden aus dem Tresor
  useEffect(() => {
    const creds = getHaCredentials();
    if (creds.url && !creds.url.includes('xxxxxxxxxxxx')) {
      setNabuUrlInput(creds.url);
    }
    if (creds.token) {
      setNabuTokenInput(creds.token);
    }

    homeAssistantApi
      .getConfig()
      .then(res => {
        const data = res.ok && res.isJson ? res.data : null;
        if (data?.haUrl && !data.haUrl.includes('xxxxxxxxxxxx')) {
          setNabuUrlInput(data.haUrl);
          saveHaCredentials({ url: data.haUrl });
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveNabuVault = async () => {
    try {
      const cleanUrl = nabuUrlInput.trim();
      const cleanToken = nabuTokenInput.trim();
      saveHaCredentials({ url: cleanUrl, token: cleanToken });

      setNabuSavedSuccess(true);
      setTimeout(() => setNabuSavedSuccess(false), 10000);
      setHaActionToast('Nabu Casa URL & Token dauerhaft gesichert & im Tresor synchronisiert!');
      addSystemLog('system', 'Home Assistant Nabu Casa URL & Token dauerhaft gespeichert', 'Nabu Casa Vault', 'success');
      fetchHaTelemetry();
    } catch {
      setHaActionToast('Fehler beim Speichern im Tresor');
    }
  };

  // Home Assistant Automation (automation.filament_website_auto_pull_github) auslösen (nativ & ohne JSON-Parse Absturz)
  const handleTriggerHaPullAutomation = async (entityId = 'automation.filament_website_auto_pull_github') => {
    setHaTriggering(true);
    setHaTriggerResult(null);
    try {
      // Vorab sichern
      saveHaCredentials({
        url: nabuUrlInput.trim(),
        token: nabuTokenInput.trim()
      });

      const res = await triggerHaAutomation(entityId);
      if (res.success) {
        setHaTriggerResult({
          success: true,
          message: `Erfolg! Automation „${entityId}“ in Home Assistant ausgelöst. Dein HA zieht jetzt das neueste Git-Release!`
        });
        setHaActionToast(`Automation ${entityId} erfolgreich in HA getriggert!`);
        addSystemLog('system', `HA Automation ${entityId} erfolgreich ausgelöst: ${res.message}`, 'HA Automation', 'success');
      } else {
        setHaTriggerResult({
          success: false,
          message: res.message || 'Konnte Automation in HA nicht auslösen. Bitte Token & URL prüfen.'
        });
        addSystemLog('system', `Konnte HA Automation ${entityId} nicht auslösen: ${res.message}`, 'HA Automation', 'error');
      }
    } catch (err: any) {
      setHaTriggerResult({
        success: false,
        message: 'Verbindungsfehler beim Auslösen der HA Automation: ' + (err?.message || err)
      });
      addSystemLog('system', `Verbindungsfehler beim Auslösen von ${entityId}: ${err?.message || err}`, 'HA Automation', 'error');
    } finally {
      setHaTriggering(false);
    }
  };

  const handleTestNabuConnection = async () => {
    setNabuTesting(true);
    setNabuTestResult(null);
    try {
      saveHaCredentials({
        url: nabuUrlInput.trim(),
        token: nabuTokenInput.trim()
      });

      const res = await testHaConnection(nabuUrlInput.trim(), nabuTokenInput.trim());
      const isAuthErr = Boolean((res as any).isUnauthorized || res.message?.includes('401'));
      setNabuTestResult({
        success: res.success,
        message: res.message,
        isUnauthorized: isAuthErr
      });
      addSystemLog('system', res.message, 'HA Test', res.success ? 'success' : 'warn');
    } catch (err: any) {
      const msg = err?.message || String(err);
      setNabuTestResult({
        success: false,
        message: 'Konnte Verbindung zu Home Assistant nicht aufbauen: ' + msg,
        isUnauthorized: msg.includes('401')
      });
      addSystemLog('system', `HA Verbindungstest fehlgeschlagen: ${msg}`, 'HA Test', 'error');
    } finally {
      setNabuTesting(false);
    }
  };

  // G-Code vom X2D Drucker automatisch übernehmen
  const [printerFetchLoading, setPrinterFetchLoading] = useState<boolean>(false);
  const handlePullGcodeFromPrinter = async () => {
    setPrinterFetchLoading(true);
    try {
      const res = await printerApi.bambuStatus();
      const data = res.data;
      if (data && data.success) {
        const fileName = data.printName || data.subtask_name || 'FilamentHub_X2D.gcode';
        const weightGrams = data.printGrams || 42;
        const timeHours = data.totalSeconds ? Number((data.totalSeconds / 3600).toFixed(1)) : 2.5;
        setGcodeData({
          fileName,
          weightGrams,
          timeHours,
          material: 'PLA'
        });
        setCalcGrams(weightGrams);
        setCalcPrintHours(timeHours);
        setHaActionToast(`G-Code "${fileName}" (${weightGrams}g) vom X2D geladen!`);
        addSystemLog('drucker', `G-Code "${fileName}" (${weightGrams}g, ${timeHours}h) vom X2D in Rechner übernommen`, 'Auto-Sync', 'info');
      }
    } catch {
      setHaActionToast('Konnte Druckdatei nicht vom X2D abrufen.');
    } finally {
      setPrinterFetchLoading(false);
    }
  };

  const fetchHaTelemetry = async () => {
    setHaLoading(true);
    try {
      const res = await homeAssistantApi.telemetry();
      const data = res.data;
      if (data && data.success) {
        setHaTelemetry(data);
        const devData = data.bambuX2d || data.bambuX1c;
        if (devData?.isLightOn !== null && devData?.isLightOn !== undefined) {
          setHaLightActive(Boolean(devData.isLightOn));
        }
      }
    } catch {}
    finally {
      setHaLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'settings' && settingsSubTab === 'homeassistant') {
      fetchHaTelemetry();
      const interval = setInterval(fetchHaTelemetry, 4000);
      return () => clearInterval(interval);
    }
  }, [activeTab, settingsSubTab]);

  const handleSetHaNozzle = async (tempVal: number) => {
    try {
      const res = await homeAssistantApi.setTemperature('nozzle', tempVal);
      const data = res.data;
      if (res.ok && data.success) {
        setHaActionToast(`Düse auf ${tempVal}°C gesetzt!`);
        addSystemLog('temp', `Home Assistant: Düsentemperatur auf ${tempVal}°C gesetzt`, 'X1C / X2D', 'info');
        fetchHaTelemetry();
      } else {
        setHaActionToast(data.error || 'Fehler beim Setzen der Temperatur.');
      }
    } catch {
      setHaActionToast('Verbindungsfehler zu Home Assistant.');
    }
  };

  const handleSetHaBed = async (tempVal: number) => {
    try {
      const res = await homeAssistantApi.setTemperature('bed', tempVal);
      const data = res.data;
      if (res.ok && data.success) {
        setHaActionToast(`Druckbett auf ${tempVal}°C gesetzt!`);
        addSystemLog('temp', `Home Assistant: Druckbett auf ${tempVal}°C gesetzt`, 'X1C / X2D', 'info');
        fetchHaTelemetry();
      } else {
        setHaActionToast(data.error || 'Fehler beim Setzen der Temperatur.');
      }
    } catch {
      setHaActionToast('Verbindungsfehler zu Home Assistant.');
    }
  };

  const handleToggleHaLight = async () => {
    const nextMode = haLightActive ? 'off' : 'on';
    try {
      const res = await toggleHaLight(nextMode);
      if (res.success) {
        setHaLightActive(!haLightActive);
        setHaActionToast(`Bauraum-Licht ${nextMode === 'on' ? 'eingeschaltet' : 'ausgeschaltet'}!`);
        addSystemLog('licht', `Home Assistant: Bauraum-Licht ${nextMode === 'on' ? 'eingeschaltet' : 'ausgeschaltet'}`, 'X1C / X2D', 'info');
        fetchHaTelemetry();
      } else {
        setHaActionToast(res.message || 'Fehler beim Schalten des Lichts.');
      }
    } catch {
      setHaActionToast('Verbindungsfehler zu Home Assistant.');
    }
  };

  // Synchronisiere Eingabefelder mit appSettings bei Wechsel des gewählten Materials
  useEffect(() => {
    const conf = appSettings.materialPresets[selectedMaterial] || MATERIAL_PRESETS[selectedMaterial] || MATERIAL_PRESETS['PLA'];
    setMatInterval(conf.intervalDays);
    setMatTemp(conf.temp);
    setMatHours(conf.hours);
  }, [selectedMaterial, appSettings.materialPresets]);

  // Synchronisiere Eingabefelder mit appSettings bei Wechsel der gewählten Marke
  useEffect(() => {
    const conf = appSettings.brandPresets[selectedBrand] || {
      tara: BRAND_DATABASE.find(b => b.name === selectedBrand)?.tara ?? 200,
      defaultPrice: BRAND_DATABASE.find(b => b.name === selectedBrand)?.defaultPrice ?? 19.99
    };
    setBrandTara(conf.tara);
    setBrandDefaultPrice(conf.defaultPrice);
  }, [selectedBrand, appSettings.brandPresets]);

  useEffect(() => {
    setEibosTaraInput(appSettings.eibosBagTara || 35);
  }, [appSettings.eibosBagTara]);

  // QR-Code generieren für Koppel-Link
  const pairUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?pairCloud=${encodeURIComponent(cloudDbUrl)}`
    : '';

  useEffect(() => {
    if (!pairUrl) return;
    QRCode.toDataURL(pairUrl, {
      width: 200,
      margin: 1.5,
      color: { dark: '#0b111e', light: '#ffffff' }
    })
      .then(url => setQrCodeDataUrl(url))
      .catch(() => {});
  }, [pairUrl]);

  if (!isOpen) return null;

  const activeVersion =
    versionProfiles.find(v => v.id === activeVersionId) || versionProfiles[versionProfiles.length - 1];

  // G-Code Upload Handler
  const handleGcodeFileChange = (e: React.ChangeEvent<HTMLInputElement>, forCalc = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = (ev.target?.result as string) || '';
      const parsed = parseGCodeContent(text, file.name);
      setGcodeData(parsed);

      setCalcGrams(parsed.weightGrams);
      setCalcPrintHours(parsed.timeHours);

      const matched = spools.find(s => s.material.toUpperCase() === parsed.material.toUpperCase());
      if (matched) {
        setCalcSpoolId(matched.id);
        setCalcPricePerKg(matched.pricePerKg);
      }

      if (!forCalc) {
        setActiveTab('gcode');
      }
    };
    reader.readAsText(file);
  };

  // Kosten-Berechnung
  const filamentCost = (calcGrams / 1000) * calcPricePerKg;
  const powerKwh = (calcPrinterWatts * calcPrintHours) / 1000;
  const powerCost = powerKwh * calcKwhPrice;
  const wearCost = calcWearEuro;
  const totalCost = filamentCost + powerCost + wearCost;

  // KI-Agent Befehle verarbeiten
  const handleAiSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const prompt = aiInput.trim();
    if (!prompt) return;

    const userMsg: ChatMessage = {
      id: 'usr-' + Date.now(),
      text: prompt,
      isUser: true,
      timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, userMsg]);
    setAiInput('');

    const lower = prompt.toLowerCase();
    let botReply = '';

    if (lower.includes('kamera') || lower.includes('foto') || lower.includes('scannen') || lower.includes('fotografieren')) {
      onOpenCamera();
      botReply = 'Ich habe den Kamera-Scanner für dich geöffnet!';
    } else if (lower.includes('vereinfacht') || lower.includes('kompakt')) {
      onSetViewMode('simple');
      botReply = 'Ich habe auf die vereinfachte Ansicht umgeschaltet.';
    } else if (lower.includes('vollständig') || lower.includes('trocknungsbalken')) {
      onSetViewMode('full');
      botReply = 'Ich habe auf die vollständige Ansicht umgeschaltet.';
    } else if (lower.includes('wechsle zu') || lower.includes('version')) {
      const targetV = versionProfiles.find(v => lower.includes(v.id.toLowerCase()));
      if (targetV) {
        onSelectVersion(targetV.id);
        botReply = `Ich habe zu Profil ${targetV.label} gewechselt!`;
      } else {
        botReply = `Verfügbare Versionen: ${versionProfiles.map(v => v.id).join(', ')}.`;
      }
    } else if (lower.includes('einstellung') || lower.includes('tara') || lower.includes('eibos')) {
      setActiveTab('settings');
      botReply = `Einstellungs-Hub geöffnet! Eibos-Tara ist derzeit auf ${appSettings.eibosBagTara} g eingestellt.`;
    } else if (lower.includes('trocknen') || lower.includes('getrocknet')) {
      const match = spools.filter(s =>
        lower.includes(s.brand.toLowerCase()) ||
        lower.includes(s.name.toLowerCase()) ||
        lower.includes(s.colorName.toLowerCase())
      );
      if (match.length > 0) {
        match.forEach(m => onMarkDried(m.id));
        botReply = `Ich habe ${match.length} Spule(n) als getrocknet markiert!`;
      } else {
        botReply = 'Nenne mir den Namen oder die Farbe der Spule.';
      }
    } else if (lower.includes('zieh') || lower.includes('minus') || lower.includes('abziehen')) {
      const gramMatch = prompt.match(/(\d+)\s*(?:g|gramm)?/i);
      if (gramMatch) {
        const grams = parseInt(gramMatch[1]);
        const target = spools.find(s =>
          lower.includes(s.name.toLowerCase()) ||
          (lower.includes(s.brand.toLowerCase()) && lower.includes(s.colorName.toLowerCase())) ||
          lower.includes(s.colorName.toLowerCase())
        );
        if (target) {
          onDeductWeight(target.id, grams);
          botReply = `${grams} g wurden von „${target.brand} ${target.name}“ abgezogen.`;
        } else {
          botReply = `Ich konnte ${grams} g abziehen, aber von welcher Spule?`;
        }
      } else {
        botReply = 'Wie viel Gramm soll ich abziehen? (z.B. „Zieh 45g von Bambu Weiß ab“)';
      }
    } else {
      botReply = 'Befehle: Spule fotografieren („Kamera öffnen“), Gewicht abziehen („Zieh 50g ab“), Trocknung („Markiere Eryone als getrocknet“), Einstellungen anpassen oder Theme wechseln.';
    }

    setTimeout(() => {
      setChatMessages(prev => [
        ...prev,
        {
          id: 'bot-' + Date.now(),
          text: botReply,
          isUser: false,
          timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }, 250);
  };

  const handleCreateVersionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionName.trim()) return;
    onCreateVersionProfile(newVersionName.trim());
    setNewVersionName('');
    setShowNewVersionInput(false);
  };

  // Speichern der Material-Trocknungsparameter
  const handleSaveMaterial = () => {
    onUpdateMaterialPreset(selectedMaterial, {
      intervalDays: Number(matInterval) || 30,
      temp: Number(matTemp) || 50,
      hours: Number(matHours) || 5
    });
    setMatSavedSuccess(true);
    setTimeout(() => setMatSavedSuccess(false), 2000);
  };

  // Zurücksetzen der Material-Trocknungsparameter
  const handleResetMaterial = () => {
    onResetMaterialPreset(selectedMaterial);
    const def = MATERIAL_PRESETS[selectedMaterial];
    if (def) {
      setMatInterval(def.intervalDays);
      setMatTemp(def.temp);
      setMatHours(def.hours);
    }
    setMatSavedSuccess(true);
    setTimeout(() => setMatSavedSuccess(false), 2000);
  };

  // Speichern der Hersteller-Tara
  const handleSaveBrand = () => {
    onUpdateBrandPreset(selectedBrand, {
      tara: Number(brandTara) || 200,
      defaultPrice: Number(brandDefaultPrice) || 19.99
    });
    setBrandSavedSuccess(true);
    setTimeout(() => setBrandSavedSuccess(false), 2000);
  };

  // Zurücksetzen der Hersteller-Tara
  const handleResetBrand = () => {
    onResetBrandPreset(selectedBrand);
    const def = BRAND_DATABASE.find(b => b.name === selectedBrand);
    if (def) {
      setBrandTara(def.tara);
      setBrandDefaultPrice(def.defaultPrice);
    }
    setBrandSavedSuccess(true);
    setTimeout(() => setBrandSavedSuccess(false), 2000);
  };

  // Speichern der Eibos-Beutel-Tara
  const handleSaveEibosTara = () => {
    onUpdateEibosBagTara(Number(eibosTaraInput) || 35);
    setEibosSavedSuccess(true);
    setTimeout(() => setEibosSavedSuccess(false), 2000);
  };

  const handleCopyPairLink = async () => {
    try {
      await navigator.clipboard.writeText(pairUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {}
  };

  const isThemesTab = activeTab === 'settings' && settingsSubTab === 'themes';

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Klickbare rechte Fläche schließt das Menü SOFORT */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity cursor-pointer"
        title="Klick auf die freie Fläche schließt das Menü sofort"
      />

      {/* Menü-Drawer links - immer geblurred an der Seite außer im Themes-Tab für unverfälschte Farbwahrnehmung */}
      <aside
        onClick={e => e.stopPropagation()}
        className={`relative z-10 w-[460px] max-w-[94vw] border-r h-full flex flex-col justify-between shadow-2xl overflow-hidden transition-all duration-200 ${
          isThemesTab ? 'backdrop-blur-none' : 'backdrop-blur-2xl'
        }`}
        style={{
          backgroundColor: isThemesTab
            ? 'var(--app-card)'
            : 'color-mix(in srgb, var(--app-card) 85%, transparent)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-text)'
        }}
      >
        {/* Drawer Header: Schlank & Kompakt */}
        <div
          className="px-3.5 py-2.5 border-b flex items-center justify-between transition-colors shrink-0"
          style={{
            backgroundColor: isThemesTab
              ? 'var(--app-card-sub)'
              : 'color-mix(in srgb, var(--app-card-sub) 85%, transparent)',
            borderColor: 'var(--app-border)'
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-sm text-white shrink-0">
              <Disc className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xs tracking-tight" style={{ color: 'var(--app-text)' }}>
                  FilamentHub Menü
                </span>
                <span className="text-[10px] font-mono-num font-bold px-1.5 py-0.2 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30">
                  {activeVersion?.id}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowSelfHost(true)}
              className="px-2 py-1 rounded-lg text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer hover:opacity-90 active:scale-95 shadow-xs border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
              title="FilamentHub 24/7 autark auf deinem Raspberry Pi oder Docker hosten (ohne AI Studio Credits!)"
            >
              <Server className="w-3 h-3 text-emerald-400" />
              <span>Pi Host</span>
            </button>

            <a
              href="/api/export-project.zip"
              download="FilamentHub_v1.47_HAOS_Addon.zip"
              className="px-2 py-1 rounded-lg text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer hover:opacity-90 active:scale-95 shadow-xs border-purple-500/40 bg-purple-500/15 text-purple-300"
              title="Aktuellen Stand v1.47 als ZIP für Home Assistant OS / Git herunterladen"
            >
              <Download className="w-3 h-3 text-purple-400" />
              <span>ZIP</span>
            </a>

            <button
              type="button"
              onClick={() => setShowFunFacts(true)}
              className="px-2 py-1 rounded-lg text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer hover:opacity-90 active:scale-95 shadow-xs"
              style={{
                backgroundColor: 'var(--app-card)',
                borderColor: 'var(--app-accent)',
                color: 'var(--app-accent)'
              }}
              title="10 spannende Fakten über FilamentHub (Codezeilen, Sprache, Architektur)"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Fun Facts</span>
            </button>

            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:opacity-80 transition cursor-pointer"
              style={{ color: 'var(--app-text-muted)' }}
              title="Menü schließen (oder rechts außerhalb klicken)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* KOMPAKTE VERSIONSAUSWAHL: 5-Zeilen scrollbares Profil-Ausklappmenü */}
        <div
          className="relative px-3.5 py-2 border-b flex flex-col gap-1 transition-colors shrink-0"
          style={{
            backgroundColor: 'var(--app-card-sub)',
            borderColor: 'var(--app-border)'
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--app-text-muted)' }}>
              <Layers className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span>Profil:</span>
            </div>

            {/* Ausklappbarer Profil-Button */}
            <div ref={profileDropdownRef} className="flex-1 min-w-0 relative">
              <button
                type="button"
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between gap-1.5 border cursor-pointer transition shadow-sm text-left"
                style={{
                  backgroundColor: 'var(--app-input-bg)',
                  borderColor: isProfileDropdownOpen ? 'var(--app-accent)' : 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
                title="Profil-Auswahl öffnen (5 Zeilen scrollbar)"
              >
                <span className="truncate">
                  {versionProfiles.find(v => v.id === activeVersionId)?.label || activeVersionId}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-orange-400 shrink-0 transition-transform duration-200 ${
                    isProfileDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Ausklappliste: Genau 5 Zeilen hoch (max-h-[195px]), scrollbar */}
              {isProfileDropdownOpen && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border shadow-2xl max-h-[195px] overflow-y-auto divide-y divide-black/5 dark:divide-white/5 scrollbar-thin animate-in fade-in slide-in-from-top-1 duration-150"
                  style={{
                    backgroundColor: 'var(--app-card)',
                    borderColor: 'var(--app-border)'
                  }}
                >
                  {sortedVersionProfiles.map((v: VersionProfile) => {
                    const isActive = v.id === activeVersionId;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          onSelectVersion(v.id);
                          setIsProfileDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center justify-between gap-2 transition cursor-pointer min-h-[38px] ${
                          isActive
                            ? 'bg-orange-500/15 text-orange-400 font-bold'
                            : 'hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                        style={{
                          color: isActive ? undefined : 'var(--app-text)'
                        }}
                      >
                        <span className="truncate">{v.label}</span>
                        {isActive && <Check className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setShowNewVersionInput(!showNewVersionInput);
                setIsProfileDropdownOpen(false);
              }}
              className="text-[11px] font-bold px-2 py-1.5 rounded-lg border transition cursor-pointer shrink-0"
              style={{
                backgroundColor: 'var(--app-card)',
                borderColor: 'var(--app-border)',
                color: 'var(--app-accent)'
              }}
              title="Neuen Snapshot/Profil sichern"
            >
              {showNewVersionInput ? 'Abbrechen' : '+ Neu'}
            </button>
          </div>
        </div>

        {showNewVersionInput && (
          <form
            onSubmit={handleCreateVersionSubmit}
            className="px-3.5 py-2 border-b flex gap-2 transition-colors shrink-0"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)'
            }}
          >
            <input
              type="text"
              placeholder="Profilname (z.B. Werkstatt Setup)..."
              value={newVersionName}
              onChange={e => setNewVersionName(e.target.value)}
              className="flex-1 px-2.5 py-1 rounded-lg text-xs outline-none border"
              style={{
                backgroundColor: 'var(--app-input-bg)',
                borderColor: 'var(--app-border)',
                color: 'var(--app-text)'
              }}
              autoFocus
            />
            <button
              type="submit"
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
            >
              Sichern
            </button>
          </form>
        )}

        {/* SCHLANKE, PLATZSPARENDE MENÜ-NAVIGATION:
            Kompakte Punkte, damit die Unterpunkte NIE verdeckt werden */}
        <div
          className="p-1.5 border-b shrink-0 transition-colors"
          style={{
            backgroundColor: 'var(--app-card-sub)',
            borderColor: 'var(--app-border)'
          }}
        >
          <div className="grid grid-cols-5 gap-1">
            {[
              { id: 'ai', icon: Bot, label: 'KI' },
              { id: 'gcode', icon: FileCode2, labelLine1: 'G-Code', labelLine2: 'Rechner' },
              { id: 'tools', icon: Wrench, label: 'Tools' },
              { id: 'settings', icon: Settings, label: 'Einst.' },
              { id: 'connect', icon: Smartphone, label: 'Koppeln' }
            ].map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id || (item.id === 'gcode' && activeTab === 'calc');
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as SidebarTab)}
                  className={`py-1 px-0.5 rounded-lg border text-[11px] font-bold transition flex flex-col items-center justify-center gap-0.5 cursor-pointer min-h-[46px] ${
                    isActive ? 'shadow-sm' : 'hover:opacity-80'
                  }`}
                  style={{
                    backgroundColor: isActive ? 'var(--app-accent-sub)' : 'var(--app-card)',
                    borderColor: isActive ? 'var(--app-accent)' : 'var(--app-border)',
                    color: isActive ? 'var(--app-accent)' : 'var(--app-text-muted)',
                    boxShadow: isActive ? '0 0 0 1px var(--app-accent)' : undefined
                  }}
                  title={item.labelLine1 ? `${item.labelLine1} & ${item.labelLine2}` : item.label}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {item.labelLine1 ? (
                    <div className="flex flex-col items-center text-center leading-none">
                      <span className="text-[9.5px] leading-tight font-bold">{item.labelLine1}</span>
                      <span className="text-[8.5px] leading-tight opacity-80">{item.labelLine2}</span>
                    </div>
                  ) : (
                    <span className="truncate text-[10px]">{item.label}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* TAB-INHALTE: Großzügig, scrollbar & passt sich 100% dem Theme an */}
        <div
          className="flex-1 overflow-y-auto p-3.5 space-y-3.5 transition-colors"
          style={{
            backgroundColor: 'var(--app-card)',
            color: 'var(--app-text)'
          }}
        >
          {/* TAB 1: ZENTRALER EINSTELLUNGS-HUB */}
          {activeTab === 'settings' && (
            <div className="space-y-3">
              {/* Einstellungs-Sub-Navigation: 3 aufgeräumte Hauptbereiche */}
              <div
                className="grid grid-cols-3 gap-1.5 p-1 rounded-xl border text-[11px] font-bold transition-colors"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)'
                }}
              >
                <button
                  onClick={() => setSettingsSubTab('themes')}
                  className={`py-1.5 px-1 rounded-lg transition cursor-pointer truncate text-center font-bold ${
                    settingsSubTab === 'themes' ? 'shadow' : 'hover:opacity-80'
                  }`}
                  style={{
                    backgroundColor: settingsSubTab === 'themes' ? 'var(--app-accent)' : 'transparent',
                    color: settingsSubTab === 'themes' ? '#ffffff' : 'var(--app-text-muted)'
                  }}
                >
                  🎨 Aussehen
                </button>
                <button
                  onClick={() => setSettingsSubTab('presets')}
                  className={`py-1.5 px-1 rounded-lg transition cursor-pointer truncate text-center font-bold ${
                    settingsSubTab === 'presets' ? 'shadow' : 'hover:opacity-80'
                  }`}
                  style={{
                    backgroundColor: settingsSubTab === 'presets' ? 'var(--app-accent)' : 'transparent',
                    color: settingsSubTab === 'presets' ? '#ffffff' : 'var(--app-text-muted)'
                  }}
                >
                  🧪 Material & Tara
                </button>
                <button
                  onClick={() => setSettingsSubTab('homeassistant')}
                  className={`py-1.5 px-1 rounded-lg transition cursor-pointer truncate text-center font-bold ${
                    settingsSubTab === 'homeassistant' ? 'shadow' : 'hover:opacity-80'
                  }`}
                  style={{
                    backgroundColor: settingsSubTab === 'homeassistant' ? 'var(--app-accent)' : 'transparent',
                    color: settingsSubTab === 'homeassistant' ? '#ffffff' : 'var(--app-text-muted)'
                  }}
                >
                  🏠 Home Assistant
                </button>
              </div>

              {/* BEREICH 1: THEMES & DESIGN */}
              {settingsSubTab === 'themes' && (
                <div className="space-y-3">
                  <div
                    className="rounded-xl border p-3 space-y-1 transition-colors"
                    style={{
                      backgroundColor: 'var(--app-card-sub)',
                      borderColor: 'var(--app-border)'
                    }}
                  >
                    <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                      <Sliders className="w-4 h-4 text-orange-400" />
                      <span>Farbschemata & 5 Helligkeitsstufen</span>
                    </span>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                      Wähle aus 5 Helligkeiten (Weiß, Soft White, Neutral, Deep, Midnight OLED). Menü und alle Bereiche passen sich automatisch an.
                    </p>
                  </div>

                  <ThemeSelector
                    brightness={themeBrightness}
                    accent={themeAccent}
                    onSetBrightness={onSetBrightness}
                    onSetAccent={onSetAccent}
                    compact={false}
                  />
                </div>
              )}

              {/* BEREICH: KACHEL-GRÖSSE (SLIDER) */}
              {settingsSubTab === 'themes' && (
                <div
                  className="rounded-2xl border p-4 space-y-3.5 shadow-sm transition-colors"
                  style={{
                    backgroundColor: 'var(--app-card-sub)',
                    borderColor: 'var(--app-border)'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-xl border flex items-center justify-center transition-colors"
                        style={{
                          backgroundColor: 'var(--app-accent-sub)',
                          borderColor: 'var(--app-accent)',
                          color: 'var(--app-accent)'
                        }}
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs" style={{ color: 'var(--app-text)' }}>
                          Größe der Filament-Kacheln
                        </h4>
                        <p className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                          Karten stufenlos verkleinern oder vergrößern
                        </p>
                      </div>
                    </div>
                    <span
                      className="text-xs font-mono font-black px-2.5 py-1 rounded-lg border transition-colors"
                      style={{
                        backgroundColor: 'var(--app-accent-sub)',
                        borderColor: 'var(--app-accent)',
                        color: 'var(--app-accent)'
                      }}
                    >
                      {appSettings.cardSize || 340} px
                    </span>
                  </div>

                  {/* Slider Element mit dynamischer Spaltenberechnung */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10.5px] font-bold" style={{ color: 'var(--app-text-muted)' }}>
                      <span>Kompakt (200px)</span>
                      <span className="font-extrabold px-2 py-0.5 rounded-md border" style={{
                        backgroundColor: 'var(--app-accent-sub)',
                        borderColor: 'var(--app-accent)',
                        color: 'var(--app-accent)'
                      }}>
                        {(appSettings.cardSize || 340) <= 250
                          ? '⚡ 4–5 Kacheln / Reihe'
                          : (appSettings.cardSize || 340) <= 330
                          ? '📐 3–4 Kacheln / Reihe'
                          : (appSettings.cardSize || 340) <= 420
                          ? '🔍 2–3 Kacheln / Reihe'
                          : '🖼️ 1–2 Kacheln / Reihe'}
                      </span>
                      <span>Maximal (540px)</span>
                    </div>
                    <input
                      type="range"
                      min={200}
                      max={540}
                      step={10}
                      value={appSettings.cardSize || 340}
                      onChange={e => onUpdateCardSize?.(Number(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                      style={{
                        accentColor: 'var(--app-accent)',
                        backgroundColor: 'var(--app-border)'
                      }}
                    />
                  </div>

                  {/* Schnellauswahl-Buttons: Jeder Button mit anderer Größe UND Spaltenmenge */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                    {[
                      { count: '4–5 pro Reihe', label: 'Kompakt', size: 230 },
                      { count: '3–4 pro Reihe', label: 'Standard', size: 310 },
                      { count: '2–3 pro Reihe', label: 'Groß', size: 390 },
                      { count: '1–2 pro Reihe', label: 'Maxi', size: 490 }
                    ].map(preset => {
                      const isSelected = (appSettings.cardSize || 340) === preset.size;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => onUpdateCardSize?.(preset.size)}
                          className={`py-1.5 px-1.5 rounded-xl text-center border transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                            isSelected
                              ? 'text-white shadow-sm ring-2 ring-orange-500/50'
                              : 'hover:opacity-80'
                          }`}
                          style={{
                            backgroundColor: isSelected ? 'var(--app-accent)' : 'var(--app-card)',
                            borderColor: isSelected ? 'var(--app-accent)' : 'var(--app-border)',
                            color: isSelected ? '#ffffff' : 'var(--app-text-muted)'
                          }}
                        >
                          <span className="text-[10px] font-black">{preset.count}</span>
                          <span className="text-[9px] opacity-80">{preset.label} ({preset.size}px)</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* BEREICH 2: MATERIAL & TARA (PRESETS) */}
              {settingsSubTab === 'presets' && (
                <div className="space-y-3">
                  <div
                    className="rounded-xl border p-3 space-y-1 transition-colors"
                    style={{
                      backgroundColor: 'var(--app-card-sub)',
                      borderColor: 'var(--app-border)'
                    }}
                  >
                    <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                      <Flame className="w-4 h-4 text-amber-500" />
                      <span>Material-Trocknungszeiten & Temperatur</span>
                    </span>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                      Wähle ein Material aus dem Dropdown, um Trocknungsintervall, Temperatur und Dauer anzupassen.
                    </p>
                  </div>

                  <div
                    className="rounded-xl border p-3.5 space-y-3 text-xs transition-colors"
                    style={{
                      backgroundColor: 'var(--app-card-sub)',
                      borderColor: 'var(--app-border)'
                    }}
                  >
                    <div>
                      <label className="text-[11px] font-bold block mb-1" style={{ color: 'var(--app-text)' }}>
                        Material auswählen:
                      </label>
                      <select
                        value={selectedMaterial}
                        onChange={e => setSelectedMaterial(e.target.value as MaterialType)}
                        className="w-full px-3 py-2 rounded-lg border text-xs font-bold outline-none cursor-pointer"
                        style={{
                          backgroundColor: 'var(--app-input-bg)',
                          borderColor: 'var(--app-border)',
                          color: 'var(--app-text)'
                        }}
                      >
                        {MATERIAL_OPTIONS.map(mat => (
                          <option key={mat} value={mat}>
                            {mat} – {appSettings.materialPresets[mat]?.intervalDays ?? MATERIAL_PRESETS[mat]?.intervalDays ?? 30} Tage ({appSettings.materialPresets[mat]?.temp ?? MATERIAL_PRESETS[mat]?.temp ?? 50}°C)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] block mb-1 font-semibold" style={{ color: 'var(--app-text-muted)' }}>
                          Intervall (Tage):
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={matInterval}
                          onChange={e => setMatInterval(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono-num outline-none"
                          style={{
                            backgroundColor: 'var(--app-input-bg)',
                            borderColor: 'var(--app-border)',
                            color: 'var(--app-text)'
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] block mb-1 font-semibold" style={{ color: 'var(--app-text-muted)' }}>
                          Temp (°C):
                        </label>
                        <input
                          type="number"
                          min="30"
                          max="120"
                          value={matTemp}
                          onChange={e => setMatTemp(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono-num outline-none"
                          style={{
                            backgroundColor: 'var(--app-input-bg)',
                            borderColor: 'var(--app-border)',
                            color: 'var(--app-text)'
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] block mb-1 font-semibold" style={{ color: 'var(--app-text-muted)' }}>
                          Dauer (Std.):
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="48"
                          value={matHours}
                          onChange={e => setMatHours(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono-num outline-none"
                          style={{
                            backgroundColor: 'var(--app-input-bg)',
                            borderColor: 'var(--app-border)',
                            color: 'var(--app-text)'
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleSaveMaterial}
                        className="flex-1 py-2 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20"
                      >
                        {matSavedSuccess ? <Check className="w-3.5 h-3.5" /> : null}
                        <span>{matSavedSuccess ? 'Gespeichert!' : `Für ${selectedMaterial} speichern`}</span>
                      </button>
                      <button
                        onClick={handleResetMaterial}
                        title="Standard-Werkseinstellungen wiederherstellen"
                        className="py-2 px-3 rounded-lg border font-semibold text-xs transition cursor-pointer flex items-center gap-1"
                        style={{
                          backgroundColor: 'var(--app-card)',
                          borderColor: 'var(--app-border)',
                          color: 'var(--app-text-muted)'
                        }}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset</span>
                      </button>
                    </div>
                  </div>

                  {/* Hersteller-Tara & Eibos-Vakuumbeutel */}
                  <div
                    className="rounded-xl border p-3 space-y-1 transition-colors"
                    style={{
                      backgroundColor: 'var(--app-card-sub)',
                      borderColor: 'var(--app-border)'
                    }}
                  >
                    <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                      <Scale className="w-4 h-4 text-emerald-400" />
                      <span>Hersteller-Tara & Eibos-Vakuumbeutel</span>
                    </span>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                      Leerspulengewichte für Küchenwaage-Abzüge und Eibos-Beutel-Tara.
                    </p>
                  </div>

                  {/* Eibos-Beutel */}
                  <div
                    className="rounded-xl border p-3.5 space-y-2 text-xs transition-colors"
                    style={{
                      backgroundColor: 'var(--app-card-sub)',
                      borderColor: 'var(--app-border)'
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold flex items-center gap-1.5 text-xs text-sky-400">
                        <Package className="w-4 h-4" />
                        <span>Eibos-Vakuumbeutel Tara</span>
                      </span>
                      <span className="text-[10px] font-mono-num" style={{ color: 'var(--app-text-muted)' }}>
                        Aktuell: {appSettings.eibosBagTara} g
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        max="200"
                        value={eibosTaraInput}
                        onChange={e => setEibosTaraInput(Number(e.target.value))}
                        className="flex-1 px-3 py-1.5 rounded-lg border text-xs font-mono-num outline-none"
                        style={{
                          backgroundColor: 'var(--app-input-bg)',
                          borderColor: 'var(--app-border)',
                          color: 'var(--app-text)'
                        }}
                      />
                      <button
                        onClick={handleSaveEibosTara}
                        className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition cursor-pointer"
                      >
                        {eibosSavedSuccess ? 'Gespeichert!' : 'Übernehmen'}
                      </button>
                    </div>
                  </div>

                  {/* Hersteller Tara */}
                  <div
                    className="rounded-xl border p-3.5 space-y-3 text-xs transition-colors"
                    style={{
                      backgroundColor: 'var(--app-card-sub)',
                      borderColor: 'var(--app-border)'
                    }}
                  >
                    <div>
                      <label className="text-[11px] font-bold block mb-1" style={{ color: 'var(--app-text)' }}>
                        Hersteller auswählen:
                      </label>
                      <select
                        value={selectedBrand}
                        onChange={e => setSelectedBrand(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border text-xs font-bold outline-none cursor-pointer"
                        style={{
                          backgroundColor: 'var(--app-input-bg)',
                          borderColor: 'var(--app-border)',
                          color: 'var(--app-text)'
                        }}
                      >
                        {BRAND_DATABASE.map(b => {
                          const conf = appSettings.brandPresets[b.name];
                          return (
                            <option key={b.name} value={b.name}>
                              {b.name} (Tara: {conf?.tara ?? b.tara}g · {conf?.defaultPrice ?? b.defaultPrice} €/kg)
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] block mb-1 font-semibold" style={{ color: 'var(--app-text-muted)' }}>
                          Leerspule Tara (g):
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="500"
                          value={brandTara}
                          onChange={e => setBrandTara(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono-num outline-none"
                          style={{
                            backgroundColor: 'var(--app-input-bg)',
                            borderColor: 'var(--app-border)',
                            color: 'var(--app-text)'
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] block mb-1 font-semibold" style={{ color: 'var(--app-text-muted)' }}>
                          Standardpreis (€/kg):
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="5"
                          max="150"
                          value={brandDefaultPrice}
                          onChange={e => setBrandDefaultPrice(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono-num outline-none"
                          style={{
                            backgroundColor: 'var(--app-input-bg)',
                            borderColor: 'var(--app-border)',
                            color: 'var(--app-text)'
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleSaveBrand}
                        className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {brandSavedSuccess ? <Check className="w-3.5 h-3.5" /> : null}
                        <span>{brandSavedSuccess ? 'Gespeichert!' : `Für ${selectedBrand} speichern`}</span>
                      </button>
                      <button
                        onClick={handleResetBrand}
                        className="py-2 px-3 rounded-lg border font-semibold text-xs transition cursor-pointer flex items-center gap-1"
                        style={{
                          backgroundColor: 'var(--app-card)',
                          borderColor: 'var(--app-border)',
                          color: 'var(--app-text-muted)'
                        }}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* BEREICH 3: HOME ASSISTANT BAMBU LAB X2D TELEMETRIE & 60 ENTITÄTEN */}
              {settingsSubTab === 'homeassistant' && (() => {
                const devData = haTelemetry?.bambuX2d || haTelemetry?.bambuX1c;
                const allSensors: Array<{
                  entity_id: string;
                  name: string;
                  state: string;
                  unit: string;
                  category: string;
                }> = haTelemetry?.sensors || devData?.sensors || [];

                const filteredSensors = allSensors.filter(s => {
                  if (sensorCategoryFilter !== 'all' && s.category !== sensorCategoryFilter) return false;
                  if (sensorSearchQuery.trim()) {
                    const q = sensorSearchQuery.toLowerCase();
                    return (
                      s.entity_id.toLowerCase().includes(q) ||
                      (s.name && s.name.toLowerCase().includes(q)) ||
                      (s.state && String(s.state).toLowerCase().includes(q))
                    );
                  }
                  return true;
                });

                return (
                  <div className="space-y-3">
                    {/* 🏠 AUSKLAPPBARER NABU CASA REMOTE & TOKEN TRESOR */}
                    <div
                      className="rounded-xl border overflow-hidden transition-all shadow-sm"
                      style={{
                        backgroundColor: 'var(--app-card-sub)',
                        borderColor: isNabuVaultOpen ? 'var(--app-accent)' : 'var(--app-border)'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const next = !isNabuVaultOpen;
                          setIsNabuVaultOpen(next);
                          safeStorage.setItem('ha_vault_open', String(next));
                        }}
                        className="w-full p-3 flex items-center justify-between cursor-pointer hover:opacity-90 transition text-left"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                            <Lock className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold flex items-center gap-1.5 flex-wrap" style={{ color: 'var(--app-text)' }}>
                              <span>Nabu Casa Remote & Token Tresor</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Dauerhaft gespeichert
                              </span>
                            </div>
                            <div className="text-[10px] font-mono truncate text-slate-400">
                              {nabuUrlInput || 'https://xxxxxxxx.ui.nabu.casa'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 text-slate-400">
                          {isNabuVaultOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>

                      {isNabuVaultOpen && (
                        <div className="p-3 pt-0 border-t space-y-3" style={{ borderColor: 'var(--app-border)' }}>
                          <p className="text-[11px] leading-relaxed pt-2.5" style={{ color: 'var(--app-text-muted)' }}>
                            Hier werden deine Nabu Casa Cloud-URL und der langlebige Zugangs-Token dauerhaft in <code className="font-mono text-[10px] bg-black/30 px-1 py-0.5 rounded text-emerald-400">./data/ha-config.json</code> und im Browser gesichert.
                          </p>

                          {/* Nabu Casa Remote URL Input */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold block flex items-center justify-between" style={{ color: 'var(--app-text)' }}>
                              <span>Nabu Casa URL oder Lokale HA-Adresse:</span>
                              <span className="text-slate-400 font-mono text-[9px]">https://*.ui.nabu.casa</span>
                            </label>
                            <input
                              type="text"
                              value={nabuUrlInput}
                              onChange={e => setNabuUrlInput(e.target.value)}
                              placeholder="https://xxxxxxxxxxxxxxxx.ui.nabu.casa"
                              className="w-full px-3 py-1.5 rounded-lg border text-xs font-mono outline-none"
                              style={{
                                backgroundColor: 'var(--app-input-bg)',
                                borderColor: 'var(--app-border)',
                                color: 'var(--app-text)'
                              }}
                            />
                          </div>

                          {/* Long-Lived Access Token Input mit Maskierung */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold block flex items-center justify-between" style={{ color: 'var(--app-text)' }}>
                              <span>Langlebiger Zugangs-Token (Long-Lived Access Token):</span>
                              <span className="text-slate-400 font-mono text-[9px]">HA Profil → Token erstellen</span>
                            </label>
                            <div className="relative">
                              <input
                                type={showNabuToken ? 'text' : 'password'}
                                value={nabuTokenInput}
                                onChange={e => setNabuTokenInput(e.target.value)}
                                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                className="w-full pl-3 pr-9 py-1.5 rounded-lg border text-xs font-mono outline-none"
                                style={{
                                  backgroundColor: 'var(--app-input-bg)',
                                  borderColor: 'var(--app-border)',
                                  color: 'var(--app-text)'
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => setShowNabuToken(!showNabuToken)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                                title={showNabuToken ? 'Token verbergen' : 'Token anzeigen'}
                              >
                                {showNabuToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          {/* Test Result Feedback */}
                          {nabuTestResult && (
                            <div className="space-y-2">
                              <div className={`p-2.5 rounded-xl border text-xs font-bold ${
                                nabuTestResult.success
                                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                  : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                              }`}>
                                {nabuTestResult.message}
                              </div>

                              {nabuTestResult.isUnauthorized && (
                                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1.5 animate-fadeIn">
                                  <div className="font-bold flex items-center gap-1.5 text-amber-300">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <span>Home Assistant Token abgewiesen (HTTP 401) – So erstellst du ein neues:</span>
                                  </div>
                                  <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-300">
                                    <li>In Home Assistant unten links auf dein <strong>Profil / Benutzernamen</strong> klicken.</li>
                                    <li>Ganz nach unten scrollen zum Abschnitt <strong>„Langlebige Zugangs-Token“</strong>.</li>
                                    <li>Auf <strong>„Token erstellen“</strong> klicken (Name z.B. <em>FilamentHub</em>), den langen Code kopieren und hier oben im Feld einfügen.</li>
                                    <li>Anschließend auf <strong>„Dauerhaft speichern“</strong> klicken.</li>
                                  </ol>
                                </div>
                              )}
                            </div>
                          )}

                          {/* HA Automation Trigger Result Feedback */}
                          {haTriggerResult && (
                            <div className={`p-2.5 rounded-xl border text-xs font-bold ${
                              haTriggerResult.success
                                ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                                : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                            }`}>
                              {haTriggerResult.message}
                            </div>
                          )}

                          {/* Aktions-Buttons: Dauerhaft speichern & Verbindung testen */}
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handleSaveNabuVault}
                              className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              {nabuSavedSuccess ? <Check className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                              <span>{nabuSavedSuccess ? 'Dauerhaft gesichert!' : 'Dauerhaft speichern'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleTestNabuConnection}
                              disabled={nabuTesting}
                              className="py-2 px-3 rounded-lg border font-bold text-xs transition cursor-pointer flex items-center gap-1.5 hover:bg-white/10"
                              style={{
                                backgroundColor: 'var(--app-card)',
                                borderColor: 'var(--app-border)',
                                color: 'var(--app-text)'
                              }}
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${nabuTesting ? 'animate-spin text-emerald-400' : ''}`} />
                              <span>{nabuTesting ? 'Prüfe...' : 'Verbindung testen'}</span>
                            </button>
                          </div>

                          {/* 1-Klick Trigger für automation.filament_website_auto_pull_github */}
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => handleTriggerHaPullAutomation('automation.filament_website_auto_pull_github')}
                              disabled={haTriggering}
                              className="w-full py-2 px-3 rounded-lg border border-indigo-500/40 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                              title="Sendet POST /api/services/automation/trigger an Home Assistant"
                            >
                              <Sparkles className={`w-3.5 h-3.5 text-indigo-400 ${haTriggering ? 'animate-spin' : ''}`} />
                              <span>{haTriggering ? 'Triggere Home Assistant...' : '🚀 Automation in HA ausführen (auto_pull_github)'}</span>
                            </button>
                            <span className="text-[9px] block text-center mt-1 text-slate-400">
                              Triggert <code className="font-mono text-[9px] text-indigo-300">automation.filament_website_auto_pull_github</code> direkt über die Home Assistant API.
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div
                      className="rounded-xl border p-3 space-y-1.5 transition-colors"
                      style={{
                        backgroundColor: 'var(--app-card-sub)',
                        borderColor: 'var(--app-border)'
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                          <Home className="w-4 h-4 text-emerald-400" />
                          <span>Home Assistant • Bambu Lab X2D</span>
                        </span>
                        <button
                          onClick={fetchHaTelemetry}
                          disabled={haLoading}
                          className="px-2.5 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition cursor-pointer hover:bg-white/10"
                          style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                        >
                          <RefreshCw className={`w-3 h-3 ${haLoading ? 'animate-spin text-[#00AE42]' : ''}`} />
                          <span>{haLoading ? 'Lade 60 Entitäten...' : 'Aktualisieren'}</span>
                        </button>
                      </div>
                      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                        Liest automatisch alle <strong>60 Entitäten</strong> des Bambu Lab X2D (<code className="font-mono text-[10px] bg-black/20 px-1 py-0.5 rounded">ha-bambulab</code> Integration) aus Home Assistant aus.
                      </p>
                    </div>

                    {haActionToast && (
                      <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-between animate-fade-in">
                        <span>{haActionToast}</span>
                        <button onClick={() => setHaActionToast(null)} className="cursor-pointer text-xs ml-2">✕</button>
                      </div>
                    )}

                    {/* TELEMETRIE-STATUS-KACHELN */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {/* Düse 1 */}
                      <div
                        className="p-3 rounded-xl border space-y-1"
                        style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}
                      >
                        <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                          <span className="font-bold flex items-center gap-1">
                            <Flame className="w-3 h-3 text-rose-400" />
                            <span>Düse 1 (Hotend)</span>
                          </span>
                          <span className="font-mono">
                            Ziel: {devData?.nozzleTarget ? `${devData.nozzleTarget}°C` : '0°C'}
                          </span>
                        </div>
                        <div className="text-lg font-mono font-black" style={{ color: 'var(--app-text)' }}>
                          {devData?.nozzleTemp !== null && devData?.nozzleTemp !== undefined
                            ? `${devData.nozzleTemp}°C`
                            : '38°C'}
                        </div>
                      </div>

                      {/* Druckbett */}
                      <div
                        className="p-3 rounded-xl border space-y-1"
                        style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}
                      >
                        <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                          <span className="font-bold flex items-center gap-1">
                            <Thermometer className="w-3 h-3 text-amber-400" />
                            <span>Heizbett</span>
                          </span>
                          <span className="font-mono">
                            Ziel: {devData?.bedTarget ? `${devData.bedTarget}°C` : '0°C'}
                          </span>
                        </div>
                        <div className="text-lg font-mono font-black" style={{ color: 'var(--app-text)' }}>
                          {devData?.bedTemp !== null && devData?.bedTemp !== undefined
                            ? `${devData.bedTemp}°C`
                            : '33°C'}
                        </div>
                      </div>

                      {/* Bauraum */}
                      <div
                        className="p-3 rounded-xl border space-y-1"
                        style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}
                      >
                        <div className="text-[10px] font-bold" style={{ color: 'var(--app-text-muted)' }}>
                          Bauraum-Temp
                        </div>
                        <div className="text-lg font-mono font-black" style={{ color: 'var(--app-text)' }}>
                          {devData?.chamberTemp !== null && devData?.chamberTemp !== undefined
                            ? `${devData.chamberTemp}°C`
                            : '26°C'}
                        </div>
                      </div>

                      {/* AMS Trocknung */}
                      <div
                        className="p-3 rounded-xl border space-y-1"
                        style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}
                      >
                        <div className="text-[10px] font-bold flex items-center gap-1" style={{ color: 'var(--app-text-muted)' }}>
                          <Droplets className="w-3 h-3 text-sky-400" />
                          <span>AMS Trocknung</span>
                        </div>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span className={`w-2 h-2 rounded-full ${devData?.isDrying ? 'bg-amber-400 animate-ping' : 'bg-slate-500'}`} />
                          <span className="text-xs font-bold font-mono">
                            {devData?.isDrying ? '🔥 Aktiv' : 'Standby'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* STEUERUNG: BAURAUM LICHT */}
                    <div
                      className="p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-colors"
                      style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                          haLightActive ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-black/20 border-white/10 text-slate-400'
                        }`}>
                          <Lightbulb className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold" style={{ color: 'var(--app-text)' }}>
                            Bauraum-Licht (Chamber Light)
                          </div>
                          <div className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                            Status: {haLightActive ? 'Eingeschaltet' : 'Ausgeschaltet'}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={handleToggleHaLight}
                        className={`px-3.5 py-1.5 rounded-xl font-bold text-xs border transition cursor-pointer ${
                          haLightActive
                            ? 'bg-amber-500/25 border-amber-500/50 text-amber-300 hover:bg-amber-500/35'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {haLightActive ? 'Ausschalten' : 'Einschalten'}
                      </button>
                    </div>

                    {/* SENSOR-PFAD MAPPING: SENSOR.X2D.ALLOWED.SETTINGS.VENTILATION.AND.DRYER */}
                    <div
                      className="p-3.5 rounded-xl border space-y-2.5 transition-colors"
                      style={{
                        backgroundColor: 'var(--app-card-sub)',
                        borderColor: 'var(--app-border)'
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-extrabold" style={{ color: 'var(--app-text)' }}>
                          <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Sensor-Pfad: Ventilation & Dryer</span>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          Aktiv zugeordnet
                        </span>
                      </div>

                      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                        Hier kannst du den genauen Pfad eintragen, an den die X2D Lüfter- & Trocknereinstellungen übertragen werden:
                      </p>

                      <div className="space-y-1.5">
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={ventilationDryerPath}
                            onChange={e => setVentilationDryerPath(e.target.value)}
                            className="flex-1 px-3 py-1.5 rounded-lg border text-xs font-mono outline-none"
                            style={{
                              backgroundColor: 'var(--app-input-bg)',
                              borderColor: 'var(--app-border)',
                              color: 'var(--app-text)'
                            }}
                            placeholder="Sensor.X2D.Allowed.Settings.Ventilation.And.Dryer"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              safeStorage.setItem('ha_path_ventilation_dryer', ventilationDryerPath);
                              setHaActionToast('Pfad gespeichert!');
                              addSystemLog('system', `Sensorpfad gespeichert: ${ventilationDryerPath}`, 'Home Assistant X2D', 'info');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
                          >
                            Speichern
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(ventilationDryerPath);
                                setCopiedEntityId('ventilation_dryer');
                                setTimeout(() => setCopiedEntityId(null), 2000);
                              } catch {}
                            }}
                            className="px-2.5 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer hover:bg-white/10"
                            style={{
                              backgroundColor: 'var(--app-card)',
                              borderColor: 'var(--app-border)',
                              color: 'var(--app-text)'
                            }}
                            title="Pfad kopieren"
                          >
                            {copiedEntityId === 'ventilation_dryer' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 60 BAMBU LAB X2D ENTITÄTEN AUSLESEN & ANZEIGEN */}
                    <div
                      className="p-3.5 rounded-xl border space-y-3 text-xs transition-colors"
                      style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-extrabold" style={{ color: 'var(--app-text)' }}>
                          <Database className="w-3.5 h-3.5 text-orange-400" />
                          <span>Alle 60 X2D Entitäten ({filteredSensors.length}):</span>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-mono font-bold">
                          ha-bambulab aktiv
                        </span>
                      </div>

                      {/* Suchfeld */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-text-muted)' }} />
                        <input
                          type="text"
                          placeholder="Entität oder Sensor suchen (z.B. dryer, ventilation, temp, ams)..."
                          value={sensorSearchQuery}
                          onChange={e => setSensorSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-7 py-1.5 rounded-lg border text-xs outline-none font-mono"
                          style={{
                            backgroundColor: 'var(--app-input-bg)',
                            borderColor: 'var(--app-border)',
                            color: 'var(--app-text)'
                          }}
                        />
                        {sensorSearchQuery && (
                          <button
                            onClick={() => setSensorSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs opacity-70 hover:opacity-100"
                            style={{ color: 'var(--app-text-muted)' }}
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Kategorie Filter Chips */}
                      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar text-[10px]">
                        {(['all', 'ventilation_dryer', 'sensor', 'diagnostic', 'switch'] as const).map(cat => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setSensorCategoryFilter(cat)}
                            className={`px-2 py-0.5 rounded-md font-bold whitespace-nowrap border transition cursor-pointer ${
                              sensorCategoryFilter === cat ? 'bg-orange-500 text-white border-orange-500' : 'hover:opacity-80'
                            }`}
                            style={sensorCategoryFilter !== cat ? {
                              backgroundColor: 'var(--app-card)',
                              borderColor: 'var(--app-border)',
                              color: 'var(--app-text-muted)'
                            } : undefined}
                          >
                            {cat === 'all' ? 'Alle' : cat === 'ventilation_dryer' ? 'Lüfter & Trockner' : cat === 'sensor' ? 'Sensoren' : cat === 'diagnostic' ? 'Diagnose' : 'Schalter'}
                          </button>
                        ))}
                      </div>

                      {/* Sensor-Liste mit schnellem Pfad-Kopieren */}
                      <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px] divide-y divide-white/5">
                        {filteredSensors.map(s => (
                          <div
                            key={s.entity_id}
                            className="p-2 rounded-lg border flex items-center justify-between gap-2 transition hover:bg-black/20"
                            style={{
                              backgroundColor: 'var(--app-card)',
                              borderColor: 'var(--app-border)'
                            }}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-sans font-bold truncate text-xs" style={{ color: 'var(--app-text)' }}>
                                  {s.name || s.entity_id}
                                </span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-sans font-semibold uppercase bg-black/20 text-slate-400 shrink-0">
                                  {s.category || 'sensor'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                                <span className="truncate max-w-[210px]">{s.entity_id}</span>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await navigator.clipboard.writeText(s.entity_id);
                                      setCopiedEntityId(s.entity_id);
                                      setTimeout(() => setCopiedEntityId(null), 2000);
                                    } catch {}
                                  }}
                                  className="p-0.5 hover:text-white cursor-pointer"
                                  title="Entitäts-ID kopieren"
                                >
                                  {copiedEntityId === s.entity_id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="font-extrabold text-xs" style={{ color: 'var(--app-text)' }}>
                                {s.state} {s.unit || ''}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 2: VERBINDEN & APK */}
          {activeTab === 'connect' && (
            <div className="space-y-3.5">
              <div
                className="rounded-2xl border p-4 space-y-3 shadow-md transition-colors"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm" style={{ color: 'var(--app-text)' }}>
                        Android APK herunterladen
                      </h4>
                      <p className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                        FilamentHub v1.29 • Für alle Android-Geräte
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Auto-Sync
                  </span>
                </div>

                <a
                  href="/FilamentHub.apk"
                  download="FilamentHub.apk"
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs shadow-lg shadow-orange-500/20 transition flex items-center justify-center gap-2.5 cursor-pointer text-center"
                >
                  <Download className="w-4 h-4 text-white" />
                  <span>FilamentHub.apk jetzt herunterladen (2.8 MB)</span>
                </a>

                <div className="text-[11px] space-y-1" style={{ color: 'var(--app-text-muted)' }}>
                  <p>1. APK herunterladen und auf dem Smartphone antippen.</p>
                  <p>2. „Aus unbekannter Quelle installieren“ bestätigen.</p>
                  <p>3. Fertig! App synchronisiert sich vollautomatisch.</p>
                </div>
              </div>

              {/* QR-Kopplung */}
              <div
                className="rounded-2xl border p-4 space-y-3 transition-colors"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)'
                }}
              >
                <span className="font-bold text-xs block" style={{ color: 'var(--app-text)' }}>
                  Alternative: Live im Browser koppeln
                </span>
                <div className="flex justify-center p-2 rounded-xl" style={{ backgroundColor: 'var(--app-card)' }}>
                  {qrCodeDataUrl && (
                    <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-200">
                      <img src={qrCodeDataUrl} alt="Koppeln" className="w-32 h-32 object-contain" />
                    </div>
                  )}
                </div>
                <button
                  onClick={handleCopyPairLink}
                  className="w-full py-2 rounded-xl border font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                  style={{
                    backgroundColor: 'var(--app-card)',
                    borderColor: 'var(--app-border)',
                    color: 'var(--app-text)'
                  }}
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Koppel-Link in Zwischenablage!' : 'Koppel-Link kopieren'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: KI-AGENT */}
          {activeTab === 'ai' && (
            <div className="space-y-3">
              <div
                className="rounded-xl border p-3 space-y-2 transition-colors"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)'
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-orange-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>FilamentHub KI-Assistent</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold">
                    Bereit
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                  Befehle: „Kamera öffnen“, „Zieh 65g ab“, „Eibos Tara ändern“ oder „Markiere als getrocknet“.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    '📷 Kamera öffnen',
                    'Zieh 50g von Bambu Weiß ab',
                    'Markiere Eryone als getrocknet'
                  ].map(chip => (
                    <button
                      key={chip}
                      onClick={() => setAiInput(chip)}
                      className="px-2 py-1 rounded-md border text-[10px] cursor-pointer transition"
                      style={{
                        backgroundColor: 'var(--app-card)',
                        borderColor: 'var(--app-border)',
                        color: 'var(--app-text)'
                      }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat-Verlauf */}
              <div
                className="rounded-xl border p-3 h-56 overflow-y-auto space-y-2 text-xs transition-colors"
                style={{
                  backgroundColor: 'var(--app-input-bg)',
                  borderColor: 'var(--app-border)'
                }}
              >
                {chatMessages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-1.5 leading-relaxed text-xs ${
                        msg.isUser
                          ? 'bg-orange-500 text-white rounded-br-none'
                          : 'rounded-bl-none border'
                      }`}
                      style={
                        !msg.isUser
                          ? {
                              backgroundColor: 'var(--app-card)',
                              borderColor: 'var(--app-border)',
                              color: 'var(--app-text)'
                            }
                          : undefined
                      }
                    >
                      {msg.text}
                    </div>
                    <span className="text-[9px] mt-0.5 px-1" style={{ color: 'var(--app-text-muted)' }}>
                      {msg.timestamp}
                    </span>
                  </div>
                ))}
              </div>

              {/* Chat-Eingabe */}
              <form onSubmit={handleAiSubmit} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Befehl oder Frage eingeben..."
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-xl border text-xs outline-none"
                  style={{
                    backgroundColor: 'var(--app-input-bg)',
                    borderColor: 'var(--app-border)',
                    color: 'var(--app-text)'
                  }}
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition cursor-pointer shadow-md shadow-orange-500/20"
                >
                  Senden
                </button>
              </form>
            </div>
          )}

          {/* TAB 4: G-CODE & RECHNER (VEREINT) */}
          {(activeTab === 'gcode' || activeTab === 'calc') && (
            <div className="space-y-3.5">
              <div
                className="rounded-xl border p-3.5 space-y-2.5 transition-colors"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--app-text)' }}>
                    <FileCode2 className="w-4 h-4 text-orange-400" />
                    <span>G-Code Datei & X2D Live-Sync</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Auto-Analyse
                  </span>
                </div>

                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                  Lade eine <strong>.gcode</strong>-Datei hoch oder ziehe dir die aktuell druckende Datei direkt per Klick aus dem Bambu Lab X2D. Gewicht und Druckzeit werden automatisch in den Rechner übertragen.
                </p>

                {/* Button: Direkt vom X2D Drucker holen */}
                <button
                  type="button"
                  onClick={handlePullGcodeFromPrinter}
                  disabled={printerFetchLoading}
                  className="w-full py-2 px-3 rounded-xl border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 active:scale-95"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${printerFetchLoading ? 'animate-spin' : ''}`} />
                  <span>{printerFetchLoading ? 'Lese X2D Daten...' : '⚡ Aktuelle Druckdatei vom X2D übernehmen'}</span>
                </button>

                {/* Upload Button */}
                <label
                  className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-3.5 text-center cursor-pointer transition hover:border-orange-500/50"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-card)'
                  }}
                >
                  <UploadCloud className="w-6 h-6 text-orange-400 mb-1" />
                  <span className="text-xs font-bold" style={{ color: 'var(--app-text)' }}>
                    .gcode Datei manuell auswählen
                  </span>
                  <span className="text-[10px] mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                    Bambu Studio, OrcaSlicer, PrusaSlicer, Cura
                  </span>
                  <input
                    type="file"
                    accept=".gcode,.gco,.g"
                    onChange={handleGcodeFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Erfolgreich erkannter G-Code */}
              {gcodeData && (
                <div
                  className="rounded-xl border p-3.5 space-y-3 transition-colors animate-fadeIn"
                  style={{
                    backgroundColor: 'var(--app-card-sub)',
                    borderColor: 'var(--app-border)'
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        Analyse Erfolgreich
                      </span>
                      <h4 className="text-xs font-bold truncate max-w-[240px]" style={{ color: 'var(--app-text)' }}>
                        {gcodeData.fileName}
                      </h4>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                      {gcodeData.material}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 rounded-lg border" style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)' }}>
                      <span className="text-[10px] block" style={{ color: 'var(--app-text-muted)' }}>Gewicht</span>
                      <span className="text-base font-extrabold font-mono-num text-orange-400">
                        {gcodeData.weightGrams} g
                      </span>
                    </div>
                    <div className="p-2 rounded-lg border" style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)' }}>
                      <span className="text-[10px] block" style={{ color: 'var(--app-text-muted)' }}>Druckdauer</span>
                      <span className="text-base font-extrabold font-mono-num text-sky-400">
                        {gcodeData.timeHours.toFixed(1)} h
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] block" style={{ color: 'var(--app-text-muted)' }}>
                      Direkt von Spule abziehen:
                    </label>
                    <select
                      value={calcSpoolId}
                      onChange={e => setCalcSpoolId(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none cursor-pointer"
                      style={{
                        backgroundColor: 'var(--app-input-bg)',
                        borderColor: 'var(--app-border)',
                        color: 'var(--app-text)'
                      }}
                    >
                      {spools.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.brand} {s.name} ({s.remainingWeight}g Rest)
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => {
                        if (!calcSpoolId) return;
                        onDeductWeight(calcSpoolId, gcodeData.weightGrams);
                      }}
                      className="w-full mt-1.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>{gcodeData.weightGrams} g jetzt abziehen</span>
                    </button>
                  </div>
                </div>
              )}

              {/* INTEGRIERTER DRUCKKOSTEN-KALKULATOR */}
              <div className="space-y-3 pt-1">
                <div
                  className="rounded-xl border p-3 space-y-1 transition-colors"
                  style={{
                    backgroundColor: 'var(--app-card-sub)',
                    borderColor: 'var(--app-border)'
                  }}
                >
                  <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                    <Calculator className="w-4 h-4 text-orange-400" />
                    <span>Druckkosten-Kalkulator</span>
                  </span>
                  <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                    Berechnet Material-, Strom- und Gesamtkosten live basierend auf deinen Spulen und G-Code Werten.
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[11px] block mb-1" style={{ color: 'var(--app-text-muted)' }}>Spule:</label>
                    <select
                      value={calcSpoolId}
                      onChange={e => {
                        setCalcSpoolId(e.target.value);
                        const s = spools.find(sp => sp.id === e.target.value);
                        if (s) setCalcPricePerKg(s.pricePerKg);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none cursor-pointer"
                      style={{
                        backgroundColor: 'var(--app-input-bg)',
                        borderColor: 'var(--app-border)',
                        color: 'var(--app-text)'
                      }}
                    >
                      {spools.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.brand} {s.name} – {s.pricePerKg.toFixed(2)} €/kg
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] block mb-1" style={{ color: 'var(--app-text-muted)' }}>Verbrauch (g):</label>
                      <input
                        type="number"
                        value={calcGrams}
                        onChange={e => setCalcGrams(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border font-mono-num text-xs outline-none"
                        style={{
                          backgroundColor: 'var(--app-input-bg)',
                          borderColor: 'var(--app-border)',
                          color: 'var(--app-text)'
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] block mb-1" style={{ color: 'var(--app-text-muted)' }}>Filament (€/kg):</label>
                      <input
                        type="number"
                        step="0.1"
                        value={calcPricePerKg}
                        onChange={e => setCalcPricePerKg(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border font-mono-num text-xs outline-none"
                        style={{
                          backgroundColor: 'var(--app-input-bg)',
                          borderColor: 'var(--app-border)',
                          color: 'var(--app-text)'
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] block mb-1" style={{ color: 'var(--app-text-muted)' }}>Druckdauer (h):</label>
                      <input
                        type="number"
                        step="0.1"
                        value={calcPrintHours}
                        onChange={e => setCalcPrintHours(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border font-mono-num text-xs outline-none"
                        style={{
                          backgroundColor: 'var(--app-input-bg)',
                          borderColor: 'var(--app-border)',
                          color: 'var(--app-text)'
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] block mb-1" style={{ color: 'var(--app-text-muted)' }}>Leistung (W):</label>
                      <input
                        type="number"
                        value={calcPrinterWatts}
                        onChange={e => setCalcPrinterWatts(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border font-mono-num text-xs outline-none"
                        style={{
                          backgroundColor: 'var(--app-input-bg)',
                          borderColor: 'var(--app-border)',
                          color: 'var(--app-text)'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Kosten-Ergebnisbox */}
                <div
                  className="rounded-xl border p-3.5 space-y-2 transition-colors"
                  style={{
                    backgroundColor: 'var(--app-card-sub)',
                    borderColor: 'var(--app-border)'
                  }}
                >
                  <div className="flex justify-between items-center text-xs">
                    <span style={{ color: 'var(--app-text-muted)' }}>Material:</span>
                    <span className="font-mono-num font-bold" style={{ color: 'var(--app-text)' }}>{filamentCost.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span style={{ color: 'var(--app-text-muted)' }}>Strom:</span>
                    <span className="font-mono-num font-bold" style={{ color: 'var(--app-text)' }}>{powerCost.toFixed(2)} €</span>
                  </div>
                  <div className="pt-2 border-t flex justify-between items-center" style={{ borderColor: 'var(--app-border)' }}>
                    <span className="font-bold text-xs" style={{ color: 'var(--app-text)' }}>Gesamtkosten:</span>
                    <span className="text-lg font-extrabold font-mono-num text-orange-400">
                      {totalCost.toFixed(2)} €
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      if (!calcSpoolId) return;
                      onDeductWeight(calcSpoolId, calcGrams);
                    }}
                    className="w-full mt-2 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition cursor-pointer shadow-md"
                  >
                    {calcGrams} g abziehen
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: TOOLS & BACKUP */}
          {activeTab === 'tools' && (
            <div className="space-y-3">
              <div
                className="rounded-xl border p-3 space-y-2 transition-colors"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)'
                }}
              >
                <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                  <Wrench className="w-4 h-4 text-orange-400" />
                  <span>Cloud & Backup-Tools</span>
                </span>

                <div className="space-y-1.5 pt-1">
                  <button
                    onClick={onSyncCloud}
                    className="w-full py-2 px-3 rounded-lg border text-xs font-semibold transition cursor-pointer flex items-center justify-between"
                    style={{
                      backgroundColor: 'var(--app-card)',
                      borderColor: 'var(--app-border)',
                      color: 'var(--app-text)'
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-sky-400" />
                      <span>Jetzt mit Cloud synchronisieren</span>
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>npoint.io</span>
                  </button>

                  <button
                    onClick={onExportBackup}
                    className="w-full py-2 px-3 rounded-lg border text-xs font-semibold transition cursor-pointer flex items-center gap-2"
                    style={{
                      backgroundColor: 'var(--app-card)',
                      borderColor: 'var(--app-border)',
                      color: 'var(--app-text)'
                    }}
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>JSON-Backup herunterladen</span>
                  </button>

                  <label
                    className="w-full py-2 px-3 rounded-lg border text-xs font-semibold transition cursor-pointer flex items-center gap-2"
                    style={{
                      backgroundColor: 'var(--app-card)',
                      borderColor: 'var(--app-border)',
                      color: 'var(--app-text)'
                    }}
                  >
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span>JSON-Backup wiederherstellen</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) onImportBackup(f);
                      }}
                      className="hidden"
                    />
                  </label>

                  <button
                    onClick={() => {
                      if (confirm('Möchtest du wirklich alle 21 Standard-Spulen wiederherstellen?')) {
                        onRestoreDefaultSpools();
                      }
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 border border-rose-800/40 text-xs font-semibold text-rose-300 transition cursor-pointer flex items-center gap-2"
                  >
                    <Database className="w-4 h-4" />
                    <span>Auf 21 Standard-Spulen zurücksetzen</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div
          className="p-3 border-t flex items-center justify-between text-xs shrink-0 transition-colors"
          style={{
            backgroundColor: 'var(--app-card-sub)',
            borderColor: 'var(--app-border)',
            color: 'var(--app-text-muted)'
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                syncStatus.ok ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-[11px]">{syncStatus.label}</span>
          </div>

          <button
            onClick={() => onOpenNewSpool()}
            className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Spule hinzufügen</span>
          </button>
        </div>
      </aside>

      {/* Fun Facts & Self-Hosting Modals */}
      <FunFactsModal isOpen={showFunFacts} onClose={() => setShowFunFacts(false)} />
      <SelfHostModal isOpen={showSelfHost} onClose={() => setShowSelfHost(false)} currentVersion={activeVersion?.id || 'v1.47'} />
    </div>
  );
};
