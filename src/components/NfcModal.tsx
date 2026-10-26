import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  Radio,
  CheckCircle2,
  AlertCircle,
  Tag,
  PenTool,
  Pencil,
  RotateCcw,
  Search,
  Check,
  Zap,
  Play,
  Pause,
  SkipForward,
  RotateCw,
  Sparkles,
  Volume2,
  Trash2,
  Plus,
  Minus
} from 'lucide-react';
import { Spool } from '../types/filament';
import {
  isWebNfcSupported,
  NfcPayload,
  parseNfcContent,
  writeSpoolToNfcTag,
  eraseNfcTag,
  mapTagToSpool,
  playNfcSuccessChime,
  playNfcDeleteSound,
  triggerNfcHaptic
} from '../utils/nfcManager';

interface NfcModalProps {
  isOpen: boolean;
  onClose: () => void;
  spools: Spool[];
  initialMode?: 'read' | 'write' | 'batch' | 'write-direct' | 'inspect';
  preselectedSpoolId?: string;
  onDeductWeight: (spoolId: string, grams: number) => void;
  onAddWeight?: (spoolId: string, grams: number) => void;
  onOpenNewSpoolWithPrefill?: (prefill: Partial<Spool>) => void;
  onSelectSpoolForEdit?: (spool: Spool) => void;
  onMarkSpoolWritten?: (spoolId: string, written: boolean) => void;
  onResetAllNfcWritten?: () => void;
}

