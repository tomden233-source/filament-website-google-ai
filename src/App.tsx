import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Wand2,
  Layers,
  ArrowUpDown,
  Search,
  X,
  Camera,
  Smartphone,
  Tag,
  Minus,
  Plus,
  Zap,
  CheckCircle2,
  Pencil,
  Trash2,
  Edit3,
  Server
} from 'lucide-react';
import {
  AppSettings,
  BrandConfig,
  HistoryEntry,
  MaterialDryingConfig,
  MaterialType,
  Spool,
  VersionProfile,
  ViewMode
} from './types/filament';
import {
  ThemeBrightness,
  ThemeAccent
} from './types/theme';
import {
  DEFAULT_21_SPOOLS,
  DEFAULT_APP_SETTINGS,
  INITIAL_VERSION_PROFILES
} from './data/defaultSpools';
import {
  getBrandInfo,
  getDryingStatus,
  parseFilamentText
} from './utils/shopLinks';
import { safeStorage } from './utils/safeStorage';
import { Navbar, DeviceMode } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { SpoolCard } from './components/SpoolCard';
import { SpoolModal } from './components/SpoolModal';
import { AppAndQrModal } from './components/AppAndQrModal';
import { BambuPrinterWidget } from './components/BambuPrinterWidget';
import { HistoryModal } from './components/HistoryModal';
import { CameraModal } from './components/CameraModal';
import { NfcModal } from './components/NfcModal';
import { QuickDeductModal } from './components/QuickDeductModal';
import { RightLogDrawer } from './components/RightLogDrawer';
import { addSystemLog } from './utils/logService';

const STORAGE_KEY_SPOOLS = 'filamenthub_spools_v124';
const STORAGE_KEY_HISTORY = 'filamenthub_history_v124';
const STORAGE_KEY_SETTINGS = 'filamenthub_settings_v124';
const STORAGE_KEY_PROFILES = 'filamenthub_version_profiles';
const STORAGE_KEY_ACTIVE_VER = 'filamenthub_active_version';
const STORAGE_KEY_VIEW = 'filamenthub_view_mode';
const STORAGE_KEY_CLOUD_URL = 'filamenthub_cloud_db_url';
const STORAGE_KEY_THEME_BRIGHT = 'filamenthub_theme_brightness';
const STORAGE_KEY_THEME_ACCENT = 'filamenthub_theme_accent';

const LEGACY_SPOOL_KEYS = [
  'filamenthub_spools_v123',
  'filamenthub_spools_v122',
  'filamenthub_spools_v121',
  'filamenthub_spools_v120',
  'filamenthub_spools_v119',
  'filamenthub_spools_v12',
  'filamenthub_spools'
];

