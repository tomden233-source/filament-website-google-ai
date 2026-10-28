import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';

import QRCode from 'qrcode';

import {
  X,
  Disc,
  Bot,
  FileCode2,
  Wrench,
  Sparkles,
  Layers,
  PlusCircle,
  Smartphone,
  Settings,
  Check,
  LayoutGrid,
  ChevronDown
} from 'lucide-react';
import {
  AppSettings,
  BrandConfig,
  MaterialDryingConfig,
  SidebarTab,
  Spool,
  VersionProfile,
  ViewMode
} from '../types/filament';
import { ThemeBrightness, ThemeAccent } from '../types/theme';

import { SettingsThemesPanel } from './sidebar/SettingsThemesPanel';
import { SettingsPresetsPanel } from './sidebar/SettingsPresetsPanel';
import { SettingsConnectionsPanel } from './sidebar/SettingsConnectionsPanel';
import { SettingsHomeAssistantPanel } from './sidebar/SettingsHomeAssistantPanel';
import { ConnectTab } from './sidebar/ConnectTab';
import { AiAgentTab } from './sidebar/AiAgentTab';
import { GcodeCalcTab } from './sidebar/GcodeCalcTab';
import { ToolsTab } from './sidebar/ToolsTab';
import { isAppShell } from '../utils/env';

import { useCalculator } from './sidebar/useCalculator';
import { useHomeAssistantPanel } from './sidebar/useHomeAssistantPanel';
import { usePresetSettings } from './sidebar/usePresetSettings';
import { useGcodeImport } from './sidebar/useGcodeImport';
import { useAgentChat } from './sidebar/useAgentChat';

const FunFactsModal = lazy(() => import('./FunFactsModal').then(m => ({ default: m.FunFactsModal })));
const BambuSettingsModal = lazy(() => import('./BambuSettingsModal').then(m => ({ default: m.BambuSettingsModal })));

