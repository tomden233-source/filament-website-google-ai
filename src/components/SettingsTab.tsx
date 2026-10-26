import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Sun,
  Palette,
  Flame,
  Scale,
  Smartphone,
  QrCode,
  Copy,
  Check,
  RefreshCw,
  Share,
  PlusSquare,
  Sparkles,
  Info
} from 'lucide-react';
import { AppSettings, MaterialType } from '../types/filament';
import { ThemeBrightness, ThemeAccent, BRIGHTNESS_OPTIONS, ACCENT_OPTIONS } from '../types/theme';
import { MATERIAL_PRESETS, BRAND_DATABASE, DEFAULT_APP_SETTINGS } from '../data/defaultSpools';

interface SettingsTabProps {
  themeBrightness: ThemeBrightness;
  themeAccent: ThemeAccent;
  onSetBrightness: (b: ThemeBrightness) => void;
  onSetAccent: (a: ThemeAccent) => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  cloudDbUrl: string;
  onOpenPWAInstall: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  themeBrightness,
  themeAccent,
  onSetBrightness,
  onSetAccent,
  settings,
  onUpdateSettings,
  cloudDbUrl,
  onOpenPWAInstall
}) => {
  // Aktives Unter-Thema im Einstellungen-Tab: 'presets' | 'themes' | 'phone'
  const [subTab, setSubTab] = useState<'presets' | 'themes' | 'phone'>('presets');

  // Ausgewähltes Material für Trocknungseinstellungen
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialType>('PLA');

  // Ausgewählter Hersteller für Tara-Einstellungen
  const [selectedBrand, setSelectedBrand] = useState<string>('Bambu Lab');

  // QR-Code Canvas Ref
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [pairingUrl, setPairingUrl] = useState('');

  // QR-Code für Kopplung generieren
  useEffect(() => {
    const base = window.location.href.split('?')[0].split('#')[0];
    const url = `${base}?pairCloud=${encodeURIComponent(cloudDbUrl)}`;
    setPairingUrl(url);

    if (qrCanvasRef.current) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        url,
        {
          width: 180,
          margin: 2,
          color: {
            dark: '#0b111e',
            light: '#ffffff'
          }
        },
        err => {
          if (err) console.error(err);
        }
      );
    }
  }, [cloudDbUrl, subTab]);

  // Material-Werte für das aktuell ausgewählte Material
  const curMatConfig = settings.materialPresets[selectedMaterial] || MATERIAL_PRESETS[selectedMaterial];

  const handleUpdateMaterialField = (
    field: 'intervalDays' | 'temp' | 'hours',
    val: number
  ) => {
    const updated = {
      ...settings,
      materialPresets: {
        ...settings.materialPresets,
        [selectedMaterial]: {
          ...curMatConfig,
          [field]: val
        }
      }
    };
    onUpdateSettings(updated);
  };

  const handleResetMaterial = () => {
    const defaultPreset = MATERIAL_PRESETS[selectedMaterial];
    const updated = {
      ...settings,
      materialPresets: {
        ...settings.materialPresets,
        [selectedMaterial]: { ...defaultPreset }
      }
    };
    onUpdateSettings(updated);
  };

  // Hersteller-Werte für die aktuell ausgewählte Marke
  const defaultBrandInfo = BRAND_DATABASE.find(b => b.name === selectedBrand) || {
    tara: 200,
    defaultPrice: 19.99
  };
  const curBrandConfig = settings.brandPresets[selectedBrand] || {
    tara: defaultBrandInfo.tara,
    defaultPrice: defaultBrandInfo.defaultPrice
  };

  const handleUpdateBrandField = (field: 'tara' | 'defaultPrice', val: number) => {
    const updated = {
      ...settings,
      brandPresets: {
        ...settings.brandPresets,
        [selectedBrand]: {
          ...curBrandConfig,
          [field]: val
        }
      }
    };
    onUpdateSettings(updated);
  };

  const handleResetBrand = () => {
    const updated = {
      ...settings,
      brandPresets: {
        ...settings.brandPresets,
        [selectedBrand]: {
          tara: defaultBrandInfo.tara,
          defaultPrice: defaultBrandInfo.defaultPrice
        }
      }
    };
    onUpdateSettings(updated);
  };

  const handleUpdateEibosTara = (val: number) => {
    const updated = {
      ...settings,
      eibosBagTara: val
    };
    onUpdateSettings(updated);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(pairingUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Horizontale Unter-Reiterleiste für Einstellungen */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
        <button
          onClick={() => setSubTab('presets')}
          className={`flex-1 py-1.5 px-2 rounded-lg font-bold text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'presets'
              ? 'bg-orange-500 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
          <span>Material & Tara</span>
        </button>

        <button
          onClick={() => setSubTab('themes')}
          className={`flex-1 py-1.5 px-2 rounded-lg font-bold text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'themes'
              ? 'bg-orange-500 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Themes (5 Stufen)</span>
        </button>

        <button
          onClick={() => setSubTab('phone')}
          className={`flex-1 py-1.5 px-2 rounded-lg font-bold text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'phone'
              ? 'bg-orange-500 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
          <span>Handy & App</span>
        </button>
      </div>

      {/* SUBTAB 1: MATERIAL- & TARA-STANDARDS (MIT DROPDOWNS) */}
      {subTab === 'presets' && (
        <div className="space-y-4">
          {/* MATERIAL TROCKNUNGSZEITEN DROPDOWN */}
          <div className="rounded-xl bg-slate-950 border border-orange-500/30 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-orange-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5" />
                <span>Trocknungszeiten je Material</span>
              </span>
              <button
                onClick={handleResetMaterial}
                className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                title="Werkseinstellung für dieses Material wiederherstellen"
              >
                Reset Standard
              </button>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] text-slate-400">Material auswählen:</label>
              <select
                value={selectedMaterial}
                onChange={(e) => setSelectedMaterial(e.target.value as MaterialType)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-bold outline-none cursor-pointer focus:border-orange-500"
              >
                <option value="PLA">PLA (Polymilchsäure)</option>
                <option value="PLA+">PLA+ / PLA Pro</option>
                <option value="PETG">PETG (Polyethylen)</option>
                <option value="TPU">TPU (Flexibel)</option>
                <option value="ABS">ABS</option>
                <option value="ASA">ASA (UV-beständig)</option>
                <option value="PA / Nylon">PA / Nylon</option>
                <option value="PC">PC (Polycarbonat)</option>
                <option value="PET-CF / PA-CF">Carbon Fiber (CF)</option>
              </select>
            </div>

            {/* Konfigurierbare Werte für das gewählte Material */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <label className="block text-[10px] text-slate-400 mb-1">Intervall (Tage)</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={curMatConfig.intervalDays}
                  onChange={(e) => handleUpdateMaterialField('intervalDays', parseInt(e.target.value) || 30)}
                  className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono-num text-xs text-white outline-none focus:border-orange-500"
                />
              </div>

              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <label className="block text-[10px] text-slate-400 mb-1">Temp (°C)</label>
                <input
                  type="number"
                  min="30"
                  max="120"
                  value={curMatConfig.temp}
                  onChange={(e) => handleUpdateMaterialField('temp', parseInt(e.target.value) || 50)}
                  className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono-num text-xs text-white outline-none focus:border-orange-500"
                />
              </div>

              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <label className="block text-[10px] text-slate-400 mb-1">Dauer (h)</label>
                <input
                  type="number"
                  min="1"
                  max="48"
                  value={curMatConfig.hours}
                  onChange={(e) => handleUpdateMaterialField('hours', parseInt(e.target.value) || 5)}
                  className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono-num text-xs text-white outline-none focus:border-orange-500"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              Alle neuen Spulen und Trocknungsbalken greifen automatisch auf diese Vorgaben zu.
            </p>
          </div>

          {/* HERSTELLER TARA & KILOPREISE DROPDOWN */}
          <div className="rounded-xl bg-slate-950 border border-emerald-500/30 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5" />
                <span>Leerspulen-Gewicht (Tara) je Hersteller</span>
              </span>
              <button
                onClick={handleResetBrand}
                className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                title="Werkseinstellung für diesen Hersteller wiederherstellen"
              >
                Reset Standard
              </button>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] text-slate-400">Hersteller / Marke:</label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-bold outline-none cursor-pointer focus:border-emerald-500"
              >
                {BRAND_DATABASE.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name} (Tara: {settings.brandPresets[b.name]?.tara ?? b.tara} g)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <label className="block text-[10px] text-slate-400 mb-1">Leerspule Tara (g)</label>
                <input
                  type="number"
                  min="0"
                  max="600"
                  value={curBrandConfig.tara}
                  onChange={(e) => handleUpdateBrandField('tara', parseInt(e.target.value) || 0)}
                  className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono-num text-xs text-emerald-400 font-bold outline-none focus:border-emerald-500"
                />
              </div>

              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <label className="block text-[10px] text-slate-400 mb-1">Standardpreis (€/kg)</label>
                <input
                  type="number"
                  step="0.5"
                  value={curBrandConfig.defaultPrice}
                  onChange={(e) => handleUpdateBrandField('defaultPrice', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono-num text-xs text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* EIBOS VAKUUMBEUTEL TARA */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-white text-[11px] block">📦 Eibos-Vakuumbeutel Tara</span>
                <span className="text-[10px] text-slate-400">Wird bei Beutellagerung einbezogen</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.eibosBagTara}
                  onChange={(e) => handleUpdateEibosTara(parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono-num text-xs text-sky-400 font-bold text-center outline-none focus:border-sky-500"
                />
                <span className="text-[11px] text-slate-400 font-bold">g</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: DESIGN & 5 HELLIGKEITS-STUFEN */}
      {subTab === 'themes' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>5 Helligkeits-Themes</span>
              </span>
              <span className="text-[10px] font-mono-num text-orange-400 font-bold">
                {BRIGHTNESS_OPTIONS.find((b) => b.id === themeBrightness)?.name}
              </span>
            </div>

            <div className="space-y-2">
              {BRIGHTNESS_OPTIONS.map((opt) => {
                const isActive = themeBrightness === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => onSetBrightness(opt.id)}
                    className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition cursor-pointer text-left ${
                      isActive
                        ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/30'
                        : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-lg border border-white/20 flex items-center justify-center shadow-inner shrink-0"
                        style={{ backgroundColor: opt.bgHex }}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-md"
                          style={{ backgroundColor: opt.cardHex }}
                        />
                      </div>
                      <div>
                        <span className="font-bold text-white text-xs block">{opt.name}</span>
                        <span className="text-[10px] text-slate-400">{opt.subtitle}</span>
                      </div>
                    </div>
                    {isActive && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white">
                        Aktiv
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Akzentfarben */}
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 space-y-2.5">
            <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-sky-400" />
              <span>Akzent-Farbschema</span>
            </span>

            <div className="grid grid-cols-5 gap-1.5">
              {ACCENT_OPTIONS.map((acc) => {
                const isActive = themeAccent === acc.id;
                return (
                  <button
                    key={acc.id}
                    onClick={() => onSetAccent(acc.id)}
                    className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 text-center transition cursor-pointer ${
                      isActive
                        ? 'border-white bg-slate-800 ring-2 ring-white/20'
                        : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full shrink-0 shadow"
                      style={{ backgroundColor: acc.colorHex }}
                    />
                    <span className="text-[10px] font-semibold text-slate-300 truncate w-full">
                      {acc.name.split('-')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: SMARTPHONE-KOPPLUNG & APP-ANLEITUNG */}
      {subTab === 'phone' && (
        <div className="space-y-4">
          {/* VERBINDEN & QR-CODE */}
          <div className="rounded-xl bg-slate-950 border border-sky-500/30 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sky-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5" />
                <span>Smartphone-Kopplung (Live-Cloud)</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold">
                Aktiv
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="p-2 rounded-xl bg-white shadow shrink-0">
                <canvas ref={qrCanvasRef} className="rounded" />
              </div>
              <div className="space-y-1.5 text-center sm:text-left">
                <p className="text-xs text-slate-200 font-bold">
                  Mit Handykamera scannen
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Verbindet dein Smartphone sofort mit derselben Cloud-Datenbank wie dein PC.
                </p>
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Link kopiert!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Koppel-Link kopieren</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* SCHRITT-FÜR-SCHRITT ANLEITUNG FÜR DIE HANDY-APP */}
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 space-y-3">
            <span className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Anleitung: Als App auf dem Handy installieren</span>
            </span>

            {/* Apple iPhone / iPad */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
              <p className="font-bold text-white text-[11px] flex items-center gap-1">
                <span>🍏 Auf dem iPhone / iPad (Safari):</span>
              </p>
              <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px] pl-1">
                <li>
                  Öffne den Koppel-Link in <strong className="text-white">Safari</strong>.
                </li>
                <li>
                  Tippe unten in der Leiste auf das <strong className="text-orange-400">Teilen-Symbol</strong>{' '}
                  <Share className="w-3 h-3 inline text-sky-400" />.
                </li>
                <li>
                  Scrolle etwas nach unten und tippe auf{' '}
                  <strong className="text-emerald-400">„Zum Home-Bildschirm“</strong>{' '}
                  <PlusSquare className="w-3 h-3 inline text-emerald-400" />.
                </li>
                <li>
                  Tippe oben rechts auf <strong className="text-orange-400">„Hinzufügen“</strong>.
                </li>
              </ol>
            </div>

            {/* Android */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
              <p className="font-bold text-white text-[11px] flex items-center gap-1">
                <span>🤖 Auf Android (Chrome / Firefox):</span>
              </p>
              <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px] pl-1">
                <li>
                  Tippe oben rechts auf die <strong className="text-white">drei Punkte ⋮</strong>.
                </li>
                <li>
                  Wähle <strong className="text-emerald-400">„App installieren“</strong> oder{' '}
                  <strong className="text-emerald-400">„Zum Startbildschirm hinzufügen“</strong>.
                </li>
                <li>
                  Oder tippe unten direkt auf den Button:
                </li>
              </ol>
              <button
                onClick={onOpenPWAInstall}
                className="w-full mt-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
              >
                Installations-Assistent starten
              </button>
            </div>

            {/* Foto-Erklärung */}
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
              <span>
                <strong>Tipp:</strong> Sobald die App installiert ist, tippe oben auf <strong>„Foto-Erkennung“</strong>, um Spulen direkt im Regal per Handykamera zu erfassen.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