export default function App() {
  // Zeit-Ticker für sekündliche Live-Countdowns
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 5 Helligkeitsstufen & Akzente (Standard: Dunkelblau slate, kein versehentliches Weiß)
  const [themeBrightness, setThemeBrightness] = useState<ThemeBrightness>(() => {
    const saved = safeStorage.getItem(STORAGE_KEY_THEME_BRIGHT) as ThemeBrightness;
    if (saved === 'polar') {
      safeStorage.setItem(STORAGE_KEY_THEME_BRIGHT, 'slate');
      return 'slate';
    }
    return saved || 'slate';
  });
  const [themeAccent, setThemeAccent] = useState<ThemeAccent>(() => {
    return (safeStorage.getItem(STORAGE_KEY_THEME_ACCENT) as ThemeAccent) || 'orange';
  });

  // HTML Data-Attribute für Themes setzen
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeBrightness);
    safeStorage.setItem(STORAGE_KEY_THEME_BRIGHT, themeBrightness);
  }, [themeBrightness]);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', themeAccent);
    safeStorage.setItem(STORAGE_KEY_THEME_ACCENT, themeAccent);
  }, [themeAccent]);

  // Versionsprofile & Aktives Profil
  const [versionProfiles, setVersionProfiles] = useState<VersionProfile[]>(() => {
    try {
      const raw = safeStorage.getItem(STORAGE_KEY_PROFILES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Offizielle Profile immer aktuell halten (inkl. v1.23 & v1.24) und eigene Snapshots beibehalten
          const officialIds = new Set(INITIAL_VERSION_PROFILES.map(p => p.id));
          const customProfiles = parsed.filter((p: VersionProfile) => !officialIds.has(p.id));
          const merged = [...INITIAL_VERSION_PROFILES, ...customProfiles];
          safeStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(merged));
          return merged;
        }
      }
    } catch {}
    safeStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(INITIAL_VERSION_PROFILES));
    return INITIAL_VERSION_PROFILES;
  });

  const [activeVersionId, setActiveVersionId] = useState<string>(() => {
    const saved = safeStorage.getItem(STORAGE_KEY_ACTIVE_VER);
    // Veraltete Stände automatisch auf die neue v1.54 anheben
    if (!saved || saved !== 'v1.54') {
      safeStorage.setItem(STORAGE_KEY_ACTIVE_VER, 'v1.54');
      return 'v1.54';
    }
    return saved;
  });

  // Dokumententitel synchron mit aktiver Version halten
  useEffect(() => {
    document.title = `FilamentHub ${activeVersionId} – 3D-Druck Filament-Manager`;
  }, [activeVersionId]);

  // Ansichtsmodus: Beim ersten Aufruf der Webseite IMMER im Kompakt-Modus ('simple') starten
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Session-Check: Falls in der aktuellen Browser-Sitzung noch kein Modus gewählt wurde:
    // Garantiert IMMER erst mit 'simple' (Kompakt) starten!
    const sessionActive = safeStorage.getSessionItem('filamenthub_session_active');
    if (!sessionActive) {
      safeStorage.setSessionItem('filamenthub_session_active', 'true');
      safeStorage.setItem(STORAGE_KEY_VIEW, 'simple');
      return 'simple';
    }
    const saved = safeStorage.getItem(STORAGE_KEY_VIEW);
    return saved === 'full' || saved === 'params' ? (saved as ViewMode) : 'simple';
  });

  // Umschalter: 'desktop' (normale Desktop-Version) vs. 'app' (Smartphone-Modus)
  const [deviceMode, setDeviceMode] = useState<DeviceMode>(() => {
    return (safeStorage.getItem('filamenthub_device_mode') as DeviceMode) || 'desktop';
  });

  const handleSetDeviceMode = useCallback((mode: DeviceMode) => {
    setDeviceMode(mode);
    safeStorage.setItem('filamenthub_device_mode', mode);
  }, []);

  // Hauptbestand
  const [spools, setSpools] = useState<Spool[]>(() => {
    try {
      let raw = safeStorage.getItem(STORAGE_KEY_SPOOLS);
      if (!raw) {
        for (const k of LEGACY_SPOOL_KEYS) {
          const l = safeStorage.getItem(k);
          if (l) {
            const parsed = JSON.parse(l);
            if (Array.isArray(parsed) && parsed.length > 0) {
              raw = l;
              break;
            }
          }
        }
      }
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          let changed = false;
          const updated: Spool[] = parsed.map((s: Spool): Spool => {
            if (s.id === 'sp-18') {
              if (s.brand !== 'ELEGOO' || !s.name.includes('Marble') || s.colorHex !== '#e2e8f0') {
                changed = true;
                return {
                  ...s,
                  brand: 'ELEGOO',
                  name: 'Color Marble PLA',
                  material: 'PLA' as MaterialType,
                  colorName: 'Marmor',
                  colorHex: '#e2e8f0',
                  emptySpoolWeight: 160,
                  pricePerKg: 16.99,
                  dryTemp: 50,
                  dryHours: 5,
                  storageNote: s.storageNote || 'Pappspule (307g Brutto - 160g Spule)'
                };
              }
            }
            return s;
          });

          if (!updated.some(s => s.id === 'sp-18')) {
            const def18 = DEFAULT_21_SPOOLS.find(d => d.id === 'sp-18');
            if (def18) {
              updated.push(def18);
              changed = true;
            }
          }

          if (changed) {
            safeStorage.setItem(STORAGE_KEY_SPOOLS, JSON.stringify(updated));
          }
          return updated;
        }
      }
    } catch {}
    return DEFAULT_21_SPOOLS;
  });

  // Druckverlauf
  const [printHistory, setPrintHistory] = useState<HistoryEntry[]>(() => {
    try {
      const raw = safeStorage.getItem(STORAGE_KEY_HISTORY) || safeStorage.getItem('filamenthub_history_v121');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  // Undo / Redo Stacks
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  // Cloud Sync
  const [cloudDbUrl, setCloudDbUrl] = useState<string>(() => {
    return safeStorage.getItem(STORAGE_KEY_CLOUD_URL) || 'https://api.npoint.io/2a75ad089c77e7c35f98';
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<{ label: string; ok: boolean }>({
    label: 'Gespeichert',
    ok: true
  });

  // Filter & Sortierung
  const [activeMaterialFilter, setActiveMaterialFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('drying_urgent');

  // Schnell-Scanner
  const [quickLinkText, setQuickLinkText] = useState<string>('');
  const [isQuickScanning, setIsQuickScanning] = useState<boolean>(false);

  // Modals & Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isSpoolModalOpen, setIsSpoolModalOpen] = useState<boolean>(false);
  const [spoolToEdit, setSpoolToEdit] = useState<Spool | null>(null);
  const [spoolPrefill, setSpoolPrefill] = useState<Partial<Spool> | null>(null);
  const [isAppAndQrOpen, setIsAppAndQrOpen] = useState<boolean>(false);
  const [appAndQrTab, setAppAndQrTab] = useState<'app' | 'qr'>('app');
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState<boolean>(false);
  const [isNfcModalOpen, setIsNfcModalOpen] = useState<boolean>(false);
  const [nfcModalMode, setNfcModalMode] = useState<'read' | 'write' | 'batch' | 'write-direct' | 'inspect'>('batch');
  const [nfcSpoolId, setNfcSpoolId] = useState<string | undefined>(undefined);
  const [isQuickDeductOpen, setIsQuickDeductOpen] = useState<boolean>(false);

  // Manuell überschreibbarer Wert für verdrucktes Filament
  const [manualUsedGrams, setManualUsedGrams] = useState<number | null>(() => {
    try {
      const raw = safeStorage.getItem('filamenthub_manual_used_grams');
      if (raw !== null && raw !== '') {
        const num = parseFloat(raw);
        if (!isNaN(num)) return num;
      }
    } catch {}
    return null;
  });
  const [isEditUsedModalOpen, setIsEditUsedModalOpen] = useState<boolean>(false);
  const [editUsedInputValue, setEditUsedInputValue] = useState<string>('0');

  useEffect(() => {
    fetch('/api/storage/stats')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.stats && data.stats.manualUsedGrams !== undefined) {
          setManualUsedGrams(data.stats.manualUsedGrams);
        }
      })
      .catch(() => {});
  }, []);

  // Toast Nachrichten (alle Meldungen verschwinden automatisch nach 10 Sekunden)
  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([]);

  const showToast = useCallback((text: string) => {
    const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    setToasts(prev => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 10000);
  }, []);

  // Zentraler Einstellungs-Hub (Material-Trocknungszeiten, Hersteller-Tara, Eibos-Beutel)
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    try {
      const raw = safeStorage.getItem(STORAGE_KEY_SETTINGS) || safeStorage.getItem('filamenthub_settings_v122');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.materialPresets && parsed.brandPresets) {
          return {
            materialPresets: { ...DEFAULT_APP_SETTINGS.materialPresets, ...parsed.materialPresets },
            brandPresets: { ...DEFAULT_APP_SETTINGS.brandPresets, ...parsed.brandPresets },
            eibosBagTara: typeof parsed.eibosBagTara === 'number' ? parsed.eibosBagTara : DEFAULT_APP_SETTINGS.eibosBagTara,
            cardSize: typeof parsed.cardSize === 'number' ? parsed.cardSize : (DEFAULT_APP_SETTINGS.cardSize || 340)
          };
        }
      }
    } catch {}
    return DEFAULT_APP_SETTINGS;
  });

  const persistSettings = useCallback((newSettings: AppSettings) => {
    setAppSettings(newSettings);
    try {
      safeStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(newSettings));
    } catch {}
  }, []);

  const handleUpdateCardSize = useCallback((size: number) => {
    setAppSettings(prev => {
      const next = { ...prev, cardSize: size };
      persistSettings(next);
      return next;
    });
  }, [persistSettings]);

  const handleUpdateMaterialPreset = useCallback((mat: string, config: MaterialDryingConfig) => {
    setAppSettings(prev => {
      const next = {
        ...prev,
        materialPresets: {
          ...prev.materialPresets,
          [mat]: config
        }
      };
      persistSettings(next);
      return next;
    });
    showToast(`Trocknungsparameter für ${mat} gespeichert.`);
  }, [persistSettings, showToast]);

  const handleResetMaterialPreset = useCallback((mat: string) => {
    setAppSettings(prev => {
      const def = DEFAULT_APP_SETTINGS.materialPresets[mat];
      if (!def) return prev;
      const next = {
        ...prev,
        materialPresets: {
          ...prev.materialPresets,
          [mat]: def
        }
      };
      persistSettings(next);
      return next;
    });
    showToast(`Werkseinstellung für ${mat} wiederhergestellt.`);
  }, [persistSettings, showToast]);

  const handleUpdateBrandPreset = useCallback((brand: string, config: BrandConfig) => {
    setAppSettings(prev => {
      const next = {
        ...prev,
        brandPresets: {
          ...prev.brandPresets,
          [brand]: config
        }
      };
      persistSettings(next);
      return next;
    });
    showToast(`Standard-Tara für ${brand} gespeichert.`);
  }, [persistSettings, showToast]);

  const handleResetBrandPreset = useCallback((brand: string) => {
    setAppSettings(prev => {
      const def = DEFAULT_APP_SETTINGS.brandPresets[brand];
      if (!def) return prev;
      const next = {
        ...prev,
        brandPresets: {
          ...prev.brandPresets,
          [brand]: def
        }
      };
      persistSettings(next);
      return next;
    });
    showToast(`Werkseinstellung für ${brand} wiederhergestellt.`);
  }, [persistSettings, showToast]);

  const handleUpdateEibosBagTara = useCallback((tara: number) => {
    setAppSettings(prev => {
      const next = {
        ...prev,
        eibosBagTara: tara
      };
      persistSettings(next);
      return next;
    });
    showToast(`Eibos-Beutel Tara auf ${tara}g aktualisiert.`);
  }, [persistSettings, showToast]);

  const handleResetAllSettings = useCallback(() => {
    persistSettings(DEFAULT_APP_SETTINGS);
    showToast('Alle Einstellungen auf Standard zurückgesetzt.');
  }, [persistSettings, showToast]);

  // Snapshot für Undo
  const pushUndoSnapshot = useCallback(() => {
    const snapshot = JSON.stringify({ spools, printHistory });
    setUndoStack(prev => [...prev.slice(-49), snapshot]);
    setRedoStack([]);
  }, [spools, printHistory]);

  // Speichern in LocalStorage und Cloud
  const persistState = useCallback(
    async (newSpools: Spool[], newHistory: HistoryEntry[]) => {
      try {
        safeStorage.setItem(STORAGE_KEY_SPOOLS, JSON.stringify(newSpools));
        safeStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(newHistory));
      } catch {}

      if (isSyncing) return;
      setIsSyncing(true);
      setSyncStatus({ label: 'Speichere...', ok: false });
      try {
        const res = await fetch(cloudDbUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updatedAt: Date.now(),
            spools: newSpools,
            printHistory: newHistory
          })
        });
        if (res.ok) {
          setSyncStatus({ label: 'Cloud synchron', ok: true });
        } else {
          setSyncStatus({ label: 'Lokal gespeichert', ok: false });
        }
      } catch {
        setSyncStatus({ label: 'Lokal gespeichert', ok: false });
      } finally {
        setIsSyncing(false);
      }
    },
    [cloudDbUrl, isSyncing]
  );

  // Synchronisation von Cloud laden
  const syncWithCloud = useCallback(
    async (notify = false) => {
      if (isSyncing) return;
      setIsSyncing(true);
      try {
        const res = await fetch(cloudDbUrl, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.spools) && data.spools.length > 0) {
            setSpools(data.spools);
            if (Array.isArray(data.printHistory)) setPrintHistory(data.printHistory);
            safeStorage.setItem(STORAGE_KEY_SPOOLS, JSON.stringify(data.spools));
            setSyncStatus({ label: 'Cloud synchron', ok: true });
            if (notify) showToast('Erfolgreich mit Cloud synchronisiert!');
          } else {
            await persistState(spools, printHistory);
          }
        }
      } catch {
        setSyncStatus({ label: 'Lokal aktiv', ok: false });
      } finally {
        setIsSyncing(false);
      }
    },
    [cloudDbUrl, isSyncing, persistState, printHistory, showToast, spools]
  );

  // URL-Parameter prüfen (?pairCloud=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pair = params.get('pairCloud');
    if (pair && pair.startsWith('http')) {
      setCloudDbUrl(pair);
      safeStorage.setItem(STORAGE_KEY_CLOUD_URL, pair);
      window.history.replaceState({}, '', window.location.pathname);
      showToast('Handy erfolgreich mit Cloud-Datenbank gekoppelt!');
    }
    syncWithCloud(false);
  }, []);

  // Tastenkombinationen (ESC, Strg+Z, Strg+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSidebarOpen(false);
        setIsSpoolModalOpen(false);
        setIsAppAndQrOpen(false);
        setIsHistoryModalOpen(false);
        setIsCameraModalOpen(false);
        setIsNfcModalOpen(false);
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Undo / Redo Handlers
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const current = JSON.stringify({ spools, printHistory });
    const last = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, current]);
    try {
      const parsed = JSON.parse(last);
      if (Array.isArray(parsed.spools)) {
        setSpools(parsed.spools);
        setPrintHistory(parsed.printHistory || []);
        persistState(parsed.spools, parsed.printHistory || []);
        showToast('Rückgängig gemacht.');
      }
    } catch {}
  }, [undoStack, spools, printHistory, persistState, showToast]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const current = JSON.stringify({ spools, printHistory });
    const next = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, current]);
    try {
      const parsed = JSON.parse(next);
      if (Array.isArray(parsed.spools)) {
        setSpools(parsed.spools);
        setPrintHistory(parsed.printHistory || []);
        persistState(parsed.spools, parsed.printHistory || []);
        showToast('Wiederhergestellt (vorwärts).');
      }
    } catch {}
  }, [redoStack, spools, printHistory, persistState, showToast]);

  // Ansichtsmodus ändern
  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    safeStorage.setItem(STORAGE_KEY_VIEW, mode);
    showToast(mode === 'full' ? 'Vollständige Ansicht (mit Trocknungsbalken) aktiviert' : 'Vereinfachte Ansicht aktiviert');
  };

  // Dynamische Versionsauswahl & Isolierte Profile
  const handleSelectVersion = (versionId: string) => {
    const profile = versionProfiles.find(v => v.id === versionId);
    if (!profile) return;

    const updatedProfiles = versionProfiles.map(p => {
      if (p.id === activeVersionId) {
        return {
          ...p,
          spoolsSnapshot: spools,
          historySnapshot: printHistory,
          viewMode
        };
      }
      return p;
    });

    setVersionProfiles(updatedProfiles);
    safeStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(updatedProfiles));

    setActiveVersionId(versionId);
    safeStorage.setItem(STORAGE_KEY_ACTIVE_VER, versionId);

    const targetSpools = profile.spoolsSnapshot && profile.spoolsSnapshot.length > 0
      ? profile.spoolsSnapshot
      : spools;
    const targetHistory = profile.historySnapshot || [];

    setSpools(targetSpools);
    setPrintHistory(targetHistory);
    setViewMode(profile.viewMode || 'full');
    persistState(targetSpools, targetHistory);

    showToast(`Umschaltung auf ${profile.label} erfolgreich!`);
  };

  const handleCreateVersionProfile = (versionName: string) => {
    const id = versionName.toLowerCase().startsWith('v')
      ? versionName.toLowerCase().split(' ')[0]
      : 'v' + versionName.toLowerCase().split(' ')[0];

    const newProfile: VersionProfile = {
      id,
      label: versionName,
      releaseDate: new Date().toLocaleDateString('de-DE'),
      description: `Benutzerdefinierter Stand mit ${spools.length} Spulen.`,
      features: ['Individuelles Spulen-Setup', 'Gespeicherter Snapshot', 'Eigene Ansicht'],
      spoolsSnapshot: JSON.parse(JSON.stringify(spools)),
      historySnapshot: JSON.parse(JSON.stringify(printHistory)),
      viewMode
    };

    const nextProfiles = [...versionProfiles, newProfile];
    setVersionProfiles(nextProfiles);
    safeStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(nextProfiles));
    setActiveVersionId(id);
    safeStorage.setItem(STORAGE_KEY_ACTIVE_VER, id);
    showToast(`Neue Version ${versionName} gesichert und aktiviert!`);
  };

  // Spulen-Aktionen: Abziehen und Hinzufügen von Gewicht
  const handleAdjustWeight = (spoolId: string, deltaGrams: number) => {
    if (deltaGrams === 0) return;
    pushUndoSnapshot();

    const spool = spools.find(s => s.id === spoolId);
    if (!spool) return;

    const maxWeight = Math.max(spool.initialWeight || 1000, 3000);
    const newRemaining = Math.max(0, Math.min(maxWeight, (spool.remainingWeight || 0) + deltaGrams));
    const updatedSpools = spools.map(s => (s.id === spoolId ? { ...s, remainingWeight: newRemaining } : s));

    const newHistoryEntry: HistoryEntry = {
      id: 'log-' + Date.now(),
      spoolId: spool.id,
      spoolLabel: `${spool.brand} ${spool.name}`,
      grams: -deltaGrams,
      timestamp: new Date().toISOString()
    };

    const updatedHistory = [newHistoryEntry, ...printHistory];

    setSpools(updatedSpools);
    setPrintHistory(updatedHistory);
    persistState(updatedSpools, updatedHistory);
    if (deltaGrams < 0) {
      showToast(`${Math.abs(deltaGrams)}g abgezogen (${newRemaining}g übrig).`);
      addSystemLog('spule', `${Math.abs(deltaGrams)}g abgezogen von ${spool.brand} ${spool.name} (${newRemaining}g verbleibend)`, spool.name, 'info');
    } else {
      showToast(`${deltaGrams}g hinzugefügt (${newRemaining}g jetzt).`);
      addSystemLog('spule', `${deltaGrams}g hinzugefügt zu ${spool.brand} ${spool.name} (${newRemaining}g gesamt)`, spool.name, 'info');
    }
  };

  const handleDeductWeight = (spoolId: string, grams: number) => {
    handleAdjustWeight(spoolId, -Math.abs(grams));
  };

  const handleAddWeight = (spoolId: string, grams: number) => {
    handleAdjustWeight(spoolId, Math.abs(grams));
  };

  // 1-Klick NFC Öffner: Wenn unbeschrieben (rot) -> Direkt schreiben! Wenn beschrieben (grün) -> Details & Löschen!
  const handleOpenSpoolNfc = useCallback((spoolId: string) => {
    const spool = spools.find(s => s.id === spoolId);
    setNfcSpoolId(spoolId);
    if (spool?.nfcWritten) {
      setNfcModalMode('inspect');
    } else {
      setNfcModalMode('write-direct');
    }
    setIsNfcModalOpen(true);
  }, [spools]);

  const handleApplyScale = (spoolId: string, grossWeight: number) => {
    const spool = spools.find(s => s.id === spoolId);
    if (!spool) return;

    const tara = spool.emptySpoolWeight || 0;
    if (grossWeight < tara) {
      showToast(`⚠️ ${grossWeight} g ist weniger als die Leerspule (${tara} g).`);
      return;
    }

    pushUndoSnapshot();
    const newNet = Math.round(grossWeight - tara);
    const oldNet = spool.remainingWeight || 0;
    const diff = oldNet - newNet;

    const updatedSpools = spools.map(s => (s.id === spoolId ? { ...s, remainingWeight: newNet } : s));
    let updatedHistory = printHistory;

    if (diff > 0) {
      updatedHistory = [
        {
          id: 'log-' + Date.now(),
          spoolId: spool.id,
          spoolLabel: `${spool.brand} ${spool.name} (Waage)`,
          grams: diff,
          timestamp: new Date().toISOString()
        },
        ...printHistory
      ];
    }

    setSpools(updatedSpools);
    setPrintHistory(updatedHistory);
    persistState(updatedSpools, updatedHistory);
    showToast(`Waage: ${grossWeight}g − ${tara}g Spule = ${newNet}g Filament.`);
  };

  const handleMarkDried = (spoolId: string) => {
    pushUndoSnapshot();
    const updatedSpools = spools.map(s =>
      s.id === spoolId ? { ...s, lastDried: new Date().toISOString() } : s
    );
    setSpools(updatedSpools);
    persistState(updatedSpools, printHistory);
    const spool = spools.find(s => s.id === spoolId);
    showToast(`${spool?.brand} ${spool?.name} als frisch getrocknet markiert!`);
    addSystemLog('spule', `${spool?.brand} ${spool?.name} als frisch getrocknet markiert`, spool?.name, 'success');
  };

  // Trockenstand anteilig oder voll anrechnen:
  // "und wenn ich dann spulen ins ams zuweise und du erkennst, dass sie x lang getrocknet wurden dann rechne es auf die trockenstand drauf
  // wenn ich pla nur die hälfte der zeit getrocknet habe dann rechne halt nur die hälfte drauf"
  const handleApplyDryingCredit = useCallback((spoolId: string, driedHours: number, dryTemp?: number) => {
    if (driedHours <= 0) return;
    const spool = spools.find(s => s.id === spoolId);
    if (!spool) return;

    pushUndoSnapshot();
    const now = Date.now();
    const intervalDays = Number(spool.dryIntervalDays) || 30;
    const intervalMs = intervalDays * 86400000;
    const recommendedHours = Number(spool.dryHours) || (spool.material === 'PLA' ? 5 : spool.material === 'PETG' ? 6 : 8);

    // Anteil berechnen (z.B. 2.5h von 5h = 0.5 = 50%)
    const ratio = Math.min(1.0, driedHours / recommendedHours);
    const addedDays = Number((ratio * intervalDays).toFixed(1));

    const lastDriedMs = new Date(spool.lastDried || now).getTime();
    const currentDiffMs = Math.max(0, (lastDriedMs + intervalMs) - now);

    // Neuen Frische-Puffer berechnen (maximal volles Intervall)
    const newRemainingMs = Math.min(intervalMs, currentDiffMs + (ratio * intervalMs));
    const newLastDriedMs = now - (intervalMs - newRemainingMs);
    const newLastDried = new Date(newLastDriedMs).toISOString();

    const updatedSpool: Spool = {
      ...spool,
      lastDried: newLastDried,
      ...(dryTemp ? { dryTemp } : {})
    };

    const updatedSpools = spools.map(s => (s.id === spoolId ? updatedSpool : s));
    setSpools(updatedSpools);
    persistState(updatedSpools, printHistory);

    const pctText = Math.round(ratio * 100);
    showToast(`☀️ ${spool.name}: ${driedHours}h getrocknet (${pctText}% von ${recommendedHours}h Soll) ➔ +${addedDays} Tage auf Trockenstand angerechnet!`);
    addSystemLog('spule', `☀️ ${spool.name}: ${driedHours}h getrocknet ➔ +${addedDays} Tage Gutschrift auf Trockenstand`, spool.name, 'success');
  }, [spools, printHistory, persistState, pushUndoSnapshot, showToast]);

  const handleDuplicateSpool = (spoolId: string) => {
    const orig = spools.find(s => s.id === spoolId);
    if (!orig) return;
    pushUndoSnapshot();

    const copy: Spool = {
      ...JSON.parse(JSON.stringify(orig)),
      id: 'sp-' + Date.now(),
      name: `${orig.name} (Kopie)`,
      lastDried: new Date().toISOString()
    };

    const updated = [copy, ...spools];
    setSpools(updated);
    persistState(updated, printHistory);
    showToast(`Spule „${orig.name}“ kopiert.`);
  };

  const handleDeleteSpool = (spoolId: string) => {
    const spool = spools.find(s => s.id === spoolId);
    if (!spool) return;
    pushUndoSnapshot();

    const updated = spools.filter(s => s.id !== spoolId);
    setSpools(updated);
    persistState(updated, printHistory);
    showToast(`Spule gelöscht – oben auf „Zurück“ tippen zum Wiederherstellen.`);
  };

  const handleSaveSpool = (spoolData: Spool) => {
    pushUndoSnapshot();
    const exists = spools.some(s => s.id === spoolData.id);
    let updated: Spool[];

    if (exists) {
      updated = spools.map(s => (s.id === spoolData.id ? spoolData : s));
      showToast(`Spule „${spoolData.name}“ aktualisiert.`);
    } else {
      updated = [spoolData, ...spools];
      showToast(`Neue Spule „${spoolData.name}“ gespeichert.`);
    }

    setSpools(updated);
    persistState(updated, printHistory);
    setIsSpoolModalOpen(false);
    setSpoolToEdit(null);
    setSpoolPrefill(null);
  };

  const handleMarkSpoolNfcWritten = useCallback((spoolId: string, written: boolean) => {
    setSpools(prev => {
      const next = prev.map(s => (s.id === spoolId ? { ...s, nfcWritten: written } : s));
      persistState(next, printHistory);
      return next;
    });
  }, [printHistory, persistState]);

  const handleResetAllNfcWritten = useCallback(() => {
    setSpools(prev => {
      const next = prev.map(s => ({ ...s, nfcWritten: false }));
      persistState(next, printHistory);
      return next;
    });
    showToast('Alle Spulen auf unbeschrieben (rot) zurückgesetzt.');
  }, [printHistory, persistState, showToast]);

  const handleUndoHistoryItem = (historyId: string) => {
    const item = printHistory.find(h => h.id === historyId);
    if (!item) return;

    pushUndoSnapshot();
    const spool = spools.find(s => s.id === item.spoolId);
    let updatedSpools = spools;
    if (spool) {
      updatedSpools = spools.map(s =>
        s.id === spool.id ? { ...s, remainingWeight: (s.remainingWeight || 0) + item.grams } : s
      );
    }
    const updatedHistory = printHistory.filter(h => h.id !== historyId);

    setSpools(updatedSpools);
    setPrintHistory(updatedHistory);
    persistState(updatedSpools, updatedHistory);
    showToast(`Abzug von ${item.grams}g rückgängig gemacht.`);
  };

  const handleRestoreDefault21 = () => {
    pushUndoSnapshot();
    setSpools(DEFAULT_21_SPOOLS);
    persistState(DEFAULT_21_SPOOLS, printHistory);
    showToast('Alle 21 diktierten Spulen wiederhergestellt!');
  };

  const handleExportBackup = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            activeVersionId,
            versionProfiles,
            spools,
            printHistory
          },
          null,
          2
        )
      ],
      { type: 'application/json' }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `filamenthub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast('Backup-Datei heruntergeladen.');
  };

  const handleImportBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string;
        const parsed = JSON.parse(text);
        const imported = Array.isArray(parsed) ? parsed : parsed.spools;
        if (Array.isArray(imported) && imported.length > 0) {
          pushUndoSnapshot();
          setSpools(imported);
          if (Array.isArray(parsed.printHistory)) setPrintHistory(parsed.printHistory);
          if (Array.isArray(parsed.versionProfiles)) setVersionProfiles(parsed.versionProfiles);
          persistState(imported, parsed.printHistory || []);
          showToast(`${imported.length} Spulen erfolgreich importiert!`);
        }
      } catch {
        showToast('Fehler beim Lesen der JSON-Datei.');
      }
    };
    reader.readAsText(file);
  };

  // Kamera-Erkennung Callback
  const handleSpoolRecognizedFromCamera = (data: Partial<Spool>) => {
    setSpoolToEdit(null);
    setSpoolPrefill(data);
    setIsSpoolModalOpen(true);
    showToast('Spule aus Foto erkannt! Prüfen und mit einem Klick speichern.');
  };

  // Schnell-Scanner
  const handleQuickScan = () => {
    const raw = quickLinkText.trim();
    if (!raw) return;
    setIsQuickScanning(true);
    const parsed = parseFilamentText(raw, '', appSettings);
    setIsQuickScanning(false);
    setQuickLinkText('');
    setSpoolToEdit(null);
    setSpoolPrefill(parsed);
    setIsSpoolModalOpen(true);
  };

  // KPIs
  const totalGrams = useMemo(() => {
    return spools.reduce((acc, s) => acc + (s.remainingWeight || 0), 0);
  }, [spools]);

  const totalValue = useMemo(() => {
    return spools.reduce((acc, s) => {
      const price = s.pricePerKg || getBrandInfo(s.brand, appSettings).defaultPrice || 19.99;
      return acc + ((s.remainingWeight || 0) / 1000) * price;
    }, 0);
  }, [spools, appSettings]);

  const dueDryingCount = useMemo(() => {
    return spools.filter(s => getDryingStatus(s, now).statusLevel !== 'ok').length;
  }, [spools, now]);

  const totalUsedGrams = useMemo(() => {
    if (manualUsedGrams !== null) return manualUsedGrams;
    return printHistory.reduce((acc, h) => acc + (h.grams || 0), 0);
  }, [printHistory, manualUsedGrams]);

  const handleSaveUsedGrams = async (val: number) => {
    setManualUsedGrams(val);
    safeStorage.setItem('filamenthub_manual_used_grams', String(val));
    try {
      await fetch('/api/storage/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manualUsedGrams: val })
      });
    } catch {}
    showToast(`Verdrucktes Filament auf ${val} g gesetzt.`);
    setIsEditUsedModalOpen(false);
  };

  // Gefilterte und sortierte Spulen
  const filteredSpools = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const result = spools.filter(s => {
      const matchesMat = activeMaterialFilter === 'ALL' || s.material === activeMaterialFilter;
      const matchesSearch =
        !q ||
        `${s.brand} ${s.name} ${s.material} ${s.colorName || ''} ${s.storageNote || ''}`
          .toLowerCase()
          .includes(q);
      return matchesMat && matchesSearch;
    });

    result.sort((a, b) => {
      if (sortBy === 'drying_urgent') return getDryingStatus(a, now).diffMs - getDryingStatus(b, now).diffMs;
      if (sortBy === 'drying_fresh') return getDryingStatus(b, now).diffMs - getDryingStatus(a, now).diffMs;
      if (sortBy === 'remaining_asc') return (a.remainingWeight || 0) - (b.remainingWeight || 0);
      if (sortBy === 'remaining_desc') return (b.remainingWeight || 0) - (a.remainingWeight || 0);
      if (sortBy === 'price_asc') {
        const pA = a.pricePerKg || getBrandInfo(a.brand).defaultPrice;
        const pB = b.pricePerKg || getBrandInfo(b.brand).defaultPrice;
        return pA - pB;
      }
      if (sortBy === 'brand_asc') return (a.brand || '').localeCompare(b.brand || '');
      if (sortBy === 'material_asc') return (a.material || '').localeCompare(b.material || '');
      if (sortBy === 'color_asc') return (a.colorName || '').localeCompare(b.colorName || '');
      return 0;
    });

    return result;
  }, [spools, activeMaterialFilter, searchQuery, sortBy, now]);

  const activeVersion =
    versionProfiles.find(v => v.id === activeVersionId) || versionProfiles[versionProfiles.length - 1];

  return (
    <div
      className="min-h-screen flex flex-col transition-colors selection:bg-orange-500 selection:text-white"
      style={{
        backgroundColor: 'var(--app-bg)',
        color: 'var(--app-text)'
      }}
    >
      {/* Top Navbar */}
      <Navbar
        onOpenMenu={() => setIsSidebarOpen(true)}
        deviceMode={deviceMode}
        onSetDeviceMode={handleSetDeviceMode}
        viewMode={viewMode}
        onSetViewMode={handleSetViewMode}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenQr={() => {
          setAppAndQrTab('app');
          setIsAppAndQrOpen(true);
        }}
        onSyncCloud={() => syncWithCloud(true)}
        isSyncing={isSyncing}
        syncOk={syncStatus.ok}
        onOpenHistory={() => setIsHistoryModalOpen(true)}
        historyCount={printHistory.length}
        onOpenNewSpool={() => {
          setSpoolToEdit(null);
          setSpoolPrefill(null);
          setIsSpoolModalOpen(true);
        }}
        onOpenNfc={() => {
          setNfcModalMode('read');
          setNfcSpoolId(undefined);
          setIsNfcModalOpen(true);
        }}
        activeVersionLabel={activeVersion?.label || activeVersionId}
        versionProfiles={versionProfiles}
        activeVersionId={activeVersionId}
        onSelectVersion={handleSelectVersion}
        onCreateVersionProfile={handleCreateVersionProfile}
        onRestoreDefault={handleRestoreDefault21}
        onOpenCamera={() => setIsCameraModalOpen(true)}
        onOpenPWAInstall={() => {
          setAppAndQrTab('app');
          setIsAppAndQrOpen(true);
        }}
      />

      {/* Slide-out Sidebar mit Klick-Schließen */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        viewMode={viewMode}
        onSetViewMode={handleSetViewMode}
        spools={spools}
        onDeductWeight={handleDeductWeight}
        onMarkDried={handleMarkDried}
        onOpenNewSpool={prefill => {
          setSpoolToEdit(null);
          setSpoolPrefill(prefill || null);
          setIsSpoolModalOpen(true);
        }}
        onOpenQr={() => {
          setAppAndQrTab('qr');
          setIsAppAndQrOpen(true);
        }}
        onSyncCloud={() => syncWithCloud(true)}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onRestoreDefaultSpools={handleRestoreDefault21}
        versionProfiles={versionProfiles}
        activeVersionId={activeVersionId}
        onSelectVersion={handleSelectVersion}
        onCreateVersionProfile={handleCreateVersionProfile}
        onOpenCamera={() => {
          setIsSidebarOpen(false);
          setIsCameraModalOpen(true);
        }}
        onOpenPWAInstall={() => {
          setIsSidebarOpen(false);
          setAppAndQrTab('app');
          setIsAppAndQrOpen(true);
        }}
        themeBrightness={themeBrightness}
        themeAccent={themeAccent}
        onSetBrightness={setThemeBrightness}
        onSetAccent={setThemeAccent}
        appSettings={appSettings}
        onUpdateMaterialPreset={handleUpdateMaterialPreset}
        onResetMaterialPreset={handleResetMaterialPreset}
        onUpdateBrandPreset={handleUpdateBrandPreset}
        onResetBrandPreset={handleResetBrandPreset}
        onUpdateEibosBagTara={handleUpdateEibosBagTara}
        onUpdateCardSize={handleUpdateCardSize}
        onResetAllSettings={handleResetAllSettings}
        cloudDbUrl={cloudDbUrl}
        syncStatus={syncStatus}
      />

      {/* Hauptbereich */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-5 pb-24 space-y-4 sm:space-y-5">
        {deviceMode === 'app' ? (
          /* ============================================================== */
          /* SMARTPHONE APP-MODUS: MOBILE-FOKUSSIERT & TOUCH-OPTIMIERT     */
          /* ============================================================== */
          <div className="max-w-md mx-auto w-full space-y-3 pb-20">
            {/* 4 GROSSE SCHNELL-AKTIONEN */}
            <section
              className="rounded-2xl border p-3.5 shadow-sm space-y-2.5 transition-colors"
              style={{
                backgroundColor: 'var(--app-card)',
                borderColor: 'var(--app-border)',
                color: 'var(--app-text)'
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-sm">
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-xs" style={{ color: 'var(--app-text)' }}>
                      Schnell-Aktionen
                    </h2>
                    <p className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                      Foto, NFC, Eintragen & Abziehen
                    </p>
                  </div>
                </div>

                <div
                  className="px-2 py-0.5 rounded-lg border text-[10px] font-mono-num font-bold"
                  style={{
                    backgroundColor: 'var(--app-card-sub)',
                    borderColor: 'var(--app-border)',
                    color: 'var(--app-text)'
                  }}
                >
                  {spools.length} Spulen • {totalGrams.toLocaleString('de-DE')}g
                </div>
              </div>

              {/* 4 Touch-Buttons */}
              <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                {/* 1. FOTO-SCAN */}
                <button
                  onClick={() => setIsCameraModalOpen(true)}
                  className="p-2 rounded-xl border transition cursor-pointer flex flex-col items-center justify-center gap-1 text-center active:scale-95 shadow-sm"
                  style={{
                    backgroundColor: 'var(--app-card-sub)',
                    borderColor: 'var(--app-border)'
                  }}
                >
                  <div className="w-8 h-8 rounded-lg bg-orange-500/15 text-orange-400 flex items-center justify-center">
                    <Camera className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-[10px] block" style={{ color: 'var(--app-text)' }}>Foto</span>
                </button>

                {/* 2. NFC-TAG */}
                <button
                  onClick={() => {
                    setNfcSpoolId(undefined);
                    setNfcModalMode('read');
                    setIsNfcModalOpen(true);
                  }}
                  className="p-2 rounded-xl border transition cursor-pointer flex flex-col items-center justify-center gap-1 text-center active:scale-95 shadow-sm"
                  style={{
                    backgroundColor: 'var(--app-card-sub)',
                    borderColor: 'var(--app-border)'
                  }}
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                    <Tag className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-[10px] block" style={{ color: 'var(--app-text)' }}>NFC</span>
                </button>

                {/* 3. SPULE EINTRAGEN */}
                <button
                  onClick={() => {
                    setSpoolToEdit(null);
                    setSpoolPrefill(null);
                    setIsSpoolModalOpen(true);
                  }}
                  className="p-2 rounded-xl border transition cursor-pointer flex flex-col items-center justify-center gap-1 text-center active:scale-95 shadow-sm"
                  style={{
                    backgroundColor: 'var(--app-card-sub)',
                    borderColor: 'var(--app-border)'
                  }}
                >
                  <div className="w-8 h-8 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-[10px] block" style={{ color: 'var(--app-text)' }}>Eintragen</span>
                </button>

                {/* 4. SCHNELLABZUG */}
                <button
                  onClick={() => setIsQuickDeductOpen(true)}
                  className="p-2 rounded-xl border transition cursor-pointer flex flex-col items-center justify-center gap-1 text-center active:scale-95 shadow-sm"
                  style={{
                    backgroundColor: 'var(--app-card-sub)',
                    borderColor: 'var(--app-border)'
                  }}
                >
                  <div className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center">
                    <Minus className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-[10px] block" style={{ color: 'var(--app-text)' }}>Abzug</span>
                </button>
              </div>
            </section>

            {/* Bambu Lab X2D Live-Dashboard im Smartphone-Modus */}
            <BambuPrinterWidget
              spools={spools}
              viewMode={viewMode}
              onDeductWeight={handleDeductWeight}
              onApplyDryingCredit={handleApplyDryingCredit}
              onOpenNewSpool={() => {
                setSpoolToEdit(null);
                setSpoolPrefill(null);
                setIsSpoolModalOpen(true);
              }}
            />

            {/* KOMPAKTE SUCHE & MATERIAL CHIPS */}
            <section
              className="rounded-2xl border p-2.5 space-y-2 transition-colors"
              style={{
                backgroundColor: 'var(--app-card)',
                borderColor: 'var(--app-border)'
              }}
            >
              <input
                type="text"
                placeholder="🔍 Spule suchen..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border text-xs outline-none"
                style={{
                  backgroundColor: 'var(--app-input-bg)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              />

              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {['ALL', 'PLA', 'PETG', 'TPU', 'ABS', 'ASA'].map(mat => (
                  <button
                    key={mat}
                    onClick={() => setActiveMaterialFilter(mat)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap transition cursor-pointer"
                    style={{
                      backgroundColor: activeMaterialFilter === mat ? 'var(--app-accent)' : 'var(--app-card-sub)',
                      borderColor: activeMaterialFilter === mat ? 'var(--app-accent)' : 'var(--app-border)',
                      color: activeMaterialFilter === mat ? '#ffffff' : 'var(--app-text-muted)'
                    }}
                  >
                    {mat === 'ALL' ? 'Alle' : mat}
                  </button>
                ))}
              </div>
            </section>

            {/* SPULE-KARTEN FÜR SMARTPHONE MIT 1-KLICK ABZUG */}
            <div className="space-y-2.5">
              {filteredSpools.length === 0 ? (
                <div
                  className="rounded-2xl border p-6 text-center text-xs"
                  style={{
                    backgroundColor: 'var(--app-card)',
                    borderColor: 'var(--app-border)',
                    color: 'var(--app-text-muted)'
                  }}
                >
                  Keine Spulen gefunden.
                </div>
              ) : (
                filteredSpools.map(spool => {
                  const maxW = spool.initialWeight || 1000;
                  const pct = Math.max(0, Math.min(100, Math.round((spool.remainingWeight / maxW) * 100)));
                  return (
                    <div
                      key={spool.id}
                      className="rounded-2xl border p-3 space-y-2 transition-colors shadow-sm"
                      style={{
                        backgroundColor: 'var(--app-card)',
                        borderColor: 'var(--app-border)',
                        color: 'var(--app-text)'
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-4 h-4 rounded-full shrink-0 border border-black/20 shadow-xs"
                            style={{ backgroundColor: spool.colorHex }}
                          />
                          <div className="min-w-0">
                            <span className="font-extrabold text-xs block truncate" style={{ color: 'var(--app-text)' }}>
                              {spool.brand} {spool.name}
                            </span>
                            <span className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                              {spool.material} • {spool.colorName}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono-num font-extrabold text-xs block" style={{ color: 'var(--app-text)' }}>
                            {spool.remainingWeight} g
                          </span>
                          <span className="text-[10px] font-mono-num" style={{ color: 'var(--app-text-muted)' }}>
                            {pct}% Rest
                          </span>
                        </div>
                      </div>

                      {/* Fortschrittsbalken */}
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--app-card-sub)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: pct < 15 ? '#f43f5e' : pct < 35 ? '#f59e0b' : 'var(--app-accent)'
                          }}
                        />
                      </div>

                      {/* 1-Klick Schnellabzug & Hinzufügen Buttons */}
                      <div className="pt-1 border-t space-y-1.5" style={{ borderColor: 'var(--app-border)' }}>
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[10px] font-bold text-rose-400">−</span>
                            {[10, 25, 50, 100].map(grams => (
                              <button
                                key={grams}
                                onClick={() => handleDeductWeight(spool.id, grams)}
                                className="px-1.5 py-0.5 rounded-lg border text-[10px] font-mono-num font-bold transition cursor-pointer active:scale-95 text-rose-300 bg-rose-500/10 border-rose-500/30"
                              >
                                -{grams}g
                              </button>
                            ))}
                            <span className="text-[10px] font-bold text-emerald-400 ml-1">+</span>
                            {[10, 25, 50].map(grams => (
                              <button
                                key={grams}
                                onClick={() => handleAddWeight(spool.id, grams)}
                                className="px-1.5 py-0.5 rounded-lg border text-[10px] font-mono-num font-bold transition cursor-pointer active:scale-95 text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
                              >
                                +{grams}g
                              </button>
                            ))}
                          </div>

                          {/* Farblich differenzierte Aktionen */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleOpenSpoolNfc(spool.id)}
                              className={`p-1.5 rounded-lg border text-[10px] transition cursor-pointer shadow-xs ${
                                spool.nfcWritten
                                  ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/35 hover:bg-emerald-500/25'
                                  : 'text-rose-400 bg-rose-500/15 border-rose-500/35 hover:bg-rose-500/25'
                              }`}
                              title={spool.nfcWritten ? 'NFC: Beschrieben (Klicken für Details/Löschen)' : 'NFC: Unbeschrieben (Klicken zum Beschreiben)'}
                            >
                              <Tag className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setSpoolToEdit(spool);
                                setSpoolPrefill(null);
                                setIsSpoolModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg border text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-[10px] transition cursor-pointer shadow-xs"
                              title="Spule bearbeiten"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSpool(spool.id)}
                              className="p-1.5 rounded-lg border text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-[10px] transition cursor-pointer shadow-xs"
                              title="Spule löschen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* ============================================================== */
          /* DESKTOP-MODUS: VOLLE WERKSTATT-DASHBOARD VERSION               */
          /* ============================================================== */
          <>
            {/* Volle KPI-Kacheln */}
            <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div
                className="rounded-2xl border p-3.5 transition-colors shadow-sm"
                style={{
                  backgroundColor: 'var(--app-card)',
                  borderColor: 'var(--app-border)'
                }}
              >
                <span className="text-[11px] font-semibold" style={{ color: 'var(--app-text-muted)' }}>
                  Spulen im Bestand
                </span>
                <div className="text-xl sm:text-2xl font-extrabold font-mono-num mt-0.5">
                  {spools.length}
                </div>
              </div>
              <div
                className="rounded-2xl border p-3.5 transition-colors shadow-sm"
                style={{
                  backgroundColor: 'var(--app-card)',
                  borderColor: 'var(--app-border)'
                }}
              >
                <span className="text-[11px] font-semibold" style={{ color: 'var(--app-text-muted)' }}>
                  Netto-Filament
                </span>
                <div className="text-xl sm:text-2xl font-extrabold text-emerald-500 font-mono-num mt-0.5">
                  {totalGrams.toLocaleString('de-DE')} g
                </div>
              </div>
              <div
                className="rounded-2xl border p-3.5 transition-colors shadow-sm"
                style={{
                  backgroundColor: 'var(--app-card)',
                  borderColor: 'var(--app-border)'
                }}
              >
                <span className="text-[11px] font-semibold" style={{ color: 'var(--app-text-muted)' }}>
                  Bestandswert (ca.)
                </span>
                <div className="text-xl sm:text-2xl font-extrabold text-sky-500 font-mono-num mt-0.5">
                  {totalValue.toFixed(2).replace('.', ',')} €
                </div>
              </div>
              <div
                className="rounded-2xl border p-3.5 transition-colors shadow-sm"
                style={{
                  backgroundColor: 'var(--app-card)',
                  borderColor: 'var(--app-border)'
                }}
              >
                <span className="text-[11px] font-semibold" style={{ color: 'var(--app-text-muted)' }}>
                  Trocknung fällig
                </span>
                <div className="text-xl sm:text-2xl font-extrabold text-rose-500 font-mono-num mt-0.5">
                  {dueDryingCount}
                </div>
              </div>
              <div
                onClick={() => {
                  setEditUsedInputValue(String(totalUsedGrams));
                  setIsEditUsedModalOpen(true);
                }}
                className="col-span-2 lg:col-span-1 rounded-2xl border p-3.5 transition-all shadow-sm cursor-pointer hover:border-orange-500 hover:scale-[1.02] group relative"
                style={{
                  backgroundColor: 'var(--app-card)',
                  borderColor: 'var(--app-border)'
                }}
                title="Klicken zum Überschreiben des verdruckten Filaments (z.B. auf 0 g setzen)"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--app-text-muted)' }}>
                    Verdruckt (Verlauf)
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 font-bold border border-orange-500/30 group-hover:bg-orange-500 group-hover:text-white transition flex items-center gap-1">
                    <Edit3 className="w-2.5 h-2.5" />
                    <span>Ändern</span>
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-extrabold text-orange-500 font-mono-num mt-0.5">
                  {totalUsedGrams.toLocaleString('de-DE')} g
                </div>
              </div>
            </section>

            {/* Bambu Lab Live-Drucker-Monitor */}
            <BambuPrinterWidget
              spools={spools}
              viewMode={viewMode}
              onDeductWeight={handleDeductWeight}
              onApplyDryingCredit={handleApplyDryingCredit}
              onOpenNewSpool={() => {
                setSpoolToEdit(null);
                setSpoolPrefill(null);
                setIsSpoolModalOpen(true);
              }}
            />

            {/* Schnell-Erfassung per Kamera & Link (nur in vollständiger Ansicht) */}
            {viewMode === 'full' && (
              <section
                className="rounded-2xl border p-4 shadow-sm"
                style={{
                  backgroundColor: 'var(--app-card)',
                  borderColor: 'var(--app-border)'
                }}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-500">
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>Spulen-Schnellerfassung per Foto oder Shop-Link</span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                      Aufkleber fotografieren oder Link/Name eingeben – die KI erkennt Marke, Material, Farbe & Tara vor dem Speichern!
                    </p>
                  </div>
                  <div className="flex-1 max-w-xl flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => setIsCameraModalOpen(true)}
                      className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold whitespace-nowrap transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Foto aufnehmen</span>
                    </button>
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        placeholder="Oder Link / Name (z.B. SUNLU PETG Weiß)..."
                        value={quickLinkText}
                        onChange={e => setQuickLinkText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleQuickScan();
                        }}
                        className="flex-1 px-3 py-2 rounded-xl border text-xs outline-none focus:border-orange-500"
                        style={{
                          backgroundColor: 'var(--app-input-bg)',
                          borderColor: 'var(--app-border)',
                          color: 'var(--app-text)'
                        }}
                      />
                      <button
                        onClick={handleQuickScan}
                        disabled={isQuickScanning}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer border"
                        style={{
                          backgroundColor: 'var(--app-card-sub)',
                          borderColor: 'var(--app-border)',
                          color: 'var(--app-text)'
                        }}
                      >
                        Auslesen
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* V1.53: Modernisierter, harmonischer Filter- & Such-Kommandobereich */}
            <section
              className="rounded-2xl border p-3.5 sm:p-4 space-y-3 shadow-sm backdrop-blur-md transition-colors"
              style={{
                backgroundColor: 'var(--app-card)',
                borderColor: 'var(--app-border)'
              }}
            >
              {/* Zeile 1: Suchfeld mit Lupe/Clear & Sortier-Dropdown */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                {/* Modernes Suchfeld mit Lupe und Schnell-Reset-Kreuz */}
                <div className="relative flex-1 max-w-md">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{ color: 'var(--app-text-muted)' }}>
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Suche Marke, Farbe, Material, Lagerort..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 rounded-xl border text-xs outline-none transition focus:ring-2 focus:ring-orange-500/25 focus:border-orange-500"
                    style={{
                      backgroundColor: 'var(--app-input-bg)',
                      borderColor: 'var(--app-border)',
                      color: 'var(--app-text)'
                    }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-xs opacity-60 hover:opacity-100 cursor-pointer"
                      style={{ color: 'var(--app-text-muted)' }}
                      title="Suche leeren"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Sortierung & optionaler Reset-Button */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative flex items-center">
                    <span className="absolute left-2.5 pointer-events-none text-orange-400">
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </span>
                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value)}
                      className="pl-8 pr-7 py-2 rounded-xl border text-xs font-semibold outline-none cursor-pointer appearance-none transition focus:ring-2 focus:ring-orange-500/25 focus:border-orange-500 shadow-sm"
                      style={{
                        backgroundColor: 'var(--app-input-bg)',
                        borderColor: 'var(--app-border)',
                        color: 'var(--app-text)'
                      }}
                    >
                      <option value="drying_urgent">🔥 Trocknung (dringend zuerst)</option>
                      <option value="drying_fresh">✨ Frisch getrocknet zuerst</option>
                      <option value="remaining_asc">⚖️ Restgewicht (wenig zuerst)</option>
                      <option value="remaining_desc">⚖️ Restgewicht (viel zuerst)</option>
                      <option value="price_asc">💶 Preis €/kg (günstigste zuerst)</option>
                      <option value="brand_asc">🏷️ Hersteller (A–Z)</option>
                      <option value="material_asc">🧪 Material (A–Z)</option>
                      <option value="color_asc">🎨 Farbe (A–Z)</option>
                    </select>
                    <span className="absolute right-2.5 pointer-events-none text-[10px] opacity-50" style={{ color: 'var(--app-text)' }}>
                      ▼
                    </span>
                  </div>

                  {/* Filter zurücksetzen Button bei aktivem Filter */}
                  {(searchQuery || activeMaterialFilter !== 'ALL') && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setActiveMaterialFilter('ALL');
                      }}
                      className="px-2.5 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                      title="Alle Such- und Materialfilter zurücksetzen"
                    >
                      <X className="w-3 h-3" />
                      <span className="hidden sm:inline">Reset</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Zeile 2: Material-Filterleiste mit Zählern & sanfter Scrollleiste */}
              <div
                className="pt-2 border-t flex items-center gap-2 overflow-x-auto pb-0.5"
                style={{ borderColor: 'var(--app-border)' }}
              >
                <div className="flex items-center gap-1.5 shrink-0 pr-1 text-xs font-bold" style={{ color: 'var(--app-text-muted)' }}>
                  <Tag className="w-3.5 h-3.5 text-orange-400" />
                  <span className="hidden sm:inline">Material:</span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                  {(
                    [
                      'ALL',
                      'PLA',
                      'PLA+',
                      'PETG',
                      'TPU',
                      'ABS',
                      'ASA',
                      'PA / Nylon',
                      'PC',
                      'PET-CF / PA-CF'
                    ] as const
                  ).map(mat => {
                    const isActive = activeMaterialFilter === mat;
                    const count = mat === 'ALL'
                      ? spools.length
                      : spools.filter(s => s.material === mat).length;

                    return (
                      <button
                        key={mat}
                        onClick={() => setActiveMaterialFilter(mat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 shadow-sm ${
                          isActive
                            ? 'font-bold shadow-orange-500/20'
                            : 'hover:border-orange-500/40 opacity-80 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: isActive ? 'var(--app-accent)' : 'var(--app-card-sub)',
                          borderColor: isActive ? 'var(--app-accent)' : 'var(--app-border)',
                          color: isActive ? '#ffffff' : 'var(--app-text)'
                        }}
                      >
                        <span>{mat === 'ALL' ? 'Alle' : mat}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                            isActive
                              ? 'bg-black/25 text-white'
                              : 'bg-black/10 dark:bg-white/10'
                          }`}
                          style={{ color: isActive ? '#ffffff' : 'var(--app-text-muted)' }}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Spulen-Bereich: Übersichtlicher Header mit Spulen-Anzahl (Kachelgröße exklusiv in den Einstellungen) */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm sm:text-base tracking-tight" style={{ color: 'var(--app-text)' }}>
                        Filament-Spulen
                      </h3>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-orange-500/30 text-orange-400 bg-orange-500/10">
                        {filteredSpools.length} {filteredSpools.length === 1 ? 'Spule' : 'Spulen'}
                      </span>
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                      Eibos- & Vakuumlager mit Frische- & Trocknungsampel
                    </p>
                  </div>
                </div>
              </div>

              {/* Spulen-Raster mit flexibler Kachelgröße */}
              <section
                className="gap-4"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(auto-fill, minmax(${appSettings.cardSize || 340}px, 1fr))`
                }}
              >
              {filteredSpools.length === 0 ? (
                <div
                  className="col-span-full rounded-2xl border p-8 text-center text-xs"
                  style={{
                    backgroundColor: 'var(--app-card)',
                    borderColor: 'var(--app-border)',
                    color: 'var(--app-text-muted)'
                  }}
                >
                  Keine passenden Spulen gefunden.
                </div>
              ) : (
                filteredSpools.map(spool => (
                  <SpoolCard
                    key={spool.id}
                    spool={spool}
                    viewMode={viewMode}
                    now={now}
                    onDeduct={handleDeductWeight}
                    onApplyScale={handleApplyScale}
                    onMarkDried={handleMarkDried}
                    onDuplicate={handleDuplicateSpool}
                    onEdit={id => {
                      const s = spools.find(x => x.id === id);
                      if (s) {
                        setSpoolToEdit(s);
                        setSpoolPrefill(null);
                        setIsSpoolModalOpen(true);
                      }
                    }}
                    onDelete={handleDeleteSpool}
                    onWriteNfc={handleOpenSpoolNfc}
                    appSettings={appSettings}
                  />
                ))
              )}
            </section>
          </div>
          </>
        )}
      </main>

      {/* Spool Modal */}
      <SpoolModal
        isOpen={isSpoolModalOpen}
        onClose={() => {
          setIsSpoolModalOpen(false);
          setSpoolToEdit(null);
          setSpoolPrefill(null);
        }}
        onSave={handleSaveSpool}
        spoolToEdit={spoolToEdit}
        prefillData={spoolPrefill}
        appSettings={appSettings}
      />

      {/* Smartphone Kamera-Modal */}
      <CameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onSpoolRecognized={handleSpoolRecognizedFromCamera}
      />

      {/* Kombiniertes Smartphone App- & QR-Code Modal */}
      <AppAndQrModal
        isOpen={isAppAndQrOpen}
        onClose={() => setIsAppAndQrOpen(false)}
        cloudDbUrl={cloudDbUrl}
        defaultTab={appAndQrTab}
      />

      {/* Druck-Verlauf Modal */}
      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        history={printHistory}
        onUndoEntry={handleUndoHistoryItem}
      />

      {/* NFC Tag Manager Modal (Lesen, Beschreiben, Erkennen) */}
      <NfcModal
        isOpen={isNfcModalOpen}
        onClose={() => setIsNfcModalOpen(false)}
        spools={spools}
        initialMode={nfcModalMode}
        preselectedSpoolId={nfcSpoolId}
        onDeductWeight={handleDeductWeight}
        onAddWeight={handleAddWeight}
        onMarkSpoolWritten={handleMarkSpoolNfcWritten}
        onResetAllNfcWritten={handleResetAllNfcWritten}
        onOpenNewSpoolWithPrefill={prefill => {
          setIsNfcModalOpen(false);
          setSpoolToEdit(null);
          setSpoolPrefill(prefill);
          setIsSpoolModalOpen(true);
        }}
        onSelectSpoolForEdit={spool => {
          setIsNfcModalOpen(false);
          setSpoolToEdit(spool);
          setSpoolPrefill(null);
          setIsSpoolModalOpen(true);
        }}
      />

      {/* Quick Deduct Modal */}
      <QuickDeductModal
        isOpen={isQuickDeductOpen}
        onClose={() => setIsQuickDeductOpen(false)}
        spools={spools}
        onDeductWeight={handleDeductWeight}
      />

      {/* MODAL: VERDRUCKTES FILAMENT MANUELL ANPASSEN ODER AUF 0 SETZEN */}
      {isEditUsedModalOpen && (
        <div
          onClick={() => setIsEditUsedModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-4"
            style={{
              backgroundColor: 'var(--app-card)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--app-border)' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm" style={{ color: 'var(--app-text)' }}>
                    Verdrucktes Filament anpassen
                  </h3>
                  <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                    Statistik überschreiben (z.B. auf 0 g nach Neueinrichtung)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditUsedModalOpen(false)}
                className="p-1.5 rounded-lg border text-slate-400 hover:text-white transition cursor-pointer"
                style={{ borderColor: 'var(--app-border)' }}
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold mb-1" style={{ color: 'var(--app-text-muted)' }}>
                  Aktueller Zählerstand (Gramm):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editUsedInputValue}
                    onChange={e => setEditUsedInputValue(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border font-mono text-sm font-bold outline-none"
                    style={{
                      backgroundColor: 'var(--app-input-bg)',
                      borderColor: 'var(--app-border)',
                      color: 'var(--app-text)'
                    }}
                    placeholder="0"
                  />
                  <span className="font-bold text-sm text-slate-400">g</span>
                </div>
              </div>

              {/* 1-Klick Schnellbuttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    handleSaveUsedGrams(0);
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-orange-500/15 border border-orange-500/40 text-orange-400 hover:bg-orange-500/25 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <span>✨ Sofort auf 0 g setzen</span>
                </button>
              </div>

              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                💾 Dieser Wert wird dauerhaft im Browser-Speicher und auf deinem Server / Raspberry Pi in <code className="text-orange-400">./data/filamenthub-storage.json</code> gesichert.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--app-border)' }}>
              <button
                type="button"
                onClick={() => setIsEditUsedModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl border text-xs font-semibold hover:bg-white/5 transition cursor-pointer"
                style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(editUsedInputValue);
                  handleSaveUsedGrams(isNaN(val) || val < 0 ? 0 : Math.round(val));
                }}
                className="px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition cursor-pointer shadow-md"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-16 sm:bottom-14 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className="px-4 py-2.5 rounded-xl border text-xs font-semibold shadow-2xl backdrop-blur-md transition-all"
            style={{
              backgroundColor: 'var(--app-card)',
              borderColor: 'var(--app-accent)',
              color: 'var(--app-text)'
            }}
          >
            {t.text}
          </div>
        ))}
      </div>



      {/* Feste Daumen-Leiste NUR im App-Modus - ergonomisch für Smartphone Daumenbedienung */}
      {deviceMode === 'app' && (
        <nav
          aria-label="Mobile Schnellzugriff"
          className="fixed bottom-0 left-0 right-0 z-40 border-t px-2 py-2 flex items-center justify-between gap-1 shadow-2xl backdrop-blur-md transition-colors"
          style={{
            backgroundColor: 'var(--app-card)',
            borderColor: 'var(--app-border)',
            color: 'var(--app-text)'
          }}
        >
          <button
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex-1 py-1.5 px-1 rounded-xl border font-bold text-[10px] flex flex-col items-center justify-center gap-0.5 active:scale-95 transition cursor-pointer"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            <Zap className="w-3.5 h-3.5 text-orange-400" />
            <span>Spulen</span>
          </button>

          <button
            onClick={() => setIsCameraModalOpen(true)}
            className="flex-1 py-1.5 px-1 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-[10px] flex flex-col items-center justify-center gap-0.5 shadow-md shadow-orange-500/20 active:scale-95 transition cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Foto</span>
          </button>

          <button
            onClick={() => {
              setNfcSpoolId(undefined);
              setNfcModalMode('read');
              setIsNfcModalOpen(true);
            }}
            className="flex-1 py-1.5 px-1 rounded-xl border font-bold text-[10px] flex flex-col items-center justify-center gap-0.5 active:scale-95 transition cursor-pointer"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            <Tag className="w-3.5 h-3.5 text-emerald-400" />
            <span>NFC</span>
          </button>

          <button
            onClick={() => setIsQuickDeductOpen(true)}
            className="flex-1 py-1.5 px-1 rounded-xl border font-bold text-[10px] flex flex-col items-center justify-center gap-0.5 active:scale-95 transition cursor-pointer"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            <Minus className="w-3.5 h-3.5 text-rose-400" />
            <span>Abzug</span>
          </button>

          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex-1 py-1.5 px-1 rounded-xl border font-bold text-[10px] flex flex-col items-center justify-center gap-0.5 active:scale-95 transition cursor-pointer"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text-muted)'
            }}
          >
            <span className="text-xs leading-none">☰</span>
            <span>Menü</span>
          </button>
        </nav>
      )}

      {/* Rechts angedockter Live-Log Streifen & Ausklapp-Drawer (ca. 1cm) */}
      <RightLogDrawer spools={spools} onDeductWeight={handleDeductWeight} />
    </div>
  );
}