export const NfcModal: React.FC<NfcModalProps> = ({
  isOpen,
  onClose,
  spools,
  initialMode = 'read',
  preselectedSpoolId,
  onDeductWeight,
  onAddWeight,
  onOpenNewSpoolWithPrefill,
  onSelectSpoolForEdit,
  onMarkSpoolWritten,
  onResetAllNfcWritten
}) => {
  const [activeTab, setActiveTab] = useState<'read' | 'write' | 'batch' | 'write-direct' | 'inspect'>(initialMode);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStatusMessage, setScanStatusMessage] = useState<string>('Warte auf NFC-Tag...');

  // Gescannte Daten (Lesen)
  const [detectedTagUid, setDetectedTagUid] = useState<string>('');
  const [unwrittenTagDetected, setUnwrittenTagDetected] = useState<boolean>(false);
  const [loadedSpool, setLoadedSpool] = useState<Spool | null>(null);
  const [loadedPayload, setLoadedPayload] = useState<NfcPayload | null>(null);

  // Einzel-Schreib-Modus
  const [selectedSpoolId, setSelectedSpoolId] = useState<string>(
    preselectedSpoolId || spools[0]?.id || ''
  );
  const [spoolSearchQuery, setSpoolSearchQuery] = useState<string>('');
  const [spoolMaterialFilter, setSpoolMaterialFilter] = useState<string>('ALL');

  const [isWriting, setIsWriting] = useState<boolean>(false);
  const [writeSuccessMessage, setWriteSuccessMessage] = useState<string>('');
  const [writeErrorMessage, setWriteErrorMessage] = useState<string>('');

  // BATCH-MODUS: "Alle Spulen nacheinander beschreiben"
  const [batchTargetSpoolId, setBatchTargetSpoolId] = useState<string>('');
  const [isBatchActive, setIsBatchActive] = useState<boolean>(true);
  const [isBatchWriting, setIsBatchWriting] = useState<boolean>(false);
  const [batchLastSuccessMessage, setBatchLastSuccessMessage] = useState<string>('');
  const [batchErrorMessage, setBatchErrorMessage] = useState<string>('');

  // Gewichts-Eingabe (Abziehen & Hinzufügen)
  const [adjustGramsInput, setAdjustGramsInput] = useState<string>('50');
  const [adjustFeedbackMessage, setAdjustFeedbackMessage] = useState<string>('');

  const abortControllerRef = useRef<AbortController | null>(null);
  const batchLoopRef = useRef<boolean>(false);
  const lastReadTimeRef = useRef<number>(0);
  const prevIsOpenRef = useRef<boolean>(false);

  // Zähler für Fortschritt
  const writtenCount = useMemo(() => spools.filter(s => s.nfcWritten).length, [spools]);
  const totalCount = spools.length;
  const progressPct = totalCount > 0 ? Math.round((writtenCount / totalCount) * 100) : 0;
  const allCompleted = totalCount > 0 && writtenCount === totalCount;

  // Ermitteln der aktuellen Zielspule im Batch-Modus
  const currentBatchSpool = useMemo(() => {
    if (batchTargetSpoolId) {
      const found = spools.find(s => s.id === batchTargetSpoolId);
      if (found) return found;
    }
    // Nächste unbeschriebene Spule finden
    const nextUnwritten = spools.find(s => !s.nfcWritten);
    return nextUnwritten || spools[0];
  }, [batchTargetSpoolId, spools]);

  useEffect(() => {
    if (!isOpen) {
      prevIsOpenRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      batchLoopRef.current = false;
      setIsScanning(false);
      setIsBatchWriting(false);
      setUnwrittenTagDetected(false);
      setLoadedSpool(null);
      setLoadedPayload(null);
      setWriteSuccessMessage('');
      setWriteErrorMessage('');
      setBatchLastSuccessMessage('');
      setBatchErrorMessage('');
      setSpoolSearchQuery('');
      setSpoolMaterialFilter('ALL');
      return;
    }

    // Nur beim erstmaligen Öffnen oder expliziter Modus-Änderung ausführen, um Oszillation zu verhindern
    const isFirstOpen = !prevIsOpenRef.current;
    prevIsOpenRef.current = true;

    if (isFirstOpen || initialMode) {
      if (preselectedSpoolId) {
        setSelectedSpoolId(preselectedSpoolId);
        setBatchTargetSpoolId(preselectedSpoolId);
        const sp = spools.find(s => s.id === preselectedSpoolId);
        if (initialMode === 'write-direct' || initialMode === 'inspect') {
          setActiveTab(initialMode);
        } else if (sp?.nfcWritten) {
          setActiveTab('inspect');
        } else {
          setActiveTab('write-direct');
        }
      } else {
        setActiveTab(initialMode || 'read');
      }

      if (initialMode === 'read' || (!preselectedSpoolId && isFirstOpen)) {
        startNfcScan();
      }
    }
  }, [isOpen, initialMode, preselectedSpoolId]);

  // Gefilterte Spulenliste für die Einzel-Auswahl
  const filteredSpools = useMemo(() => {
    return spools.filter(s => {
      const matchesSearch =
        !spoolSearchQuery.trim() ||
        `${s.brand} ${s.name} ${s.material} ${s.colorName}`.toLowerCase().includes(spoolSearchQuery.toLowerCase());
      const matchesMat =
        spoolMaterialFilter === 'ALL' ||
        s.material.toUpperCase().includes(spoolMaterialFilter.toUpperCase());
      return matchesSearch && matchesMat;
    });
  }, [spools, spoolSearchQuery, spoolMaterialFilter]);

  // Zielspule und stets synchrone Spule aus dem Hauptbestand verwenden (Echtzeit-Aktualisierung bei Abzug / Hinzufügen)
  const targetSpool = useMemo(() => {
    return spools.find(s => s.id === selectedSpoolId) || spools[0];
  }, [spools, selectedSpoolId]);

  const activeLoadedSpool = useMemo(() => {
    if (!loadedSpool) return null;
    return spools.find(s => s.id === loadedSpool.id) || loadedSpool;
  }, [loadedSpool, spools]);

  const activeTargetSpool = useMemo(() => {
    if (!targetSpool) return null;
    return spools.find(s => s.id === targetSpool.id) || targetSpool;
  }, [targetSpool, spools]);

  // =========================================================================
  // NFC LESEN
  // =========================================================================
  const startNfcScan = async () => {
    setUnwrittenTagDetected(false);
    setLoadedSpool(null);
    setLoadedPayload(null);
    setDetectedTagUid('');
    setWriteSuccessMessage('');
    setWriteErrorMessage('');

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    if (!isWebNfcSupported()) {
      setIsScanning(true);
      setScanStatusMessage(
        'Web NFC wird in diesem Browser nicht direkt unterstützt (nutze Chrome / Samsung Internet auf Android oder teste mit den Buttons unten).'
      );
      return;
    }

    try {
      setIsScanning(true);
      setScanStatusMessage('Halte einen NFC-Tag oder eine Spule an die Rückseite deines Smartphones...');
      const NDEFReaderClass = (window as any).NDEFReader;
      const ndef = new NDEFReaderClass();

      await ndef.scan({ signal: abortCtrl.signal });

      ndef.onreading = (event: any) => {
        const now = Date.now();
        if (now - lastReadTimeRef.current < 1200) {
          return; // Verhindert Oszillation & Mehrfach-Auslösung beim Halten an die Antenne
        }
        lastReadTimeRef.current = now;

        const serialNumber = event.serialNumber || 'NTAG-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        setDetectedTagUid(serialNumber);

        let textContent = '';
        if (event.message && event.message.records) {
          for (const record of event.message.records) {
            if (record.recordType === 'text') {
              const textDecoder = new TextDecoder(record.encoding || 'utf-8');
              textContent = textDecoder.decode(record.data);
              break;
            }
          }
        }

        const result = parseNfcContent(textContent, serialNumber, spools);

        if (result.hasFilamentData && (result.matchedSpool || result.payload)) {
          setUnwrittenTagDetected(false);
          if (result.matchedSpool) {
            setLoadedSpool(result.matchedSpool);
            // Als beschrieben markieren falls noch nicht geschehen
            onMarkSpoolWritten?.(result.matchedSpool.id, true);
          } else if (result.payload) {
            const fallbackSpool: Spool = {
              id: result.payload.spoolId || 'nfc-' + Date.now(),
              brand: result.payload.brand,
              material: (result.payload.material as any) || 'PLA',
              name: result.payload.name,
              colorName: result.payload.colorName || 'Standard',
              colorHex: result.payload.colorHex || '#f97316',
              initialWeight: result.payload.initialWeight || 1000,
              remainingWeight: result.payload.remainingWeight || 1000,
              emptySpoolWeight: result.payload.emptySpoolWeight || 200,
              pricePerKg: result.payload.pricePerKg || 19.99,
              lastDried: new Date().toISOString(),
              dryIntervalDays: 30,
              dryTemp: 50,
              dryHours: 6,
              nfcWritten: true
            };
            setLoadedSpool(fallbackSpool);
          }
          setLoadedPayload(result.payload || null);
          setScanStatusMessage('Spule erfolgreich geladen!');
          playNfcSuccessChime();
          triggerNfcHaptic();
        } else {
          setUnwrittenTagDetected(true);
          setLoadedSpool(null);
          setLoadedPayload(null);
          setScanStatusMessage('Unbeschriebener NFC-Tag erkannt.');
        }
      };

      ndef.onreadingerror = () => {
        setScanStatusMessage('Fehler beim Lesen des NFC-Tags. Bitte halte den Tag näher ans Smartphone.');
      };
    } catch (err: any) {
      setIsScanning(false);
      setScanStatusMessage(`NFC-Scanner konnte nicht gestartet werden: ${err.message || String(err)}`);
    }
  };

  const handleSimulateUnwrittenTag = () => {
    const fakeUid = '04:A1:88:2E:7C';
    setDetectedTagUid(fakeUid);
    setUnwrittenTagDetected(true);
    setLoadedSpool(null);
    setLoadedPayload(null);
    setScanStatusMessage('Simulation: Unbeschriebener Tag erkannt');
  };

  const handleSimulateLoadedTag = () => {
    const target = spools[0] || null;
    if (!target) return;
    const fakeUid = '04:B2:91:8C:3F';
    setDetectedTagUid(fakeUid);
    setUnwrittenTagDetected(false);
    setLoadedSpool(target);
    mapTagToSpool(fakeUid, target.id);
    onMarkSpoolWritten?.(target.id, true);
    playNfcSuccessChime();
    triggerNfcHaptic();
    setScanStatusMessage(`NFC-Tag erkannt: ${target.brand} ${target.name}`);
  };

  // =========================================================================
  // EINZEL-SPULE SCHREIBEN
  // =========================================================================
  const handleWriteSpoolToCurrentTag = async (spoolToSave: Spool) => {
    setIsWriting(true);
    setWriteSuccessMessage('');
    setWriteErrorMessage('');

    try {
      const res = await writeSpoolToNfcTag(spoolToSave);
      if (detectedTagUid) {
        mapTagToSpool(detectedTagUid, spoolToSave.id);
      }
      playNfcSuccessChime();
      triggerNfcHaptic();
      onMarkSpoolWritten?.(spoolToSave.id, true);
      setWriteSuccessMessage(`Erfolgreich! NFC-Tag wurde mit „${spoolToSave.brand} ${spoolToSave.name}“ beschrieben.`);
      setUnwrittenTagDetected(false);
      setLoadedSpool(spoolToSave);
    } catch (e: any) {
      setWriteErrorMessage(`Fehler beim Beschreiben: ${e.message || String(e)}`);
    } finally {
      setIsWriting(false);
    }
  };

  const handleManualWriteSubmit = async () => {
    const spool = spools.find(s => s.id === selectedSpoolId);
    if (!spool) return;

    setIsWriting(true);
    setWriteSuccessMessage('');
    setWriteErrorMessage('');

    try {
      const res = await writeSpoolToNfcTag(spool);
      if (res.success) {
        playNfcSuccessChime();
        triggerNfcHaptic();
        onMarkSpoolWritten?.(spool.id, true);
        setWriteSuccessMessage(`Erfolgreich! „${spool.brand} ${spool.name}“ auf NFC-Tag geschrieben.`);
      } else {
        setWriteErrorMessage(res.message);
      }
    } catch (e: any) {
      setWriteErrorMessage(e.message || 'Schreiben abgebrochen.');
    } finally {
      setIsWriting(false);
    }
  };

  // =========================================================================
  // NFC-TAG LÖSCHEN & FORMATIEREN
  // =========================================================================
  const handleDeleteTargetSpoolTag = async () => {
    if (!targetSpool) return;
    setIsWriting(true);
    setWriteSuccessMessage('');
    setWriteErrorMessage('');
    try {
      const res = await eraseNfcTag(detectedTagUid);
      if (res.success) {
        onMarkSpoolWritten?.(targetSpool.id, false);
        setWriteSuccessMessage(`✓ NFC-Tag für „${targetSpool.brand} ${targetSpool.name}“ erfolgreich gelöscht! Status ist nun wieder unbeschrieben (rot).`);
      } else {
        setWriteErrorMessage(res.message);
      }
    } catch (err: any) {
      setWriteErrorMessage(`Fehler beim Löschen des Tags: ${err.message || String(err)}`);
    } finally {
      setIsWriting(false);
    }
  };

  const handleDeleteLoadedTag = async () => {
    if (!loadedSpool) return;
    setIsWriting(true);
    try {
      const spoolId = loadedSpool.id;
      const spoolName = `${loadedSpool.brand} ${loadedSpool.name}`;
      const res = await eraseNfcTag(detectedTagUid);
      if (res.success) {
        onMarkSpoolWritten?.(spoolId, false);
        setLoadedSpool(null);
        setLoadedPayload(null);
        setUnwrittenTagDetected(true);
        setScanStatusMessage(`✓ NFC-Tag für „${spoolName}“ erfolgreich gelöscht & formatiert! Status ist jetzt rot.`);
      } else {
        setScanStatusMessage(`Fehler beim Löschen: ${res.message}`);
      }
    } catch (err: any) {
      setScanStatusMessage(`Fehler beim Löschen: ${err.message || String(err)}`);
    } finally {
      setIsWriting(false);
    }
  };

  // =========================================================================
  // BATCH-MODUS: ALLE SPULEN SCHREIBEN (SERIEN-TAG-SCHREIBER)
  // =========================================================================
  const executeBatchWriteStep = useCallback(async (spool: Spool) => {
    setIsBatchWriting(true);
    setBatchErrorMessage('');

    try {
      const res = await writeSpoolToNfcTag(spool);
      if (res.success) {
        playNfcSuccessChime();
        triggerNfcHaptic();
        onMarkSpoolWritten?.(spool.id, true);
        setBatchLastSuccessMessage(`✓ „${spool.brand} ${spool.name}“ erfolgreich auf Tag übertragen!`);

        // Nach kurzer Pause automatisch die nächste unbeschriebene Spule anwählen
        setTimeout(() => {
          const remaining = spools.filter(s => s.id !== spool.id && !s.nfcWritten);
          if (remaining.length > 0) {
            setBatchTargetSpoolId(remaining[0].id);
          }
        }, 1100);
      } else {
        setBatchErrorMessage(res.message);
      }
    } catch (e: any) {
      setBatchErrorMessage(e.message || 'Fehler beim Schreiben des Tags.');
    } finally {
      setIsBatchWriting(false);
    }
  }, [spools, onMarkSpoolWritten]);

  // Simulation für Desktop / Entwickler
  const handleSimulateBatchTagContact = () => {
    if (!currentBatchSpool) return;
    executeBatchWriteStep(currentBatchSpool);
  };

  // Diese Spule im Batch überspringen
  const handleSkipCurrentBatchSpool = () => {
    const unwritten = spools.filter(s => s.id !== currentBatchSpool?.id && !s.nfcWritten);
    if (unwritten.length > 0) {
      setBatchTargetSpoolId(unwritten[0].id);
      setBatchLastSuccessMessage(`Spule „${currentBatchSpool?.name}“ übersprungen.`);
    }
  };

  if (!isOpen) return null;

  const handleAdjustLoadedSpoolWeight = (deltaGrams: number) => {
    const spoolToAdjust = spools.find(s => s.id === loadedSpool?.id) || loadedSpool;
    if (!spoolToAdjust) return;

    if (deltaGrams < 0) {
      onDeductWeight(spoolToAdjust.id, Math.abs(deltaGrams));
      setAdjustFeedbackMessage(`✓ ${Math.abs(deltaGrams)}g direkt vom Filament abgezogen!`);
    } else {
      if (onAddWeight) {
        onAddWeight(spoolToAdjust.id, deltaGrams);
      } else {
        onDeductWeight(spoolToAdjust.id, -deltaGrams);
      }
      setAdjustFeedbackMessage(`✓ ${deltaGrams}g direkt zum Filament hinzugefügt!`);
    }
    playNfcSuccessChime();
    triggerNfcHaptic();
    setLoadedSpool(prev => prev ? {
      ...prev,
      remainingWeight: Math.max(0, prev.remainingWeight + deltaGrams)
    } : null);

    setTimeout(() => setAdjustFeedbackMessage(''), 3500);
  };

  const handleAdjustTargetSpoolWeight = (deltaGrams: number) => {
    const spoolToAdjust = spools.find(s => s.id === targetSpool?.id) || targetSpool;
    if (!spoolToAdjust) return;

    if (deltaGrams < 0) {
      onDeductWeight(spoolToAdjust.id, Math.abs(deltaGrams));
      setWriteSuccessMessage(`✓ ${Math.abs(deltaGrams)}g direkt vom Filament abgezogen!`);
    } else {
      if (onAddWeight) {
        onAddWeight(spoolToAdjust.id, deltaGrams);
      } else {
        onDeductWeight(spoolToAdjust.id, -deltaGrams);
      }
      setWriteSuccessMessage(`✓ ${deltaGrams}g direkt zum Filament hinzugefügt!`);
    }
    playNfcSuccessChime();
    triggerNfcHaptic();
    setTimeout(() => setWriteSuccessMessage(''), 3500);
  };

  // Wiederverwendbare Spulenauswahl
  const renderSpoolPicker = () => (
    <div className="space-y-2.5">
      <div className="space-y-1.5">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Spule suchen (Marke, Farbe, Material)..."
            value={spoolSearchQuery}
            onChange={e => setSpoolSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition"
          />
          {spoolSearchQuery && (
            <button
              onClick={() => setSpoolSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
          {['ALL', 'PLA', 'PETG', 'TPU', 'ABS'].map(mat => (
            <button
              key={mat}
              onClick={() => setSpoolMaterialFilter(mat)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold shrink-0 transition cursor-pointer ${
                spoolMaterialFilter === mat
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
              }`}
            >
              {mat === 'ALL' ? 'Alle' : mat}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 border border-slate-800 rounded-xl p-1 bg-slate-950/60">
        {filteredSpools.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs">
            Keine Spule gefunden für „{spoolSearchQuery}“
          </div>
        ) : (
          filteredSpools.map(s => {
            const isSelected = s.id === selectedSpoolId;
            return (
              <div
                key={s.id}
                onClick={() => setSelectedSpoolId(s.id)}
                className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2.5 ${
                  isSelected
                    ? 'bg-orange-500/15 border-orange-500 shadow-sm'
                    : 'bg-slate-900 hover:bg-slate-850 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-5 h-5 rounded-full border border-white/20 shrink-0 shadow-sm"
                    style={{ backgroundColor: s.colorHex || '#f97316' }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-extrabold uppercase text-orange-400">
                        {s.brand}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700">
                        {s.material}
                      </span>
                      {s.nfcWritten ? (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                          ✓ Beschrieben
                        </span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">
                          Offen
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-xs text-white truncate mt-0.5">
                      {s.name}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono-num text-xs font-bold text-emerald-400">
                    {s.remainingWeight}g
                  </span>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${
                      isSelected
                        ? 'border-orange-500 bg-orange-500 text-white'
                        : 'border-slate-600 bg-slate-800'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 overflow-y-auto"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--app-card)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-text)'
        }}
      >
        {/* Header & Tabs */}
        <div className="p-4 border-b flex items-center justify-between gap-2 shrink-0" style={{ borderColor: 'var(--app-border)' }}>
          {activeTab === 'write-direct' && targetSpool ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center border border-orange-500/30 shrink-0">
                <Tag className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm text-white truncate">
                  Spule auf NFC-Tag schreiben
                </h3>
                <p className="text-[11px] text-orange-400 font-semibold truncate">
                  {targetSpool.brand} {targetSpool.name}
                </p>
              </div>
            </div>
          ) : activeTab === 'inspect' && targetSpool ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm text-white truncate">
                  NFC-Tag Informationen
                </h3>
                <p className="text-[11px] text-emerald-400 font-semibold truncate">
                  ✓ Verknüpft mit {targetSpool.brand} {targetSpool.name}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold">
              {/* TAB 1: BATCH-MODUS (ALLE SPULEN BESCHREIBEN) */}
              <button
                onClick={() => {
                  setActiveTab('batch');
                  setIsBatchActive(true);
                }}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'batch'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Alle Spulen beschreiben</span>
              </button>

              {/* TAB 2: LESEN */}
              <button
                onClick={() => {
                  setActiveTab('read');
                  startNfcScan();
                }}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'read' ? 'bg-orange-500 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Lesen</span>
              </button>

              {/* TAB 3: EINZEL-TAG SCHREIBEN */}
              <button
                onClick={() => {
                  setActiveTab('write');
                  setWriteSuccessMessage('');
                  setWriteErrorMessage('');
                }}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'write' ? 'bg-orange-500 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Einzel-Spule</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            {(activeTab === 'write-direct' || activeTab === 'inspect') && (
              <button
                onClick={() => {
                  setActiveTab('batch');
                  setIsBatchActive(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700 transition cursor-pointer"
                title="Zur Übersicht aller Spulen"
              >
                Übersicht
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollbarer Modal-Inhalt */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {/* =============================================================== */}
          {/* TAB 1: MODUS "ALLE SPULEN BESCHREIBEN"                          */}
          {/* =============================================================== */}
          {activeTab === 'batch' && (
            <div className="space-y-4 text-xs">
              {/* Fortschritts-Header */}
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-white flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-orange-400" />
                      <span>NFC Massen-Schreibmodus</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-bold border border-orange-500/30">
                      Fortlaufend
                    </span>
                  </div>
                  <span className="font-mono-num font-bold text-emerald-400 text-sm">
                    {writtenCount} / {totalCount} ({progressPct}%)
                  </span>
                </div>

                {/* Fortschrittsbalken */}
                <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-400 rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
                  <span>🟢 {writtenCount} Spulen codiert</span>
                  <span>🔴 {totalCount - writtenCount} Spulen noch offen</span>
                </div>
              </div>

              {/* CELEBRATION CARD WENN ALLE BESCHRIEBEN */}
              {allCompleted ? (
                <div className="p-6 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/40 text-center space-y-3 animate-in fade-in zoom-in-95">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-extrabold text-white">
                      🎉 Alle {totalCount} Spulen haben jetzt einen NFC-Tag!
                    </h3>
                    <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                      Jeder NFC-Tag ist erfolgreich codiert. Alle Filamente leuchten in deiner Filament-Übersicht jetzt grün.
                    </p>
                  </div>
                  <div className="pt-2 flex justify-center gap-2">
                    {onResetAllNfcWritten && (
                      <button
                        onClick={onResetAllNfcWritten}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 border border-rose-500/30 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Alle auf unbeschrieben (rot) zurücksetzen</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* AKTIVER TAG-SCHREIB-FOKUS */
                <div className="p-5 rounded-2xl bg-gradient-to-b from-orange-500/15 via-slate-900 to-slate-900 border-2 border-orange-500/50 space-y-4 text-center shadow-lg">
                  {/* Radar/Wellen Animation */}
                  <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-orange-500/25 animate-ping duration-1000" />
                    <div
                      className="relative w-16 h-16 rounded-2xl flex items-center justify-center border-2 shadow-xl"
                      style={{
                        backgroundColor: currentBatchSpool?.colorHex || '#f97316',
                        borderColor: 'rgba(255, 255, 255, 0.4)'
                      }}
                    >
                      <Tag className="w-8 h-8 text-white drop-shadow" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                      Nächste Spule zum Beschreiben
                    </span>
                    <h3 className="text-base font-extrabold text-white">
                      {currentBatchSpool?.brand} {currentBatchSpool?.name}
                    </h3>
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-300 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-bold">
                        {currentBatchSpool?.material}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                        Farbe: {currentBatchSpool?.colorName || 'Standard'}
                      </span>
                      <span className="font-mono-num font-bold text-emerald-400">
                        {currentBatchSpool?.remainingWeight}g Rest
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                    👉 <strong>Halte jetzt einen NFC-Tag an dein Handy.</strong> Sobald der Tag berührt wird, beschreibt FilamentHub diesen Tag, gibt ein Signal und schaltet automatisch auf die nächste Spule!
                  </div>

                  {/* Letzter Erfolg oder Fehlermeldung */}
                  {batchLastSuccessMessage && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{batchLastSuccessMessage}</span>
                    </div>
                  )}

                  {batchErrorMessage && (
                    <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{batchErrorMessage}</span>
                    </div>
                  )}

                  {/* Steuerungsleiste für Desktop-Test & Überspringen */}
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={handleSimulateBatchTagContact}
                      disabled={isBatchWriting}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs shadow-md shadow-orange-500/25 transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                    >
                      <Zap className="w-4 h-4" />
                      <span>Tag-Kontakt ausführen (Spule schreiben)</span>
                    </button>

                    <button
                      onClick={handleSkipCurrentBatchSpool}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                      title="Diese Spule überspringen und nächste wählen"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                      <span>Überspringen</span>
                    </button>
                  </div>
                </div>
              )}

              {/* LISTE ALLER SPULEN MIT STATUS ROT / GRÜN */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-300">
                    Spulen-Übersicht ({spools.length} Filamente):
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Tippe auf eine Spule, um sie direkt anzusteuern
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 border border-slate-800 rounded-xl p-1.5 bg-slate-950/60 divide-y divide-slate-850">
                  {spools.map((s, idx) => {
                    const isTarget = currentBatchSpool?.id === s.id;
                    const isWritten = s.nfcWritten;
                    return (
                      <div
                        key={s.id}
                        onClick={() => setBatchTargetSpoolId(s.id)}
                        className={`p-2 rounded-xl transition cursor-pointer flex items-center justify-between gap-2 ${
                          isTarget
                            ? 'bg-orange-500/20 border-2 border-orange-500 shadow-sm'
                            : 'hover:bg-slate-900 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-5 h-5 rounded-full border border-white/20 shrink-0 shadow-sm"
                            style={{ backgroundColor: s.colorHex || '#f97316' }}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-mono-num text-slate-400">
                                #{idx + 1}
                              </span>
                              <span className="text-[10px] font-extrabold uppercase text-orange-400">
                                {s.brand}
                              </span>
                              <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-300 font-bold">
                                {s.material}
                              </span>
                            </div>
                            <div className="font-semibold text-xs text-white truncate">
                              {s.name}
                            </div>
                          </div>
                        </div>

                        {/* Status-Badge: Rot / Grün */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isWritten ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Beschrieben</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                              <Tag className="w-3 h-3 text-rose-400" />
                              <span>Unbeschrieben</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 2: NFC-TAG LESEN                                           */}
          {/* =============================================================== */}
          {activeTab === 'read' && (
            <div className="space-y-4 text-xs">
              {unwrittenTagDetected ? (
                <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 space-y-3.5 text-center">
                  <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                    <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      <span>Unbeschriebener Tag erkannt</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setUnwrittenTagDetected(false);
                        startNfcScan();
                      }}
                      className="px-2.5 py-1 rounded-lg border border-amber-500/40 hover:bg-amber-500/20 text-amber-300 text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                      title="Diesen Tag ignorieren und nach beschriebenen Spulen weitersuchen"
                    >
                      <X className="w-3 h-3" />
                      <span>Weiter scannen</span>
                    </button>
                  </div>
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow">
                    <Tag className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono-num px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      UID: {detectedTagUid}
                    </span>
                    <h4 className="font-extrabold text-sm text-white">
                      Neuer / unbeschriebener NFC-Tag erkannt!
                    </h4>
                    <p className="text-[11px] text-slate-300 max-w-sm mx-auto">
                      Wähle eine Spule aus deinem Bestand, um diesen Tag sofort zu verknüpfen (oder klicke oben auf „Weiter scannen“):
                    </p>
                  </div>

                  <div className="text-left space-y-2">
                    {renderSpoolPicker()}

                    {targetSpool && (
                      <button
                        onClick={() => handleWriteSpoolToCurrentTag(targetSpool)}
                        disabled={isWriting}
                        className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <PenTool className="w-3.5 h-3.5" />
                        <span>Diesen Tag mit „{targetSpool.brand} {targetSpool.name}“ beschreiben</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : loadedSpool ? (
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>Tag erfolgreich gelesen & zugeordnet</span>
                    </span>
                    {detectedTagUid && (
                      <span className="font-mono-num text-[10px] text-slate-400">
                        UID: {detectedTagUid}
                      </span>
                    )}
                  </div>

                  {activeLoadedSpool && (
                    <>
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                        <span
                          className="w-8 h-8 rounded-xl border border-white/20 shrink-0 shadow-inner"
                          style={{ backgroundColor: activeLoadedSpool.colorHex || '#f97316' }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-extrabold uppercase text-orange-400">
                              {activeLoadedSpool.brand}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700">
                              {activeLoadedSpool.material}
                            </span>
                          </div>
                          <h4 className="font-bold text-sm text-white truncate">
                            {activeLoadedSpool.name}
                          </h4>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono-num font-extrabold text-sm text-emerald-400 block">
                            {activeLoadedSpool.remainingWeight}g
                          </span>
                          <span className="text-[10px] text-slate-400">von {activeLoadedSpool.initialWeight || 1000}g Netto</span>
                        </div>
                      </div>

                      {/* Live Feedback bei Gewichtsänderung */}
                      {adjustFeedbackMessage && (
                        <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>{adjustFeedbackMessage}</span>
                        </div>
                      )}

                      {/* Schnellabzug & Hinzufügen (direkt vom Filament abgezogen oder hinzugefügt) */}
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-extrabold text-white flex items-center gap-1.5">
                            <span>⚡ Direkt vom Filament abziehen / hinzufügen:</span>
                          </span>
                          <span className="text-[11px] text-emerald-400 font-mono-num font-extrabold">
                            Rest: {activeLoadedSpool.remainingWeight}g
                          </span>
                        </div>

                        {/* Zeile 1: Schnelltasten Abziehen (-) */}
                        <div className="space-y-1">
                          <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1">
                            <Minus className="w-3 h-3 text-rose-400" />
                            <span>Gramm abziehen (-):</span>
                          </span>
                          <div className="grid grid-cols-6 gap-1">
                            {[5, 10, 25, 50, 100, 250].map(amt => (
                              <button
                                key={amt}
                                onClick={() => handleAdjustLoadedSpoolWeight(-amt)}
                                className="py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-mono-num font-bold text-[11px] border border-rose-500/30 transition cursor-pointer text-center active:scale-95 shadow-xs"
                                title={`${amt}g direkt von ${activeLoadedSpool.name} abziehen`}
                              >
                                -{amt}g
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Zeile 2: Schnelltasten Hinzufügen (+) */}
                        <div className="space-y-1 pt-1.5 border-t border-slate-850">
                          <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                            <Plus className="w-3 h-3 text-emerald-400" />
                            <span>Gramm wieder hinzufügen (+ Korrektur):</span>
                          </span>
                          <div className="grid grid-cols-6 gap-1">
                            {[5, 10, 25, 50, 100, 250].map(amt => (
                              <button
                                key={amt}
                                onClick={() => handleAdjustLoadedSpoolWeight(amt)}
                                className="py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-mono-num font-bold text-[11px] border border-emerald-500/30 transition cursor-pointer text-center active:scale-95 shadow-xs"
                                title={`${amt}g direkt zu ${activeLoadedSpool.name} hinzufügen`}
                              >
                                +{amt}g
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Zeile 3: Beliebigen Betrag manuell abziehen oder hinzufügen */}
                        <div className="pt-2 border-t border-slate-850 space-y-1.5">
                          <span className="text-[10px] text-slate-400 font-semibold block">
                            Benutzerdefinierte Gramm-Anzahl:
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const val = Math.max(1, parseInt(adjustGramsInput) || 0);
                                handleAdjustLoadedSpoolWeight(-val);
                              }}
                              className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs border border-rose-500/40 flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
                            >
                              <Minus className="w-3.5 h-3.5" />
                              <span>Abziehen</span>
                            </button>

                            <div className="relative flex-1">
                              <input
                                type="number"
                                min="1"
                                max="3000"
                                value={adjustGramsInput}
                                onChange={e => setAdjustGramsInput(e.target.value)}
                                placeholder="Gramm..."
                                className="w-full text-center px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono-num font-bold text-white focus:outline-none focus:border-orange-500"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono-num text-slate-500 pointer-events-none">
                                g
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const val = Math.max(1, parseInt(adjustGramsInput) || 0);
                                handleAdjustLoadedSpoolWeight(val);
                              }}
                              className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-xs border border-emerald-500/40 flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Hinzufügen</span>
                            </button>
                          </div>
                        </div>

                        <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                          <span>🔄 Echtzeit-Bestand:</span>
                          <span className="font-mono-num font-bold text-white">
                            {activeLoadedSpool.remainingWeight}g Netto ({Math.round((activeLoadedSpool.remainingWeight / (activeLoadedSpool.initialWeight || 1000)) * 100)}%)
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Tag Löschen Button */}
                  <div className="pt-0.5">
                    <button
                      onClick={handleDeleteLoadedTag}
                      disabled={isWriting}
                      className="w-full py-2.5 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-98 shadow-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>{isWriting ? 'Lösche Tag...' : 'Diesen NFC-Tag löschen & formatieren'}</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      onClick={startNfcScan}
                      className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Weiteren Tag scannen</span>
                    </button>

                    {onSelectSpoolForEdit && (
                      <button
                        onClick={() => {
                          onClose();
                          onSelectSpoolForEdit(loadedSpool);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-orange-400 font-bold text-xs border border-slate-700 transition cursor-pointer flex items-center gap-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Spule bearbeiten</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* SCANNER RADAR ANIMATION */
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
                  <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-orange-500/20 animate-ping" />
                    <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-xl shadow-orange-500/30">
                      <Radio className="w-8 h-8 animate-pulse" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-extrabold text-sm text-white">NFC-Scanner aktiv</h4>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                      {scanStatusMessage}
                    </p>
                  </div>

                  {/* Desktop Schnelltest */}
                  <div className="pt-2 border-t border-slate-800 space-y-1.5">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">
                      Schnelltest (Simulation):
                    </span>
                    <div className="flex justify-center gap-2 flex-wrap">
                      <button
                        onClick={handleSimulateUnwrittenTag}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-[11px] font-semibold cursor-pointer"
                      >
                        🧪 Neuer Tag simulieren
                      </button>
                      <button
                        onClick={handleSimulateLoadedTag}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-[11px] font-semibold cursor-pointer"
                      >
                        🧪 Spule erkannt simulieren
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 3: EINZEL-SPULE AUF NFC-TAG BESCHREIBEN                     */}
          {/* =============================================================== */}
          {activeTab === 'write' && (
            <div className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-[11px] text-slate-300 space-y-1">
                <span className="font-bold text-orange-400 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Einzelne Spule auf NFC-Tag schreiben</span>
                </span>
                <p>
                  Wähle unten die Spule aus. Klicke dann auf <strong>„Spule auf NFC-Tag schreiben“</strong> und halte den Tag an dein Smartphone.
                </p>
              </div>

              {renderSpoolPicker()}

              {targetSpool && (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-6 h-6 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: targetSpool.colorHex || '#f97316' }}
                    />
                    <div className="min-w-0">
                      <span className="font-bold text-white block truncate">{targetSpool.brand} {targetSpool.name}</span>
                      <span className="text-[10px] text-slate-400">{targetSpool.material} • {targetSpool.remainingWeight}g Netto</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {targetSpool.nfcWritten ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                        Bereits beschrieben
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">
                        Noch unbeschrieben
                      </span>
                    )}
                  </div>
                </div>
              )}

              {writeSuccessMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{writeSuccessMessage}</span>
                </div>
              )}

              {writeErrorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{writeErrorMessage}</span>
                </div>
              )}

              <button
                onClick={handleManualWriteSubmit}
                disabled={isWriting || !targetSpool}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs shadow-lg shadow-orange-500/25 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <PenTool className="w-4 h-4" />
                <span>{isWriting ? 'Halte den NFC-Tag an dein Smartphone...' : 'Spule jetzt auf NFC-Tag schreiben'}</span>
              </button>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 4: DIREKT-SCHREIBEN NUR FÜR DIESE SPULE                     */}
          {/* =============================================================== */}
          {activeTab === 'write-direct' && targetSpool && (
            <div className="space-y-4 text-xs">
              {/* Spulen-Preview */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center gap-3">
                  <span
                    className="w-10 h-10 rounded-xl border border-white/20 shrink-0 shadow-md"
                    style={{ backgroundColor: targetSpool.colorHex || '#f97316' }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-extrabold uppercase text-orange-400">
                        {targetSpool.brand}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700">
                        {targetSpool.material}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">
                        Noch unbeschrieben
                      </span>
                    </div>
                    <h3 className="font-extrabold text-base text-white truncate mt-0.5">
                      {targetSpool.name}
                    </h3>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono-num font-extrabold text-sm text-emerald-400 block">
                      {targetSpool.remainingWeight}g
                    </span>
                    <span className="text-[10px] text-slate-400">Netto</span>
                  </div>
                </div>
              </div>

              {/* Status & Feedback */}
              {writeSuccessMessage ? (
                <div className="p-5 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/40 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-sm text-emerald-300">
                      Erfolgreich auf NFC-Tag geschrieben!
                    </h4>
                    <p className="text-xs text-slate-300">
                      Der Tag ist nun mit <strong>„{targetSpool.brand} {targetSpool.name}“</strong> verknüpft und leuchtet ab jetzt grün.
                    </p>
                  </div>
                  <div className="flex justify-center gap-2 pt-2">
                    <button
                      onClick={onClose}
                      className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs shadow-md transition cursor-pointer"
                    >
                      Fertig & Schließen
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
                  <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-orange-500/20 animate-ping" />
                    <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-xl shadow-orange-500/30">
                      <Tag className="w-8 h-8" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-extrabold text-sm text-white">
                      Halte den NFC-Tag an dein Smartphone
                    </h4>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      Klicke auf den Button unten oder halte den NFC-Tag an die Rückseite deines Geräts.
                    </p>
                  </div>

                  {writeErrorMessage && (
                    <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                      {writeErrorMessage}
                    </div>
                  )}

                  <button
                    onClick={() => handleWriteSpoolToCurrentTag(targetSpool)}
                    disabled={isWriting}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
                  >
                    <PenTool className="w-4 h-4" />
                    <span>{isWriting ? 'Schreibe NFC-Tag...' : 'Spule jetzt auf NFC-Tag schreiben'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 5: INSPEKTOR & LÖSCHEN FÜR BEREITS BESCHRIEBENE SPULE       */}
          {/* =============================================================== */}
          {activeTab === 'inspect' && activeTargetSpool && (
            <div className="space-y-4 text-xs">
              {/* Grünes Status Banner */}
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between gap-2">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>NFC-Tag beschrieben & einsatzbereit</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono-num font-bold border border-emerald-500/40">
                  Status: Grün
                </span>
              </div>

              {/* Was ist auf dem Tag gespeichert? */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <span className="text-xs font-extrabold text-slate-300 block">
                  Gespeicherte Daten auf diesem NFC-Tag:
                </span>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                  <span
                    className="w-9 h-9 rounded-xl border border-white/20 shrink-0 shadow-inner"
                    style={{ backgroundColor: activeTargetSpool.colorHex || '#f97316' }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-extrabold uppercase text-orange-400">
                        {activeTargetSpool.brand}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700">
                        {activeTargetSpool.material}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-white truncate">
                      {activeTargetSpool.name}
                    </h4>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono-num font-extrabold text-sm text-emerald-400 block">
                      {activeTargetSpool.remainingWeight}g
                    </span>
                    <span className="text-[10px] text-slate-400">von {activeTargetSpool.initialWeight}g</span>
                  </div>
                </div>

                {/* Detail-Gitter */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-850">
                    <span className="text-slate-400 text-[10px] block">Farbe & Hex:</span>
                    <span className="font-bold text-white flex items-center gap-1.5 mt-0.5">
                      <span className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: activeTargetSpool.colorHex }} />
                      <span>{activeTargetSpool.colorName || 'Standard'} ({activeTargetSpool.colorHex})</span>
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-850">
                    <span className="text-slate-400 text-[10px] block">Kilopreis:</span>
                    <span className="font-mono-num font-bold text-white block mt-0.5">
                      {activeTargetSpool.pricePerKg?.toFixed(2).replace('.', ',')} €/kg
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-850">
                    <span className="text-slate-400 text-[10px] block">Spulen-Tara (Leer):</span>
                    <span className="font-mono-num font-bold text-white block mt-0.5">
                      {activeTargetSpool.emptySpoolWeight || 200} g
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-850">
                    <span className="text-slate-400 text-[10px] block">Trocknung:</span>
                    <span className="font-bold text-white block mt-0.5">
                      {activeTargetSpool.dryTemp || 50}°C / {activeTargetSpool.dryHours || 6}h
                    </span>
                  </div>
                </div>
              </div>

              {/* Schnelle Gewichtsanpassung (+/-) direkt hier */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-bold text-slate-300 block">
                    ⚡ Gewicht direkt anpassen (+ / -):
                  </span>
                  <span className="text-[11px] text-emerald-400 font-mono-num font-extrabold">
                    Aktuell: {activeTargetSpool.remainingWeight}g
                  </span>
                </div>

                {/* Zeile 1: Schnelltasten Abziehen (-) */}
                <div className="space-y-1">
                  <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1">
                    <Minus className="w-3 h-3 text-rose-400" />
                    <span>Gramm abziehen (-):</span>
                  </span>
                  <div className="grid grid-cols-6 gap-1">
                    {[5, 10, 25, 50, 100, 250].map(amt => (
                      <button
                        key={amt}
                        onClick={() => handleAdjustTargetSpoolWeight(-amt)}
                        className="py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-mono-num font-bold text-[11px] border border-rose-500/30 transition cursor-pointer text-center active:scale-95 shadow-xs"
                        title={`${amt}g abziehen`}
                      >
                        -{amt}g
                      </button>
                    ))}
                  </div>
                </div>

                {/* Zeile 2: Schnelltasten Hinzufügen (+) */}
                <div className="space-y-1 pt-1.5 border-t border-slate-850">
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    <Plus className="w-3 h-3 text-emerald-400" />
                    <span>Gramm hinzufügen (+ Korrektur):</span>
                  </span>
                  <div className="grid grid-cols-6 gap-1">
                    {[5, 10, 25, 50, 100, 250].map(amt => (
                      <button
                        key={amt}
                        onClick={() => handleAdjustTargetSpoolWeight(amt)}
                        className="py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-mono-num font-bold text-[11px] border border-emerald-500/30 transition cursor-pointer text-center active:scale-95 shadow-xs"
                        title={`${amt}g hinzufügen`}
                      >
                        +{amt}g
                      </button>
                    ))}
                  </div>
                </div>

                {/* Zeile 3: Manuelle Eingabe */}
                <div className="pt-2 border-t border-slate-850 space-y-1.5">
                  <span className="text-[10px] text-slate-400 font-semibold block">
                    Beliebigen Betrag anpassen:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const val = Math.max(1, parseInt(adjustGramsInput) || 0);
                        handleAdjustTargetSpoolWeight(-val);
                      }}
                      className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs border border-rose-500/40 flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
                    >
                      <Minus className="w-3.5 h-3.5" />
                      <span>Abziehen</span>
                    </button>

                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="1"
                        max="3000"
                        value={adjustGramsInput}
                        onChange={e => setAdjustGramsInput(e.target.value)}
                        placeholder="Gramm..."
                        className="w-full text-center px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono-num font-bold text-white focus:outline-none focus:border-orange-500"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono-num text-slate-500 pointer-events-none">
                        g
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const val = Math.max(1, parseInt(adjustGramsInput) || 0);
                        handleAdjustTargetSpoolWeight(val);
                      }}
                      className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-xs border border-emerald-500/40 flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Hinzufügen</span>
                    </button>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                  <span>🔄 Direkt synchronisiert:</span>
                  <span className="font-mono-num font-bold text-white">
                    {activeTargetSpool.remainingWeight}g Netto ({Math.round((activeTargetSpool.remainingWeight / (activeTargetSpool.initialWeight || 1000)) * 100)}%)
                  </span>
                </div>
              </div>

              {/* Erfolgs- oder Fehlermeldung */}
              {writeSuccessMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">
                  {writeSuccessMessage}
                </div>
              )}
              {writeErrorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                  {writeErrorMessage}
                </div>
              )}

              {/* Aktionen: LÖSCHEN (ROT) & ÜBERSCHREIBEN */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={handleDeleteTargetSpoolTag}
                  disabled={isWriting}
                  className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isWriting ? 'Lösche NFC-Tag...' : 'NFC-Tag löschen & leeren'}</span>
                </button>
                <p className="text-[10px] text-slate-400 text-center">
                  Entfernt die Daten vom Tag und setzt die Spule wieder auf rot (unbeschrieben).
                </p>

                <button
                  onClick={() => {
                    setWriteSuccessMessage('');
                    setWriteErrorMessage('');
                    setActiveTab('write-direct');
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer mt-1"
                >
                  <RotateCw className="w-3.5 h-3.5 text-orange-400" />
                  <span>Tag neu überschreiben</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
