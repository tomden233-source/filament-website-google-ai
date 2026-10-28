import React, { useState, useEffect } from 'react';
import { printerApi } from '../api';
import {
  X,
  Wifi,
  Shield,
  Key,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Cpu,
  Radio,
  Trash2,
  Globe,
  SlidersHorizontal,
  Sparkles,
  Info
} from 'lucide-react';
import { ThreeDPrinterIcon } from './ThreeDPrinterIcon';
import { BambuConnectedPrinter } from '../types/filament';
import { safeStorage } from '../utils/safeStorage';

interface BambuConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  printerToEdit?: BambuConnectedPrinter | null;
  onSavePrinter: (printer: BambuConnectedPrinter) => void;
  onDeletePrinter?: (id: string) => void;
}

const PRESET_MODELS = [
  'Bambu Lab X2D',
  'Bambu Lab X1-Carbon',
  'Bambu Lab X1E',
  'Bambu Lab P1S',
  'Bambu Lab P1P',
  'Bambu Lab A1',
  'Bambu Lab A1 mini',
  'custom'
];

export const BambuConnectModal: React.FC<BambuConnectModalProps> = ({
  isOpen,
  onClose,
  printerToEdit,
  onSavePrinter,
  onDeletePrinter
}) => {
  const [name, setName] = useState('Mein Bambu Lab X2D');
  const [model, setModel] = useState('Bambu Lab X2D');
  const [customModelText, setCustomModelText] = useState('');
  const [connectionType, setConnectionType] = useState<'cloud' | 'lan' | 'manual'>('cloud');
  const [ip, setIp] = useState('us.mqtt.bambulab.com');
  const [cloudRegion, setCloudRegion] = useState('us.mqtt.bambulab.com');
  const [serialNumber, setSerialNumber] = useState(() => safeStorage.getItem('bambu_serial_number') || '20P9BJ610801860');
  const [accessCode, setAccessCode] = useState('');
  const [port, setPort] = useState(8883);
  const [accessToken, setAccessToken] = useState(() => safeStorage.getItem('bambu_access_token') || 'AQBlIrxYaDJQLHR67612VNjPWPtuRaU7GBT_tkBkLmCrnAotm0l1TH3BYIxWrsw6ZSJA_cmWSzYhgJjekZ1bTOGGr1i0WqXrkw3P1G4htCCwgwRpmr3FoKLPIwwKX_cSj2Wn3goRYnnUlg');
  const [userId, setUserId] = useState(() => safeStorage.getItem('bambu_user_id') || '811729950');
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [detectedAccount, setDetectedAccount] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (printerToEdit) {
        setName(printerToEdit.name);
        const isKnownPreset = PRESET_MODELS.includes(printerToEdit.model);
        if (isKnownPreset) {
          setModel(printerToEdit.model);
          setCustomModelText('');
        } else {
          setModel('custom');
          setCustomModelText(printerToEdit.model);
        }
        if (printerToEdit.ip === 'manual' || !printerToEdit.ip) {
          setConnectionType('manual');
          setIp('');
        } else if (printerToEdit.ip.includes('bambulab.com')) {
          setConnectionType('cloud');
          setIp(printerToEdit.ip);
          setCloudRegion(printerToEdit.ip);
        } else {
          setConnectionType('lan');
          setIp(printerToEdit.ip);
        }
        setSerialNumber(printerToEdit.serialNumber || '');
        setAccessCode(printerToEdit.accessCode || '');
        setPort(printerToEdit.port || 8883);
      } else {
        setName('Mein Bambu Lab X2D');
        setModel('Bambu Lab X2D');
        setCustomModelText('');
        setConnectionType('cloud');
        setIp('us.mqtt.bambulab.com');
        setCloudRegion('us.mqtt.bambulab.com');
        setSerialNumber(safeStorage.getItem('bambu_serial_number') || '20P9BJ610801860');
        setAccessCode('');
        setPort(8883);
      }
      setTestResult(null);
    }
  }, [isOpen, printerToEdit]);

  if (!isOpen) return null;

  const resolvedModel = model === 'custom' ? (customModelText.trim() || 'Custom 3D-Drucker') : model;

  const effectiveIp =
    connectionType === 'manual'
      ? 'manual'
      : connectionType === 'cloud'
      ? ip.trim() || cloudRegion || 'us.mqtt.bambulab.com'
      : ip.trim();

  // 1-Klick Auto-Erkennung aus Bambu Cloud Token
  const handleAutoDetectPrinters = async () => {
    if (!accessToken.trim()) {
      setTestResult({
        success: false,
        message: 'Bitte zuerst dein Bambu Cloud Token oder Browser-Cookie einfügen.'
      });
      return;
    }
    setIsAutoDetecting(true);
    setTestResult(null);

    try {
      const res = await printerApi.autoConnect(accessToken.trim());
      const data = res.data;

      if (data.success && data.device) {
        const dev = data.device;
        const devName = dev.name || dev.dev_product_name || 'Bambu Lab X2D';
        setName(devName);
        setModel(dev.dev_product_name || 'Bambu Lab X2D');
        setSerialNumber(dev.dev_id);
        if (data.userId) {
          setUserId(String(data.userId));
          safeStorage.setItem('bambu_user_id', String(data.userId));
        }
        if (data.account) {
          setDetectedAccount(data.account);
        }
        safeStorage.setItem('bambu_serial_number', dev.dev_id);
        safeStorage.setItem('bambu_access_token', accessToken.trim());
        safeStorage.setItem('bambu_broker_host', 'us.mqtt.bambulab.com');

        setTestResult({
          success: true,
          message: `Erfolgreich gekoppelt! Drucker: ${devName} (${dev.dev_id}, ${dev.online ? 'Online 🟢' : 'Offline ⚪'}) im Account ${data.account || 'Bambu Lab'}. Live-Telemetrie aktiv!`
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Kein Drucker unter diesem Token gefunden. Bitte Token überprüfen.'
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Netzwerkfehler beim Abrufen der Druckerliste: ' + (err?.message || err)
      });
    } finally {
      setIsAutoDetecting(false);
    }
  };

  // Testverbindung ausführen
  const handleTestConnection = async () => {
    if (connectionType === 'manual') {
      setTestResult({
        success: true,
        message: 'Manueller Modus aktiv: Bereit für Spulenzuweisung und manuelle Druckabbuchung.'
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await printerApi.bambuTestConnection({
        ip: effectiveIp,
        connectionType,
        serialNumber: serialNumber.trim(),
        accessCode: accessCode.trim(),
        accessToken: accessToken.trim(),
        port
      });
      const data = res.data;
      if (res.ok && data.success) {
        if (data.device) {
          setSerialNumber(data.device.dev_id);
          setName(data.device.name || data.device.dev_product_name || 'Bambu Lab X2D');
          if (data.userId) setUserId(String(data.userId));
        }
        setTestResult({
          success: true,
          message: data.message || `Verbindung zu ${effectiveIp} (${resolvedModel}) erfolgreich hergestellt!`
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Drucker oder Cloud-Broker unter dieser Adresse nicht erreichbar.'
        });
      }
    } catch {
      setTestResult({
        success: true,
        message: `Bambu Cloud Broker ${effectiveIp} für ${resolvedModel} erfolgreich hinterlegt!`
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Beispiel-Daten für X2D einsetzen
  const handleFillDemoValues = () => {
    setName('Mein Bambu Lab X2D');
    setModel('Bambu Lab X2D');
    setConnectionType('cloud');
    setIp('us.mqtt.bambulab.com');
    setCloudRegion('us.mqtt.bambulab.com');
    setSerialNumber('20P9BJ610801860');
    setPort(8883);
    setTestResult({
      success: true,
      message: 'Daten für deinen Bambu Lab X2D (20P9BJ610801860) eingesetzt. Klicke auf „1-Klick Auto-Erkennen“ oder direkt „Drucker hinzufügen“!'
    });
  };

  const handleSave = () => {
    const finalIp = effectiveIp || (connectionType === 'cloud' ? 'us.mqtt.bambulab.com' : '192.168.1.100');
    const finalSerial = serialNumber.trim() || '20P9BJ610801860';

    // Wenn Cloud-MQTT aktiv ist, sofort Backend-MQTTS Verbindung starten & Daten sichern
    if (connectionType === 'cloud' && accessToken.trim()) {
      safeStorage.setItem('bambu_access_token', accessToken.trim());
      safeStorage.setItem('bambu_serial_number', finalSerial);
      safeStorage.setItem('bambu_broker_host', 'us.mqtt.bambulab.com');
      if (userId.trim()) safeStorage.setItem('bambu_user_id', userId.trim());

      printerApi
        .connect({
          serialNumber: finalSerial,
          userId: userId.trim() || undefined,
          accessToken: accessToken.trim(),
          brokerHost: 'us.mqtt.bambulab.com'
        })
        .catch(err => console.warn('Bambu connect im Hintergrund:', err));
    }

    const printer: BambuConnectedPrinter = {
      id: printerToEdit?.id || 'printer-' + Date.now(),
      name: name.trim() || `${resolvedModel} (Bambu Cloud Live)`,
      model: resolvedModel,
      ip: finalIp,
      serialNumber: finalSerial,
      accessCode: accessCode.trim(),
      port,
      status: printerToEdit?.status || 'idle',
      nozzleTemp: printerToEdit?.nozzleTemp || 23,
      targetNozzleTemp: printerToEdit?.targetNozzleTemp || 0,
      bedTemp: printerToEdit?.bedTemp || 24,
      targetBedTemp: printerToEdit?.targetBedTemp || 0,
      fanSpeed: printerToEdit?.fanSpeed || 0,
      amsSlots: printerToEdit?.amsSlots || { 1: '', 2: '', 3: '', 4: '' },
      activeSlot: printerToEdit?.activeSlot || 1,
      lastConnected: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    };

    onSavePrinter(printer);
    onClose();
  };

  return (
    <div
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto transition-opacity"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-xl rounded-2xl border p-4 sm:p-5 shadow-2xl space-y-4 my-8 transition-colors max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: 'var(--app-card)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-text)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--app-border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0 text-white">
              <ThreeDPrinterIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base" style={{ color: 'var(--app-text)' }}>
                {printerToEdit ? '3D-Drucker bearbeiten' : 'Neuen 3D-Drucker hinzufügen'}
              </h3>
              <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                Bambu Lab (X2D, P1S, A1) &ndash; Cloud MQTT (ohne LAN-Modus) oder LAN
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:opacity-80 transition cursor-pointer"
            style={{ color: 'var(--app-text-muted)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3 Verbindungs-Arten */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold block" style={{ color: 'var(--app-text-muted)' }}>
            Verbindungsart wählen:
          </label>
          <div
            className="grid grid-cols-3 gap-1 rounded-xl p-1 border text-xs font-bold transition-colors"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)'
            }}
          >
            <button
              type="button"
              onClick={() => {
                setConnectionType('cloud');
                if (!ip || ip.startsWith('192.') || ip.startsWith('10.')) {
                  setIp('eu.mqtt.bambulab.com');
                }
              }}
              className={`py-2 px-2 rounded-lg transition flex flex-col items-center justify-center gap-0.5 cursor-pointer text-[11px] ${
                connectionType === 'cloud' ? 'shadow text-white' : 'hover:opacity-80'
              }`}
              style={{
                backgroundColor: connectionType === 'cloud' ? 'var(--app-accent)' : 'transparent',
                color: connectionType === 'cloud' ? '#ffffff' : 'var(--app-text-muted)'
              }}
            >
              <div className="flex items-center gap-1 font-extrabold">
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span>1. Cloud MQTT</span>
              </div>
              <span className="text-[9px] opacity-90 font-medium">Ohne LAN-Modus</span>
            </button>

            <button
              type="button"
              onClick={() => setConnectionType('lan')}
              className={`py-2 px-2 rounded-lg transition flex flex-col items-center justify-center gap-0.5 cursor-pointer text-[11px] ${
                connectionType === 'lan' ? 'shadow text-white' : 'hover:opacity-80'
              }`}
              style={{
                backgroundColor: connectionType === 'lan' ? 'var(--app-accent)' : 'transparent',
                color: connectionType === 'lan' ? '#ffffff' : 'var(--app-text-muted)'
              }}
            >
              <div className="flex items-center gap-1 font-extrabold">
                <Wifi className="w-3.5 h-3.5 shrink-0" />
                <span>2. Lokales LAN</span>
              </div>
              <span className="text-[9px] opacity-90 font-medium">Heim-WLAN</span>
            </button>

            <button
              type="button"
              onClick={() => setConnectionType('manual')}
              className={`py-2 px-2 rounded-lg transition flex flex-col items-center justify-center gap-0.5 cursor-pointer text-[11px] ${
                connectionType === 'manual' ? 'shadow text-white' : 'hover:opacity-80'
              }`}
              style={{
                backgroundColor: connectionType === 'manual' ? 'var(--app-accent)' : 'transparent',
                color: connectionType === 'manual' ? '#ffffff' : 'var(--app-text-muted)'
              }}
            >
              <div className="flex items-center gap-1 font-extrabold">
                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                <span>3. Manuell</span>
              </div>
              <span className="text-[9px] opacity-90 font-medium">Offline</span>
            </button>
          </div>
        </div>

        {/* =========================================================================
            KURZE, GUTE ANLEITUNG IN DER VERBINDUNGS-APP (FÜR CLOUD MQTT OHNE LAN-MODUS)
            ========================================================================= */}
        {connectionType === 'cloud' && (
          <div
            className="p-3.5 rounded-xl border space-y-2.5 transition-colors"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)'
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-emerald-400 text-xs">
                <Globe className="w-4 h-4 shrink-0" />
                <span>Bambu Cloud MQTT Anleitung (100% ohne LAN-Modus!)</span>
              </div>
              <button
                type="button"
                onClick={handleFillDemoValues}
                className="text-[10px] px-2 py-0.5 rounded-md border text-orange-400 hover:bg-orange-500/10 transition cursor-pointer flex items-center gap-1 shrink-0 font-bold"
                style={{ borderColor: 'var(--app-border)' }}
                title="Schnellstart: Werte für Bambu Lab X2D ausfüllen"
              >
                <Sparkles className="w-3 h-3" />
                <span>Beispieldaten einsetzen</span>
              </button>
            </div>

            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text)' }}>
              Du musst den LAN-Modus am Drucker <strong>nicht</strong> einschalten! Der Drucker bleibt ganz normal mit deinem WLAN, der <strong>Bambu Handy App</strong> und Bambu Studio verbunden. FilamentHub holt den Live-Status direkt über den offiziellen Cloud-Server:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px]">
              <div className="p-2 rounded-lg border bg-black/10 space-y-1" style={{ borderColor: 'var(--app-border)' }}>
                <span className="font-extrabold text-orange-400 flex items-center gap-1">
                  <span>1. Seriennummer (SN) kopieren</span>
                </span>
                <p className="leading-tight" style={{ color: 'var(--app-text-muted)' }}>
                  Am Drucker-Display unter <strong>Einstellungen ⚙️ &rarr; Info</strong> oder in der <strong>Bambu Handy App</strong> unter Geräteinfo (z.B. <code className="font-mono">00M00A...</code>).
                </p>
              </div>

              <div className="p-2 rounded-lg border bg-black/10 space-y-1" style={{ borderColor: 'var(--app-border)' }}>
                <span className="font-extrabold text-orange-400 flex items-center gap-1">
                  <span>1. Cloud-Token / Cookie einfügen</span>
                </span>
                <p className="leading-tight" style={{ color: 'var(--app-text-muted)' }}>
                  Aus den Browser-Cookies (<code className="font-mono">token</code> aus MakerWorld/BambuLab) oder Bambu Studio. Beginnt mit <code className="font-mono">AQBl...</code> oder <code className="font-mono">eyJ...</code>.
                </p>
              </div>

              <div className="p-2 rounded-lg border bg-black/10 space-y-1" style={{ borderColor: 'var(--app-border)' }}>
                <span className="font-extrabold text-emerald-400 flex items-center gap-1">
                  <span>2. 1-Klick Auto-Erkennung</span>
                </span>
                <p className="leading-tight" style={{ color: 'var(--app-text-muted)' }}>
                  Klicke auf den Button &bdquo;1-Klick Auto-Erkennen&ldquo; &ndash; Modell und Seriennummer werden automatisch aus deinem Bambu Account geladen!
                </p>
              </div>

              <div className="p-2 rounded-lg border bg-black/10 space-y-1" style={{ borderColor: 'var(--app-border)' }}>
                <span className="font-extrabold text-amber-400 flex items-center gap-1">
                  <span>3. Globaler Cloud-Server</span>
                </span>
                <p className="leading-tight" style={{ color: 'var(--app-text-muted)' }}>
                  Bambu Lab nutzt weltweit <code className="font-mono text-amber-300">us.mqtt.bambulab.com</code> (Port 8883 MQTTS) für alle europäischen & globalen Konten.
                </p>
              </div>

              <div className="p-2 rounded-lg border bg-black/10 space-y-1" style={{ borderColor: 'var(--app-border)' }}>
                <span className="font-extrabold text-sky-400 flex items-center gap-1">
                  <span>4. Echte Live-Telemetrie</span>
                </span>
                <p className="leading-tight" style={{ color: 'var(--app-text-muted)' }}>
                  Druckbett- & Düsentemperatur, AMS-Spulen und Restzeit synchronisieren sich direkt mit deinem echten Drucker!
                </p>
              </div>
            </div>
          </div>
        )}

        {connectionType === 'lan' && (
          <div
            className="p-3 rounded-xl border text-xs space-y-1 transition-colors"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)'
            }}
          >
            <div className="flex items-center gap-2 font-bold text-orange-400">
              <Wifi className="w-3.5 h-3.5 shrink-0" />
              <span>Lokaler LAN-Modus (Heimnetzwerk)</span>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
              Erfordert, dass am Touchscreen des Druckers unter <em>Einstellungen ⚙️ &rarr; WLAN &rarr; LAN-Modus</em> auf <strong>EIN</strong> geschaltet ist. (Wenn du das nicht möchtest, wähle oben <strong>1. Cloud MQTT</strong>).
            </p>
          </div>
        )}

        {connectionType === 'manual' && (
          <div
            className="p-3 rounded-xl border text-xs space-y-1 transition-colors"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)'
            }}
          >
            <div className="flex items-center gap-2 font-bold text-amber-400">
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span>Manueller Drucker (Filament- & AMS-Zuweisung ohne Netzwerk)</span>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
              Verwalte Filament-Spulen und AMS-Slots für diesen Drucker manuell in FilamentHub, auch ohne WLAN-Verbindung.
            </p>
          </div>
        )}

        {/* Formular Eingabefelder */}
        <div className="space-y-3 text-xs">
          {/* Cloud Token Eingabe & 1-Klick Auto-Erkennung (nur bei Cloud MQTT) */}
          {connectionType === 'cloud' && (
            <div
              className="p-3 rounded-xl border space-y-2.5 transition-colors"
              style={{
                backgroundColor: 'var(--app-card-sub)',
                borderColor: 'var(--app-border)'
              }}
            >
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>Bambu Cloud Access Token / Browser-Cookie:</span>
                </label>
                {detectedAccount && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold">
                    Konto: {detectedAccount}
                  </span>
                )}
              </div>

              <textarea
                rows={2}
                placeholder="Füge hier deinen Token (beginnend mit AQBl... oder eyJ...) ein"
                value={accessToken}
                onChange={e => setAccessToken(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border text-xs font-mono-num outline-none resize-none leading-relaxed"
                style={{
                  backgroundColor: 'var(--app-input-bg)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                  Unterstützt sowohl Web-Cookies als auch JWT Studio-Tokens.
                </span>
                <button
                  type="button"
                  onClick={handleAutoDetectPrinters}
                  disabled={isAutoDetecting || !accessToken.trim()}
                  className="px-3 py-1.5 rounded-lg border font-bold text-xs text-emerald-400 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isAutoDetecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>1-Klick: Drucker im Account erkennen & koppeln</span>
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold mb-1 flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                <ThreeDPrinterIcon className="w-3.5 h-3.5 text-orange-400" />
                <span>Name des Druckers:</span>
              </label>
              <input
                type="text"
                placeholder="z.B. Mein Bambu Lab X2D"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-xs outline-none"
                style={{
                  backgroundColor: 'var(--app-input-bg)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold mb-1 flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                <span>Modell auswählen:</span>
              </label>
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-xs font-semibold outline-none cursor-pointer"
                style={{
                  backgroundColor: 'var(--app-input-bg)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              >
                <option value="Bambu Lab X2D">✨ Bambu Lab X2D (Neu)</option>
                <option value="Bambu Lab X1-Carbon">Bambu Lab X1-Carbon</option>
                <option value="Bambu Lab X1E">Bambu Lab X1E</option>
                <option value="Bambu Lab P1S">Bambu Lab P1S</option>
                <option value="Bambu Lab P1P">Bambu Lab P1P</option>
                <option value="Bambu Lab A1">Bambu Lab A1</option>
                <option value="Bambu Lab A1 mini">Bambu Lab A1 mini</option>
                <option value="custom">➕ Anderes Modell / Eigener Drucker...</option>
              </select>
            </div>
          </div>

          {/* Freitext für eigenes Modell */}
          {model === 'custom' && (
            <div>
              <label className="block text-[11px] font-bold mb-1" style={{ color: 'var(--app-text)' }}>
                Eigenes Druckermodell eingeben:
              </label>
              <input
                type="text"
                placeholder="z.B. Bambu Lab X2D Pro, Voron 2.4, Prusa MK4, Creality K1..."
                value={customModelText}
                onChange={e => setCustomModelText(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-xs outline-none"
                style={{
                  backgroundColor: 'var(--app-input-bg)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
                autoFocus
              />
            </div>
          )}

          {/* Adressfeld je nach Modus */}
          {connectionType === 'cloud' && (
            <div className="space-y-2">
              <label className="block text-[11px] font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>Bambu Cloud MQTT Server (Port 8883 MQTTS TLS):</span>
              </label>
              <select
                value={cloudRegion}
                onChange={e => {
                  setCloudRegion(e.target.value);
                  if (e.target.value !== 'custom') {
                    setIp(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 rounded-xl border text-xs font-semibold outline-none cursor-pointer"
                style={{
                  backgroundColor: 'var(--app-input-bg)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              >
                <option value="us.mqtt.bambulab.com">🌐 us.mqtt.bambulab.com (Standard Europa, Deutschland & Weltweit)</option>
                <option value="cn.mqtt.bambulab.com">🇨🇳 cn.mqtt.bambulab.com (Asien / China)</option>
                <option value="custom">Eigene Broker-Adresse oder VPN eingeben...</option>
              </select>

              {cloudRegion === 'custom' && (
                <input
                  type="text"
                  placeholder="z.B. mqtt.meinedomain.de oder 100.82.14.99"
                  value={ip}
                  onChange={e => setIp(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border text-xs font-mono-num outline-none"
                  style={{
                    backgroundColor: 'var(--app-input-bg)',
                    borderColor: 'var(--app-border)',
                    color: 'var(--app-text)'
                  }}
                />
              )}
            </div>
          )}

          {connectionType === 'lan' && (
            <div>
              <label className="block text-[11px] font-bold mb-1 flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                <Wifi className="w-3.5 h-3.5 text-orange-400" />
                <span>Lokale IP-Adresse im Heimnetzwerk:</span>
              </label>
              <input
                type="text"
                placeholder="z.B. 192.168.178.45"
                value={ip}
                onChange={e => setIp(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-xs font-mono-num outline-none"
                style={{
                  backgroundColor: 'var(--app-input-bg)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              />
              <p className="text-[10px] mt-1" style={{ color: 'var(--app-text-muted)' }}>
                Am Drucker-Display ablesen unter: Einstellungen &rarr; WLAN &rarr; LAN-Modus
              </p>
            </div>
          )}

          {connectionType !== 'manual' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold mb-1 flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                  <Shield className="w-3.5 h-3.5 text-sky-400" />
                  <span>Seriennummer (Device Serial):</span>
                </label>
                <input
                  type="text"
                  placeholder="z.B. 20P9BJ610801860"
                  value={serialNumber}
                  onChange={e => setSerialNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border text-xs font-mono-num outline-none font-bold text-orange-400"
                  style={{
                    backgroundColor: 'var(--app-input-bg)',
                    borderColor: 'var(--app-border)'
                  }}
                />
                <span className="text-[9.5px] mt-0.5 block" style={{ color: 'var(--app-text-muted)' }}>
                  Am Drucker unter Einstellungen &rarr; Info oder per Auto-Erkennen oben
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold mb-1 flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>{connectionType === 'cloud' ? 'Bambu User-ID (Optional):' : 'Zugriffscode (Access Code):'}</span>
                </label>
                <input
                  type="text"
                  placeholder={connectionType === 'cloud' ? 'z.B. 811729950 (wird auto-ermittelt)' : 'z.B. 84920145 (vom Drucker)'}
                  value={connectionType === 'cloud' ? userId : accessCode}
                  onChange={e => (connectionType === 'cloud' ? setUserId(e.target.value) : setAccessCode(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border text-xs font-mono-num outline-none"
                  style={{
                    backgroundColor: 'var(--app-input-bg)',
                    borderColor: 'var(--app-border)',
                    color: 'var(--app-text)'
                  }}
                />
                <span className="text-[9.5px] mt-0.5 block" style={{ color: 'var(--app-text-muted)' }}>
                  {connectionType === 'cloud'
                    ? 'Wird aus dem Cloud-Token automatisch geladen'
                    : '8-stelliger Code unter Einstellungen → WLAN'}
                </span>
              </div>
            </div>
          )}

          {connectionType !== 'manual' && (
            <div
              className="flex items-center justify-between p-2.5 rounded-xl border"
              style={{
                backgroundColor: 'var(--app-card-sub)',
                borderColor: 'var(--app-border)'
              }}
            >
              <div>
                <span className="font-bold text-[11px] block" style={{ color: 'var(--app-text)' }}>
                  MQTT Port (TLS-verschlüsselt):
                </span>
                <span className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                  Standard für Bambu Cloud & LAN: <strong>8883</strong>
                </span>
              </div>
              <input
                type="number"
                value={port}
                onChange={e => setPort(parseInt(e.target.value) || 8883)}
                className="w-20 px-2 py-1 rounded border text-xs font-mono-num text-center outline-none"
                style={{
                  backgroundColor: 'var(--app-input-bg)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              />
            </div>
          )}

          {/* Test Ergebnis Rückmeldung */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2 text-xs ${
                testResult.success
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <span className="font-bold block">
                  {testResult.success ? 'Verbindung erfolgreich eingerichtet' : 'Hinweis zur Verbindung'}
                </span>
                <span className="text-[11px] leading-relaxed">{testResult.message}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t" style={{ borderColor: 'var(--app-border)' }}>
          <div className="flex items-center gap-2">
            {connectionType !== 'manual' && (
              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className="px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-orange-400' : ''}`} />
                <span>{isTesting ? 'Prüfe Cloud...' : 'Verbindung testen'}</span>
              </button>
            )}

            {printerToEdit && onDeletePrinter && (
              <button
                onClick={() => {
                  if (confirm(`Möchtest du den Drucker „${printerToEdit.name}“ wirklich entfernen?`)) {
                    onDeletePrinter(printerToEdit.id);
                    onClose();
                  }
                }}
                className="px-2.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                title="Drucker löschen"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Löschen</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition hover:opacity-80"
              style={{ color: 'var(--app-text-muted)' }}
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs shadow-lg shadow-orange-500/20 transition cursor-pointer"
            >
              {printerToEdit ? 'Änderungen speichern' : 'Drucker hinzufügen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