export interface SidebarProps {
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

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  onSetViewMode,
  spools,
  onDeductWeight,
  onMarkDried,
  onOpenNewSpool,
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
  cloudDbUrl,
  syncStatus
}) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('settings');

  // Kostenrechner State
  const {
    setCalcGrams,
    setCalcPrintHours,
    setCalcSpoolId,
    setCalcPricePerKg,
    calcSpoolId,
    calcGrams,
    calcPricePerKg,
    calcPrintHours,
    calcPrinterWatts,
    setCalcPrinterWatts,
    filamentCost,
    powerCost,
    totalCost
  } = useCalculator({ spools });

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

  // Einstellungen Sub-State
  const {
    selectedMaterial,
    setSelectedMaterial,
    matInterval,
    setMatInterval,
    matTemp,
    setMatTemp,
    matHours,
    setMatHours,
    handleSaveMaterial,
    matSavedSuccess,
    handleResetMaterial,
    eibosTaraInput,
    setEibosTaraInput,
    handleSaveEibosTara,
    eibosSavedSuccess,
    selectedBrand,
    setSelectedBrand,
    brandTara,
    setBrandTara,
    brandDefaultPrice,
    setBrandDefaultPrice,
    handleSaveBrand,
    brandSavedSuccess,
    handleResetBrand
  } = usePresetSettings({
    appSettings,
    onUpdateMaterialPreset,
    onResetMaterialPreset,
    onUpdateBrandPreset,
    onResetBrandPreset,
    onUpdateEibosBagTara
  });

  // QR-Code Kopplung im Einstellungsreiter
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [showBambuSettings, setShowBambuSettings] = useState<boolean>(false);
  const [settingsSubTab, setSettingsSubTab] = useState<'themes' | 'presets' | 'connections'>('themes');

  // Home Assistant Bambu Lab X2D Telemetrie & Sensor-Pfade (60 Entitäten)
  const {
    setHaActionToast,
    haTelemetry,
    sensorCategoryFilter,
    sensorSearchQuery,
    isNabuVaultOpen,
    setIsNabuVaultOpen,
    nabuUrlInput,
    setNabuUrlInput,
    showNabuToken,
    nabuTokenInput,
    setNabuTokenInput,
    setShowNabuToken,
    nabuTestResult,
    haTriggerResult,
    handleSaveNabuVault,
    nabuSavedSuccess,
    handleTestNabuConnection,
    nabuTesting,
    handleTriggerHaPullAutomation,
    haTriggering,
    fetchHaTelemetry,
    haLoading,
    haActionToast,
    haLightActive,
    handleToggleHaLight,
    ventilationDryerPath,
    setVentilationDryerPath,
    setCopiedEntityId,
    copiedEntityId,
    setSensorSearchQuery,
    setSensorCategoryFilter
  } = useHomeAssistantPanel({ activeTab, settingsSubTab });

  // Mapped Sensor Paths

  // Nabu Casa & Home Assistant Vault State (Dauerhaft gespeichert)

  // Neueste Versionen immer an oberster Stelle anzeigen (umgekehrte Reihenfolge)
  const sortedVersionProfiles = useMemo(() => {
    return [...versionProfiles].slice().reverse();
  }, [versionProfiles]);

  // Auto-Dismiss für alle Benachrichtigungen nach exakt 10 Sekunden (gemäß Benutzeranforderung)

  // Initiales Laden aus dem Tresor

  // Home Assistant Automation (automation.filament_website_auto_pull_github) auslösen (nativ & ohne JSON-Parse Absturz)

  // G-Code vom X2D Drucker automatisch übernehmen

  // Synchronisiere Eingabefelder mit appSettings bei Wechsel des gewählten Materials

  // Synchronisiere Eingabefelder mit appSettings bei Wechsel der gewählten Marke

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

  // G-Code Upload Handler
  const {
    handlePullGcodeFromPrinter,
    printerFetchLoading,
    handleGcodeFileChange,
    gcodeData
  } = useGcodeImport({
    setCalcGrams,
    setCalcPrintHours,
    setHaActionToast,
    spools,
    setCalcSpoolId,
    setCalcPricePerKg,
    setActiveTab
  });

  // KI-Agent Befehle verarbeiten
  const {
    setAiInput,
    chatMessages,
    handleAiSubmit,
    aiInput
  } = useAgentChat({
    spools,
    onOpenCamera,
    onSetViewMode,
    versionProfiles,
    onSelectVersion,
    setActiveTab,
    appSettings,
    onMarkDried,
    onDeductWeight
  });

  if (!isOpen) return null;

  const activeVersion =
    versionProfiles.find(v => v.id === activeVersionId) || versionProfiles[versionProfiles.length - 1];


  const handleCreateVersionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionName.trim()) return;
    onCreateVersionProfile(newVersionName.trim());
    setNewVersionName('');
    setShowNewVersionInput(false);
  };

  // Speichern der Material-Trocknungsparameter

  // Zurücksetzen der Material-Trocknungsparameter

  // Speichern der Hersteller-Tara

  // Zurücksetzen der Hersteller-Tara

  // Speichern der Eibos-Beutel-Tara

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
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center shadow-sm text-white shrink-0">
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
              onClick={() => setShowFunFacts(true)}
              className="px-2 py-1 rounded-lg text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer hover:opacity-90 active:scale-95 shadow-xs"
              style={{
                backgroundColor: 'var(--app-card)',
                borderColor: 'var(--app-accent)',
                color: 'var(--app-accent-text)'
              }}
              title="Echte Zahlen: Druckzeit, Lager, Filament-Länge, Code"
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
                color: 'var(--app-accent-text)'
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
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${isAppShell() ? 4 : 5}, minmax(0, 1fr))` }}
          >
            {[
              { id: 'ai', icon: Bot, label: 'KI' },
              { id: 'gcode', icon: FileCode2, labelLine1: 'G-Code', labelLine2: 'Rechner' },
              { id: 'tools', icon: Wrench, label: 'Tools' },
              { id: 'settings', icon: Settings, label: 'Einst.' },
              // "Handy" (App installieren, QR) ist in der installierten App überflüssig
              ...(isAppShell() ? [] : [{ id: 'connect', icon: Smartphone, label: 'Handy' }])
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
                    color: isActive ? 'var(--app-accent-text)' : 'var(--app-text-muted)',
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
                  onClick={() => setSettingsSubTab('connections')}
                  className={`py-1.5 px-1 rounded-lg transition cursor-pointer truncate text-center font-bold ${
                    settingsSubTab === 'connections' ? 'shadow' : 'hover:opacity-80'
                  }`}
                  style={{
                    backgroundColor: settingsSubTab === 'connections' ? 'var(--app-accent)' : 'transparent',
                    color: settingsSubTab === 'connections' ? '#ffffff' : 'var(--app-text-muted)'
                  }}
                >
                  🔌 Verbindungen
                </button>
              </div>

              {/* BEREICH 1: THEMES & DESIGN */}
              {settingsSubTab === 'themes' && <SettingsThemesPanel themeBrightness={themeBrightness} themeAccent={themeAccent} onSetBrightness={onSetBrightness} onSetAccent={onSetAccent} />}

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
                          color: 'var(--app-accent-text)'
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
                        color: 'var(--app-accent-text)'
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
                        color: 'var(--app-accent-text)'
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
              {settingsSubTab === 'presets' && <SettingsPresetsPanel selectedMaterial={selectedMaterial} setSelectedMaterial={setSelectedMaterial} appSettings={appSettings} matInterval={matInterval} setMatInterval={setMatInterval} matTemp={matTemp} setMatTemp={setMatTemp} matHours={matHours} setMatHours={setMatHours} handleSaveMaterial={handleSaveMaterial} matSavedSuccess={matSavedSuccess} handleResetMaterial={handleResetMaterial} eibosTaraInput={eibosTaraInput} setEibosTaraInput={setEibosTaraInput} handleSaveEibosTara={handleSaveEibosTara} eibosSavedSuccess={eibosSavedSuccess} selectedBrand={selectedBrand} setSelectedBrand={setSelectedBrand} brandTara={brandTara} setBrandTara={setBrandTara} brandDefaultPrice={brandDefaultPrice} setBrandDefaultPrice={setBrandDefaultPrice} handleSaveBrand={handleSaveBrand} brandSavedSuccess={brandSavedSuccess} handleResetBrand={handleResetBrand} />}

              {/* BEREICH 3: HOME ASSISTANT BAMBU LAB X2D TELEMETRIE & 60 ENTITÄTEN */}
              {settingsSubTab === 'connections' && <SettingsConnectionsPanel haUrl={nabuUrlInput} cloudDbUrl={cloudDbUrl} onOpenBambu={() => setShowBambuSettings(true)} onOpenApp={() => setActiveTab('connect')} haPanel={<SettingsHomeAssistantPanel haTelemetry={haTelemetry} sensorCategoryFilter={sensorCategoryFilter} sensorSearchQuery={sensorSearchQuery} isNabuVaultOpen={isNabuVaultOpen} setIsNabuVaultOpen={setIsNabuVaultOpen} nabuUrlInput={nabuUrlInput} setNabuUrlInput={setNabuUrlInput} showNabuToken={showNabuToken} nabuTokenInput={nabuTokenInput} setNabuTokenInput={setNabuTokenInput} setShowNabuToken={setShowNabuToken} nabuTestResult={nabuTestResult} haTriggerResult={haTriggerResult} handleSaveNabuVault={handleSaveNabuVault} nabuSavedSuccess={nabuSavedSuccess} handleTestNabuConnection={handleTestNabuConnection} nabuTesting={nabuTesting} handleTriggerHaPullAutomation={handleTriggerHaPullAutomation} haTriggering={haTriggering} fetchHaTelemetry={fetchHaTelemetry} haLoading={haLoading} haActionToast={haActionToast} setHaActionToast={setHaActionToast} haLightActive={haLightActive} handleToggleHaLight={handleToggleHaLight} ventilationDryerPath={ventilationDryerPath} setVentilationDryerPath={setVentilationDryerPath} setCopiedEntityId={setCopiedEntityId} copiedEntityId={copiedEntityId} setSensorSearchQuery={setSensorSearchQuery} setSensorCategoryFilter={setSensorCategoryFilter} />} />}
            </div>
          )}

          {/* TAB 2: VERBINDEN & APK */}
          {activeTab === 'connect' && <ConnectTab qrCodeDataUrl={qrCodeDataUrl} handleCopyPairLink={handleCopyPairLink} copiedLink={copiedLink} onOpenPWAInstall={onOpenPWAInstall} />}

          {/* TAB 3: KI-AGENT */}
          {activeTab === 'ai' && <AiAgentTab setAiInput={setAiInput} chatMessages={chatMessages} handleAiSubmit={handleAiSubmit} aiInput={aiInput} />}

          {/* TAB 4: G-CODE & RECHNER (VEREINT) */}
          {(activeTab === 'gcode' || activeTab === 'calc') && <GcodeCalcTab handlePullGcodeFromPrinter={handlePullGcodeFromPrinter} printerFetchLoading={printerFetchLoading} handleGcodeFileChange={handleGcodeFileChange} gcodeData={gcodeData} calcSpoolId={calcSpoolId} setCalcSpoolId={setCalcSpoolId} spools={spools} onDeductWeight={onDeductWeight} setCalcPricePerKg={setCalcPricePerKg} calcGrams={calcGrams} setCalcGrams={setCalcGrams} calcPricePerKg={calcPricePerKg} calcPrintHours={calcPrintHours} setCalcPrintHours={setCalcPrintHours} calcPrinterWatts={calcPrinterWatts} setCalcPrinterWatts={setCalcPrinterWatts} filamentCost={filamentCost} powerCost={powerCost} totalCost={totalCost} />}

          {/* TAB 6: TOOLS & BACKUP */}
          {activeTab === 'tools' && <ToolsTab onSyncCloud={onSyncCloud} onExportBackup={onExportBackup} onImportBackup={onImportBackup} onRestoreDefaultSpools={onRestoreDefaultSpools} />}
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
      <Suspense fallback={null}>
        {showBambuSettings && <BambuSettingsModal isOpen onClose={() => setShowBambuSettings(false)} />}
        {showFunFacts && <FunFactsModal isOpen onClose={() => setShowFunFacts(false)} spools={spools} />}
      </Suspense>
    </div>
  );
};
