import React, { useState, useEffect } from 'react';
import { X, Flame, ExternalLink, Zap, Settings2, Check, Scale } from 'lucide-react';
import { AppSettings, MaterialType, Spool } from '../types/filament';
import { BRAND_DATABASE, MATERIAL_PRESETS } from '../data/defaultSpools';
import { COMMON_LOCATIONS } from '../utils/spoolAlerts';
import { getBambuProfile } from '../data/bambuParameters';
import { findHexForColorName, generateAutoShopUrl, getBrandInfo, parseFilamentText } from '../utils/shopLinks';

interface SpoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (spool: Spool) => void;
  spoolToEdit: Spool | null;
  prefillData?: Partial<Spool> | null;
  appSettings?: AppSettings;
  locationOptions?: string[];
}

const COMMON_COLORS = [
  { name: 'Schwarz', hex: '#111827' },
  { name: 'Weiß', hex: '#f8fafc' },
  { name: 'Grau', hex: '#64748b' },
  { name: 'Rot', hex: '#ef4444' },
  { name: 'Blau', hex: '#3b82f6' },
  { name: 'Grün', hex: '#10b981' },
  { name: 'Gelb', hex: '#eab308' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Lila', hex: '#8b5cf6' },
  { name: 'Silber', hex: '#94a3b8' }
];

const POPULAR_BRANDS = ['Bambu Lab', 'SUNLU', 'eSun', 'Extrudr', 'Prusa', 'Anycubic'];
const POPULAR_MATERIALS: MaterialType[] = ['PLA', 'PETG', 'TPU', 'ABS', 'ASA', 'PC'];

export const SpoolModal: React.FC<SpoolModalProps> = ({
  isOpen,
  onClose,
  onSave,
  spoolToEdit,
  prefillData,
  appSettings,
  locationOptions = []
}) => {
  const [modalTab, setModalTab] = useState<'quick' | 'detail'>('quick');

  const [brand, setBrand] = useState('Bambu Lab');
  const [isOtherBrand, setIsOtherBrand] = useState(false);
  const [customBrand, setCustomBrand] = useState('');
  const [name, setName] = useState('');
  const [material, setMaterial] = useState<MaterialType>('PLA');
  const [colorName, setColorName] = useState('Schwarz');
  const [colorHex, setColorHex] = useState('#111827');
  const [pricePerKg, setPricePerKg] = useState(19.99);
  const [initialWeight, setInitialWeight] = useState(1000);
  const [remainingWeight, setRemainingWeight] = useState(1000);
  const [emptySpoolWeight, setEmptySpoolWeight] = useState(250);
  const [storageNote, setStorageNote] = useState('');
  const [location, setLocation] = useState('');
  const [nozzleTemp, setNozzleTemp] = useState('');
  const [bedTemp, setBedTemp] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [dryIntervalDays, setDryIntervalDays] = useState(30);
  const [dryTemp, setDryTemp] = useState(50);
  const [dryHours, setDryHours] = useState(5);
  const [lastDried, setLastDried] = useState(new Date().toISOString().slice(0, 16));
  const [scaleGross, setScaleGross] = useState('');
  const [weighedWithEibos, setWeighedWithEibos] = useState<boolean>(false);

  const eibosTara = appSettings?.eibosBagTara ?? 35;

  useEffect(() => {
    if (!isOpen) return;

    if (spoolToEdit) {
      setBrand(spoolToEdit.brand);
      const isKnown = BRAND_DATABASE.some(b => b.name === spoolToEdit.brand);
      setIsOtherBrand(!isKnown);
      setCustomBrand(isKnown ? '' : spoolToEdit.brand);
      setName(spoolToEdit.name);
      setMaterial(spoolToEdit.material);
      setColorName(spoolToEdit.colorName);
      setColorHex(spoolToEdit.colorHex);
      setPricePerKg(spoolToEdit.pricePerKg);
      setInitialWeight(spoolToEdit.initialWeight);
      setRemainingWeight(spoolToEdit.remainingWeight);
      setEmptySpoolWeight(spoolToEdit.emptySpoolWeight);
      setStorageNote(spoolToEdit.storageNote || '');
      setLocation(spoolToEdit.location || '');
      setNozzleTemp(spoolToEdit.nozzleTemp ? String(spoolToEdit.nozzleTemp) : '');
      setBedTemp(spoolToEdit.bedTemp ? String(spoolToEdit.bedTemp) : '');
      setProductUrl(spoolToEdit.productUrl || '');
      setDryIntervalDays(spoolToEdit.dryIntervalDays);
      setDryTemp(spoolToEdit.dryTemp);
      setDryHours(spoolToEdit.dryHours);
      setLastDried(spoolToEdit.lastDried ? spoolToEdit.lastDried.slice(0, 16) : new Date().toISOString().slice(0, 16));
      setScaleGross('');
      setWeighedWithEibos((spoolToEdit.storageNote || '').toLowerCase().includes('eibos'));
      setModalTab('quick');
    } else {
      const p = prefillData || {};
      const defBrand = p.brand || 'Bambu Lab';
      setBrand(defBrand);
      setIsOtherBrand(false);
      setCustomBrand('');
      setName(p.name || '');
      const mat = p.material || 'PLA';
      setMaterial(mat);
      setColorName(p.colorName || 'Schwarz');
      setColorHex(p.colorHex || '#111827');
      const bInfo = getBrandInfo(defBrand, appSettings);
      setPricePerKg(p.pricePerKg || bInfo.defaultPrice || 19.99);
      setInitialWeight(p.initialWeight || 1000);
      setRemainingWeight(p.remainingWeight || 1000);
      setEmptySpoolWeight(p.emptySpoolWeight !== undefined ? p.emptySpoolWeight : bInfo.tara);
      setStorageNote(p.storageNote || '');
      setLocation(p.location || '');
      setNozzleTemp(p.nozzleTemp ? String(p.nozzleTemp) : '');
      setBedTemp(p.bedTemp ? String(p.bedTemp) : '');
      setProductUrl(p.productUrl || '');
      const preset = appSettings?.materialPresets[mat] || MATERIAL_PRESETS[mat] || MATERIAL_PRESETS['PLA'];
      setDryIntervalDays(p.dryIntervalDays || preset.intervalDays);
      setDryTemp(p.dryTemp || preset.temp);
      setDryHours(p.dryHours || preset.hours);
      setLastDried(new Date().toISOString().slice(0, 16));
      setScaleGross('');
      setWeighedWithEibos((p.storageNote || '').toLowerCase().includes('eibos'));
      setModalTab('quick');
    }
  }, [isOpen, spoolToEdit, prefillData, appSettings]);

  if (!isOpen) return null;

  const handleBrandChange = (val: string) => {
    if (val === 'OTHER') {
      setIsOtherBrand(true);
      setBrand('Sonstige');
    } else {
      setIsOtherBrand(false);
      setBrand(val);
      const info = getBrandInfo(val, appSettings);
      setEmptySpoolWeight(info.tara);
      setPricePerKg(info.defaultPrice);
    }
  };

  const handleMaterialChange = (mat: MaterialType) => {
    setMaterial(mat);
    const p = appSettings?.materialPresets[mat] || MATERIAL_PRESETS[mat];
    if (p) {
      setDryIntervalDays(p.intervalDays);
      setDryTemp(p.temp);
      setDryHours(p.hours);
    }
  };

  const handleColorPick = (col: { name: string; hex: string }) => {
    setColorName(col.name);
    setColorHex(col.hex);
  };

  const handleScaleGrossChange = (val: string, withEibos = weighedWithEibos) => {
    setScaleGross(val);
    const gross = parseFloat(val);
    const effectiveTara = emptySpoolWeight + (withEibos ? eibosTara : 0);
    if (!isNaN(gross) && gross >= effectiveTara) {
      setRemainingWeight(Math.round(gross - effectiveTara));
    }
  };

  const handleScanUrl = () => {
    if (!productUrl.trim()) return;
    const parsed = parseFilamentText(productUrl.trim());
    if (parsed.brand) {
      setBrand(parsed.brand);
      setIsOtherBrand(!BRAND_DATABASE.some(b => b.name === parsed.brand));
    }
    if (parsed.name) setName(parsed.name);
    if (parsed.material) handleMaterialChange(parsed.material);
    if (parsed.colorName) setColorName(parsed.colorName);
    if (parsed.colorHex) setColorHex(parsed.colorHex);
    if (parsed.emptySpoolWeight !== undefined) setEmptySpoolWeight(parsed.emptySpoolWeight);
    if (parsed.pricePerKg) setPricePerKg(parsed.pricePerKg);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalBrand = isOtherBrand ? (customBrand.trim() || 'Sonstige') : brand;
    const finalSpool: Spool = {
      id: spoolToEdit ? spoolToEdit.id : 'sp-' + Date.now(),
      brand: finalBrand,
      name: name.trim() || `${material} Basic ${colorName || 'Filament'}`,
      material,
      colorName: colorName.trim() || 'Standard',
      colorHex,
      pricePerKg: Number(pricePerKg) || 19.99,
      initialWeight: Number(initialWeight) || 1000,
      remainingWeight: Number(remainingWeight) || 0,
      emptySpoolWeight: Number(emptySpoolWeight) || 0,
      storageNote: storageNote.trim(),
      location: location.trim() || undefined,
      nozzleTemp: Number(nozzleTemp) > 0 ? Number(nozzleTemp) : undefined,
      bedTemp: Number(bedTemp) > 0 ? Number(bedTemp) : undefined,
      productUrl: productUrl.trim(),
      lastDried: lastDried ? new Date(lastDried).toISOString() : new Date().toISOString(),
      dryIntervalDays: Number(dryIntervalDays) || 30,
      dryTemp: Number(dryTemp) || 50,
      dryHours: Number(dryHours) || 5
    };
    onSave(finalSpool);
  };

  const currentShopUrl = productUrl.trim() || generateAutoShopUrl(brand, material, name, colorName);

  return (
    <div
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
    >
      <div
        className="rounded-2xl max-w-lg w-[calc(100vw-1.5rem)] p-4 sm:p-5 space-y-3.5 shadow-2xl my-auto max-h-[90vh] overflow-y-auto border"
        style={{
          backgroundColor: 'var(--app-card)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-text)'
        }}
      >
        {/* Header & Tabs */}
        <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--app-border)' }}>
          <div>
            <h3 className="text-base sm:text-lg font-bold">
              {spoolToEdit ? 'Spule bearbeiten' : 'Spule eintragen'}
            </h3>
            <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
              In Sekunden gespeichert
            </p>
          </div>

          <div className="flex items-center gap-1">
            {/* Toggle Schnell vs Detail */}
            <div className="flex p-0.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setModalTab('quick')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                  modalTab === 'quick' ? 'bg-orange-500 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Schnell</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab('detail')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                  modalTab === 'detail' ? 'bg-orange-500 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Details</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer ml-1"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* ============================================================== */}
          {/* TAB 1: SCHNELLEINTRAG (SUPER EINFACH)                           */}
          {/* ============================================================== */}
          {modalTab === 'quick' && (
            <div className="space-y-3 text-xs">
              {/* 1. Marke Schnellauswahl */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  1. Marke / Hersteller:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_BRANDS.map(b => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => handleBrandChange(b)}
                      className={`px-2.5 py-1.5 rounded-xl font-bold transition cursor-pointer border ${
                        brand === b && !isOtherBrand
                          ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleBrandChange('OTHER')}
                    className={`px-2.5 py-1.5 rounded-xl font-bold transition cursor-pointer border ${
                      isOtherBrand
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    + Andere
                  </button>
                </div>
                {isOtherBrand && (
                  <input
                    type="text"
                    placeholder="Herstellername eingeben..."
                    value={customBrand}
                    onChange={e => setCustomBrand(e.target.value)}
                    className="w-full mt-1.5 px-3 py-1.5 rounded-xl text-xs bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-orange-500"
                  />
                )}
              </div>

              {/* 2. Material Schnellauswahl */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  2. Material:
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {POPULAR_MATERIALS.map(mat => (
                    <button
                      key={mat}
                      type="button"
                      onClick={() => handleMaterialChange(mat)}
                      className={`py-1.5 rounded-xl font-bold transition cursor-pointer border text-center ${
                        material === mat
                          ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {mat}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Farbe Schnellauswahl */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[11px] font-bold text-slate-300">
                    3. Farbe ({colorName}):
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-4 h-4 rounded-full border border-white/30 shrink-0"
                      style={{ backgroundColor: colorHex }}
                    />
                    <input
                      type="color"
                      value={colorHex}
                      onChange={e => setColorHex(e.target.value)}
                      className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {COMMON_COLORS.map(col => {
                    const isSelected = colorHex.toLowerCase() === col.hex.toLowerCase();
                    return (
                      <button
                        key={col.name}
                        type="button"
                        onClick={() => handleColorPick(col)}
                        className={`p-1.5 rounded-xl border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          isSelected
                            ? 'border-orange-500 bg-orange-500/20'
                            : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                          style={{ backgroundColor: col.hex }}
                        />
                        <span className="text-[10px] font-semibold text-slate-200 truncate">
                          {col.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bezeichnung Eingabe */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Bezeichnung / Name:
                </label>
                <input
                  type="text"
                  placeholder={`z.B. ${brand} ${material} ${colorName}`}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl text-xs bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* 4. Gewicht & Tara-Waage */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                    <Scale className="w-3.5 h-3.5 text-orange-400" />
                    <span>4. Netto-Filament ({remainingWeight}g Rest)</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Leerspule: {emptySpoolWeight}g</span>
                </div>

                <div className="flex gap-1.5">
                  {[1000, 750, 500, 250].map(w => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => {
                        setInitialWeight(w);
                        setRemainingWeight(w);
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-mono-num font-bold border transition cursor-pointer text-center ${
                        remainingWeight === w
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-slate-950 text-slate-300 border-slate-700'
                      }`}
                    >
                      {w}g
                    </button>
                  ))}
                </div>

                {/* Optional mit Küchenwaage gewogen */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                  <span className="text-[11px] text-slate-400">Oder Brutto auf Waage:</span>
                  <input
                    type="number"
                    placeholder="z.B. 1250g"
                    value={scaleGross}
                    onChange={e => handleScaleGrossChange(e.target.value)}
                    className="w-24 px-2.5 py-1 rounded-lg text-xs font-mono-num bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-orange-500 text-center"
                  />
                  <span className="text-[11px] text-emerald-400 font-mono-num font-bold">
                    = {remainingWeight}g Netto
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: ALLE DETAILS (SHOP, TROCKNUNG, SLICER-WERTE)             */}
          {/* ============================================================== */}
          {modalTab === 'detail' && (
            <div className="space-y-3 text-xs">
              {/* Shop-Link */}
              <div className="rounded-xl border border-orange-500/30 p-2.5 space-y-1.5 bg-slate-900/60">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-orange-400 uppercase">
                    Shop-Link zum Nachbestellen:
                  </label>
                  <a
                    href={currentShopUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-sky-400 hover:underline flex items-center gap-1"
                  >
                    <span>Link testen</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="url"
                    placeholder="Leer lassen für automatischen Shop-Link"
                    value={productUrl}
                    onChange={e => setProductUrl(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg text-xs bg-slate-950 border border-slate-700 text-white outline-none focus:border-orange-500"
                  />
                  <button
                    type="button"
                    onClick={handleScanUrl}
                    className="px-3 py-1.5 rounded-lg text-white font-bold bg-orange-500 hover:bg-orange-600 transition"
                  >
                    Auslesen
                  </button>
                </div>
              </div>

              {/* Preis & Gewichte Detail */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Preis (€/kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={pricePerKg}
                    onChange={e => setPricePerKg(parseFloat(e.target.value) || 19.99)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Leerspule (g)</label>
                  <input
                    type="number"
                    value={emptySpoolWeight}
                    onChange={e => setEmptySpoolWeight(parseInt(e.target.value) || 200)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Startgewicht (g)</label>
                  <input
                    type="number"
                    value={initialWeight}
                    onChange={e => setInitialWeight(parseInt(e.target.value) || 1000)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono-num"
                  />
                </div>
              </div>

              {/* Trocknungsprozess */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Flame className="w-4 h-4" />
                    <span>Trocknung & Haltbarkeit</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setLastDried(new Date().toISOString().slice(0, 16))}
                    className="text-[10px] text-orange-400 hover:underline cursor-pointer"
                  >
                    Auf „Jetzt getrocknet“ setzen
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Intervall (Tage)</label>
                    <input
                      type="number"
                      value={dryIntervalDays}
                      onChange={e => setDryIntervalDays(parseInt(e.target.value) || 30)}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white font-mono-num text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Temp (°C)</label>
                    <input
                      type="number"
                      value={dryTemp}
                      onChange={e => setDryTemp(parseInt(e.target.value) || 50)}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white font-mono-num text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Dauer (Std.)</label>
                    <input
                      type="number"
                      value={dryHours}
                      onChange={e => setDryHours(parseInt(e.target.value) || 5)}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white font-mono-num text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Material-Profil: beste Temperaturen, werden beim Einlegen ins AMS vorgeschlagen */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-sky-400">Beste Druck-Temperaturen (Profil)</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Düse (°C)</label>
                    <input
                      type="number"
                      placeholder={String(getBambuProfile(isOtherBrand ? customBrand || 'Sonstige' : brand, material).nozzleTempOtherLayers)}
                      value={nozzleTemp}
                      onChange={e => setNozzleTemp(e.target.value)}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white font-mono-num text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Bett (°C)</label>
                    <input
                      type="number"
                      placeholder={String(getBambuProfile(isOtherBrand ? customBrand || 'Sonstige' : brand, material).bedTempTexturedPEI)}
                      value={bedTemp}
                      onChange={e => setBedTemp(e.target.value)}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white font-mono-num text-xs"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">Leer lassen = Standardwert des Materials. Trocknungszeit und -temperatur stehen oben.</p>
              </div>

              {/* Lagerort */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Lagerort:</label>
                <input
                  type="text"
                  list="spool-location-options"
                  placeholder="z.B. Regal 2, Box, Trockner"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                />
                <datalist id="spool-location-options">
                  {Array.from(new Set([...locationOptions, ...COMMON_LOCATIONS])).map(l => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {Array.from(new Set([...locationOptions, ...COMMON_LOCATIONS])).slice(0, 8).map(l => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLocation(l)}
                      className="px-2 py-0.5 rounded-lg border text-[10px] font-bold cursor-pointer bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lagerort / Notiz */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Lagerort / Notiz / NFC-Tag:</label>
                <input
                  type="text"
                  placeholder="z.B. Box 3, Vakuumbeutel, NFC Tag #2"
                  value={storageNote}
                  onChange={e => setStorageNote(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                />
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--app-border)' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer border bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 transition"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-lg cursor-pointer transition bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-700"
            >
              {spoolToEdit ? 'Änderungen speichern' : 'Spule jetzt anlegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
