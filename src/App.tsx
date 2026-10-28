import { UpdateBanner } from './components/UpdateBanner';
import { isAppShell } from './utils/env';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { storageApi, cloudSync } from './api';

import {
  HistoryEntry,
  MaterialType,
  Spool,
  VersionProfile,
  ViewMode
} from './types/filament';

import { DEFAULT_21_SPOOLS, INITIAL_VERSION_PROFILES } from './data/defaultSpools';
import {
  getBrandInfo,
  getDryingStatus,
  parseFilamentText
} from './utils/shopLinks';
import { safeStorage } from './utils/safeStorage';
import { spoolIdFromHash } from './utils/spoolLink';
import { Navbar, DeviceMode } from './components/Navbar';
import { Sidebar } from './components/Sidebar';

import { SpoolModal } from './components/SpoolModal';
import { AppAndQrModal } from './components/AppAndQrModal';

import { HistoryModal } from './components/HistoryModal';
import { CameraModal } from './components/CameraModal';
import { NfcModal } from './components/NfcModal';
import { QuickDeductModal } from './components/QuickDeductModal';
import { RightLogDrawer } from './components/RightLogDrawer';
import { addSystemLog } from './utils/logService';
import { EditUsedModal } from './components/app/EditUsedModal';
import { MobileAppBar } from './components/app/MobileAppBar';
import { MobileAppView } from './components/app/MobileAppView';
import { DesktopDashboard } from './components/app/DesktopDashboard';
import {
  STORAGE_KEY_SPOOLS,
  STORAGE_KEY_HISTORY,
  STORAGE_KEY_PROFILES,
  STORAGE_KEY_ACTIVE_VER,
  STORAGE_KEY_VIEW,
  STORAGE_KEY_CLOUD_URL
} from './utils/storageKeys';
import { useThemeSettings } from './hooks/useThemeSettings';
import { useAppSettings } from './hooks/useAppSettings';
import { useDryingReminders } from './hooks/useDryingReminders';
import { LowStockBanner } from './components/workshop/LowStockBanner';
import { WorkshopModal, WorkshopTab } from './components/workshop/WorkshopModal';
import { getLocationStats } from './utils/spoolAlerts';
import { getWorkshopSettings } from './utils/workshopSettings';
import { localNotify } from './utils/notify';

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

  // 5 Helligkeitsstufen & Akzente (Standard: Soft). Alte Werte aus früheren Versionen werden einmalig auf Soft gesetzt.
  const { themeBrightness, themeAccent, setThemeBrightness, setThemeAccent } = useThemeSettings();

  // HTML Data-Attribute für Themes setzen

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
    const latestId = INITIAL_VERSION_PROFILES[INITIAL_VERSION_PROFILES.length - 1]?.id || 'v1.70';
    const seen = safeStorage.getItem('filamenthub_latest_seen_version');
    // Neue Version erschienen (oder nichts gespeichert): auf die neueste Revision stellen.
    // Danach bleibt die Auswahl aus dem Revisionsmenü erhalten.
    if (!saved || seen !== latestId || !versionProfiles.some(p => p.id === saved)) {
      safeStorage.setItem('filamenthub_latest_seen_version', latestId);
      safeStorage.setItem(STORAGE_KEY_ACTIVE_VER, latestId);
      return latestId;
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
    // App-Modus ist der Standard: immer in der Android-App, der installierten Web-App und auf dem Handy.
    // Nur auf großen Bildschirmen im Browser wird die zuletzt gewählte Ansicht beibehalten.
    if (isAppShell() || window.innerWidth < 768) return 'app';
    return (safeStorage.getItem('filamenthub_device_mode') as DeviceMode) || 'app';
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
  const [activeLocationFilter, setActiveLocationFilter] = useState<string>('ALL');
  const [isWorkshopOpen, setIsWorkshopOpen] = useState<boolean>(false);
  const [workshopTab, setWorkshopTab] = useState<WorkshopTab>('notices');
  const [labelSpoolId, setLabelSpoolId] = useState<string | null>(null);

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
    storageApi
      .getStats()
      .then(({ data }) => {
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

  // Erinnerung: Trocknen fällig, AMS-Trocknung fertig
  useDryingReminders({ spools, showToast });

  // Zentraler Einstellungs-Hub (Material-Trocknungszeiten, Hersteller-Tara, Eibos-Beutel)
  const { appSettings, handleUpdateMaterialPreset, handleResetMaterialPreset, handleUpdateBrandPreset, handleResetBrandPreset, handleUpdateEibosBagTara, handleUpdateCardSize, handleResetAllSettings } = useAppSettings({ showToast });

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
        const saved = await cloudSync.save(cloudDbUrl, {
          updatedAt: Date.now(),
          spools: newSpools,
          printHistory: newHistory
        });
        if (saved) {
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
        const cloud = await cloudSync.load(cloudDbUrl);
        if (cloud.ok) {
          const data = cloud.data;
          if (data && Array.isArray(data.spools) && data.spools.length > 0) {
            setSpools(data.spools as Spool[]);
            if (Array.isArray(data.printHistory)) setPrintHistory(data.printHistory as HistoryEntry[]);
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

  // NFC-Tag gehalten, während die App offen ist (kein Fenster scannt gerade): NFC-Fenster öffnen und Tag anzeigen
  useEffect(() => {
    const onIdleTag = () => {
      setNfcSpoolId(undefined);
      setNfcModalMode('read');
      setIsNfcModalOpen(true);
    };
    window.addEventListener('filamenthub:nfc-idle-tag', onIdleTag);
    return () => window.removeEventListener('filamenthub:nfc-idle-tag', onIdleTag);
  }, []);

  // QR-Etikett gescannt (#s=ID): Spule öffnen
  useEffect(() => {
    const openFromHash = () => {
      const id = spoolIdFromHash(window.location.hash);
      if (!id) return;
      const found = spools.find(sp => sp.id === id);
      if (found) {
        setSpoolToEdit(found);
        setIsSpoolModalOpen(true);
        window.history.replaceState({}, '', window.location.pathname + window.location.search);
      }
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, [spools]);

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
        setIsWorkshopOpen(false);
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
    const prevRemaining = spool.remainingWeight || 0;
    const newRemaining = Math.max(0, Math.min(maxWeight, prevRemaining + deltaGrams));
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
      // Rest-Warnung: Schwelle gerade unterschritten
      const ws = getWorkshopSettings();
      if (ws.lowWarning && ws.lowWeightG > 0 && prevRemaining > ws.lowWeightG && newRemaining <= ws.lowWeightG) {
        const warn = `${spool.brand} ${spool.name}: nur noch ${newRemaining} g übrig.`;
        showToast(`⚠️ Fast leer! ${warn}`);
        void localNotify('Spule fast leer', warn, { tag: 'low-' + spool.id });
        addSystemLog('spule', `Spule fast leer: ${spool.brand} ${spool.name}`, `${newRemaining} g übrig`, 'warn');
      }
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
      await storageApi.saveManualUsedGrams(val);
    } catch {}
    showToast(`Verdrucktes Filament auf ${val} g gesetzt.`);
    setIsEditUsedModalOpen(false);
  };

  // Gefilterte und sortierte Spulen
  const filteredSpools = useMemo(() => {
    // Mehrere Suchwörter: alle müssen vorkommen (z. B. "rot pla" oder "regal petg")
    const tokens = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    const result = spools.filter(s => {
      const matchesMat = activeMaterialFilter === 'ALL' || s.material === activeMaterialFilter;
      const matchesLoc = activeLocationFilter === 'ALL' || (s.location || '') === activeLocationFilter;
      const hay = `${s.brand} ${s.name} ${s.material} ${s.colorName || ''} ${s.storageNote || ''} ${s.location || ''}`.toLowerCase();
      const matchesSearch = tokens.every(t => hay.includes(t));
      return matchesMat && matchesLoc && matchesSearch;
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
  }, [spools, activeMaterialFilter, activeLocationFilter, searchQuery, sortBy, now]);

  const locationStats = useMemo(() => getLocationStats(spools), [spools]);

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
      {/* Hinweis auf neue App-Version (nur Android-App) */}
      <UpdateBanner />

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
        onOpenWorkshop={() => setIsWorkshopOpen(true)}
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
        {/* Rest-Warnung: fast leere Spulen */}
        <LowStockBanner
          spools={spools}
          onFocus={q => setSearchQuery(q)}
          onOpenSettings={() => {
            setWorkshopTab('notices');
            setIsWorkshopOpen(true);
          }}
        />
        {deviceMode === 'app' ? (
          /* ============================================================== */
          /* SMARTPHONE APP-MODUS: MOBILE-FOKUSSIERT & TOUCH-OPTIMIERT     */
          /* ============================================================== */
          <MobileAppView spools={spools} totalGrams={totalGrams} setIsCameraModalOpen={setIsCameraModalOpen} setNfcSpoolId={setNfcSpoolId} setNfcModalMode={setNfcModalMode} setIsNfcModalOpen={setIsNfcModalOpen} setSpoolToEdit={setSpoolToEdit} setSpoolPrefill={setSpoolPrefill} setIsSpoolModalOpen={setIsSpoolModalOpen} setIsQuickDeductOpen={setIsQuickDeductOpen} viewMode={viewMode} handleDeductWeight={handleDeductWeight} handleApplyDryingCredit={handleApplyDryingCredit} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setActiveMaterialFilter={setActiveMaterialFilter} activeMaterialFilter={activeMaterialFilter} filteredSpools={filteredSpools} handleAddWeight={handleAddWeight} handleOpenSpoolNfc={handleOpenSpoolNfc} handleDeleteSpool={handleDeleteSpool} locations={locationStats} activeLocationFilter={activeLocationFilter} setActiveLocationFilter={setActiveLocationFilter} />
        ) : (
          /* ============================================================== */
          /* DESKTOP-MODUS: VOLLE WERKSTATT-DASHBOARD VERSION               */
          /* ============================================================== */
          <DesktopDashboard spools={spools} totalGrams={totalGrams} totalValue={totalValue} dueDryingCount={dueDryingCount} setEditUsedInputValue={setEditUsedInputValue} totalUsedGrams={totalUsedGrams} setIsEditUsedModalOpen={setIsEditUsedModalOpen} viewMode={viewMode} handleDeductWeight={handleDeductWeight} handleApplyDryingCredit={handleApplyDryingCredit} setSpoolToEdit={setSpoolToEdit} setSpoolPrefill={setSpoolPrefill} setIsSpoolModalOpen={setIsSpoolModalOpen} setIsCameraModalOpen={setIsCameraModalOpen} quickLinkText={quickLinkText} setQuickLinkText={setQuickLinkText} handleQuickScan={handleQuickScan} isQuickScanning={isQuickScanning} searchQuery={searchQuery} setSearchQuery={setSearchQuery} sortBy={sortBy} setSortBy={setSortBy} activeMaterialFilter={activeMaterialFilter} setActiveMaterialFilter={setActiveMaterialFilter} filteredSpools={filteredSpools} appSettings={appSettings} now={now} handleApplyScale={handleApplyScale} handleMarkDried={handleMarkDried} handleDuplicateSpool={handleDuplicateSpool} handleDeleteSpool={handleDeleteSpool} handleOpenSpoolNfc={handleOpenSpoolNfc} locations={locationStats} activeLocationFilter={activeLocationFilter} setActiveLocationFilter={setActiveLocationFilter} />
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
        locationOptions={locationStats.map(l => l.name)}
        onPrintLabel={spool => {
          setIsSpoolModalOpen(false);
          setLabelSpoolId(spool.id);
          setWorkshopTab('labels');
          setIsWorkshopOpen(true);
        }}
      />

      {/* Werkstatt: Meldungen und Helfer */}
      <WorkshopModal
        isOpen={isWorkshopOpen}
        onClose={() => setIsWorkshopOpen(false)}
        tab={workshopTab}
        onTabChange={setWorkshopTab}
        spools={spools}
        labelSpoolId={labelSpoolId}
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
      {isEditUsedModalOpen && <EditUsedModal setIsEditUsedModalOpen={setIsEditUsedModalOpen} editUsedInputValue={editUsedInputValue} setEditUsedInputValue={setEditUsedInputValue} handleSaveUsedGrams={handleSaveUsedGrams} />}

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
      {deviceMode === 'app' && <MobileAppBar setIsCameraModalOpen={setIsCameraModalOpen} setNfcSpoolId={setNfcSpoolId} setNfcModalMode={setNfcModalMode} setIsNfcModalOpen={setIsNfcModalOpen} setIsQuickDeductOpen={setIsQuickDeductOpen} setIsSidebarOpen={setIsSidebarOpen} />}

      {/* Rechts angedockter Live-Log Streifen & Ausklapp-Drawer (ca. 1cm) */}
      <RightLogDrawer spools={spools} onDeductWeight={handleDeductWeight} />
    </div>
  );
}
