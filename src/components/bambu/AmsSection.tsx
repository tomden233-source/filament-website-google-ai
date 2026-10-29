import React, { useState } from 'react';
import { Box, RefreshCw, Droplets, Sun, Square, Nfc, AlertTriangle } from 'lucide-react';
import { safeStorage } from '../../utils/safeStorage';
import { addSystemLog } from '../../utils/logService';
import type { PrinterExpandedPanelProps as ParentProps } from './PrinterExpandedPanel';
import { readTrays, readExternal, activeSlotFromPrinter, syncSlots, mismatch, EXTERNAL_SLOT } from '../../utils/amsMatch';
import { SpoolPicker } from '../SpoolPicker';
import { SlotTagSheet } from './SlotTagSheet';

export interface AmsSectionProps {
  compact?: boolean;
  setAmsSlots: ParentProps['setAmsSlots'];
  setActionToast: ParentProps['setActionToast'];
  activeSlot: ParentProps['activeSlot'];
  amsSlots: ParentProps['amsSlots'];
  spools: ParentProps['spools'];
  liveState: ParentProps['liveState'];
  handleSetActiveSlot: ParentProps['handleSetActiveSlot'];
  setEditingAmsSlot: ParentProps['setEditingAmsSlot'];
  setAmsEditColor: ParentProps['setAmsEditColor'];
  setAmsEditMaterial: ParentProps['setAmsEditMaterial'];
  handleSetAmsSlot: ParentProps['handleSetAmsSlot'];
  onApplyDryingCredit: ParentProps['onApplyDryingCredit'];
  amsDryTemp: ParentProps['amsDryTemp'];
  isDryingActive: ParentProps['isDryingActive'];
  getHumidityDisplay: ParentProps['getHumidityDisplay'];
  calcRemainingTime: ParentProps['calcRemainingTime'];
  setAmsDryHours: ParentProps['setAmsDryHours'];
  amsDryHours: ParentProps['amsDryHours'];
  setAmsDryTemp: ParentProps['setAmsDryTemp'];
  handleToggleAmsDrying: ParentProps['handleToggleAmsDrying'];
  dryLoading: ParentProps['dryLoading'];
}

export const AmsSection: React.FC<AmsSectionProps> = ({
  compact = false,
  setAmsSlots,
  setActionToast,
  activeSlot,
  amsSlots,
  spools,
  liveState,
  handleSetAmsSlot,
  amsDryTemp,
  isDryingActive,
  getHumidityDisplay,
  calcRemainingTime,
  setAmsDryHours,
  amsDryHours,
  setAmsDryTemp,
  handleToggleAmsDrying,
  dryLoading
}) => {
  const connected = Boolean(liveState.connected);
  const [pickSlot, setPickSlot] = useState<number | null>(null);
  const [tagSlot, setTagSlot] = useState<number | null>(null);
  const trays = connected ? readTrays(liveState.data.ams) : [];
  const ext = connected ? readExternal(liveState.data.vt_tray) : null;
  const hasHw = trays.length > 0;
  const printerActive = connected ? activeSlotFromPrinter(liveState.data.ams) : null;
  const shownActive = printerActive ?? activeSlot;

  // Echter Abgleich: Slots laut Drucker (Material + Farbe) → passende eigene Spulen
  const syncWithPrinter = () => {
    if (!connected) {
      setActionToast({ text: 'Drucker ist nicht verbunden. Erst verbinden, dann synchronisieren.', ok: false });
      return;
    }
    if (!hasHw) {
      setActionToast({ text: 'Der Drucker hat noch keine AMS-Daten geschickt. Kurz warten und nochmal tippen.', ok: false });
      return;
    }
    const { slots, lines: rawLines } = syncSlots(spools, ext ? [...trays, ext] : trays, amsSlots);
    const lines = rawLines.map(l => l.replace(/^Slot 5:/, 'Extern:'));
    setAmsSlots(slots);
    safeStorage.setItem('filamenthub_ams_slots_x2d', JSON.stringify(slots));
    window.dispatchEvent(new CustomEvent('filamenthub_drying_update', { detail: { sync: true } }));
    setActionToast({ text: 'Mit Drucker synchronisiert. ' + lines.join(' · '), ok: true });
    addSystemLog('drucker', 'AMS-Slots mit dem Drucker synchronisiert', lines.join(', '), 'success');
  };

  return (
<div className="space-y-3 pt-1">
            <div className="flex justify-between items-center text-xs flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                  <Box className="w-4 h-4 text-[#00AE42]" />
                  <span>{compact ? 'AMS:' : 'AMS Slots (Bambu Lab X2D):'}</span>
                </span>
                <button
                  type="button"
                  onClick={syncWithPrinter}
                  className="px-2 py-0.5 rounded-lg border border-[#00AE42]/40 bg-[#00AE42]/15 text-[#00AE42] hover:bg-[#00AE42]/25 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                  title="Liest Material und Farbe jedes Slots vom Drucker und ordnet deine passenden Spulen zu"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Mit Drucker synchronisieren</span>
                </button>
              </div>
            </div>

            {/* 4 AMS-Slots: nur Slot, Farbe, Hersteller und Material. Tippen = Spule wählen, Tag-Symbol = Tag lesen. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map(slotIdx => {
                const spool = spools.find(s => s.id === (amsSlots[slotIdx] || ''));
                const hw = trays.find(t => t.slot === slotIdx);
                const isActive = shownActive === slotIdx;
                const hwFilled = Boolean(hw && !hw.empty);
                const wrongSpool = mismatch(spool, hw);

                // Farbe, Hersteller, Material: laut Drucker, wenn dort Filament steckt; sonst die zugewiesene Spule
                const color = hwFilled ? hw!.colorHex || '#888888' : spool?.colorHex || null;
                const brand = spool ? spool.brand : hwFilled ? hw!.brand || '–' : '';
                const material = hwFilled ? hw!.type : spool ? spool.material : '';
                const missingInAms = Boolean(hw?.empty && spool); // Spule zugewiesen, aber Slot ist laut Drucker leer
                const emptyAll = !color && !brand && !material;

                return (
                  <div
                    key={slotIdx}
                    onClick={() => setPickSlot(slotIdx)}
                    title={wrongSpool ? `Zugewiesene Spule passt nicht zum Slot (${spool?.material}). Tippe auf „Mit Drucker synchronisieren“.` : 'Spule für diesen Slot wählen'}
                    className={`relative rounded-xl border px-2 py-1.5 flex items-center gap-2 cursor-pointer transition active:scale-[0.98] ${
                      isActive ? 'ring-2 ring-[#00AE42]/80' : ''
                    } ${missingInAms || emptyAll ? 'border-dashed' : ''}`}
                    style={{
                      backgroundColor: 'var(--app-card-sub)',
                      borderColor: color && !emptyAll ? `${color}90` : 'var(--app-border)',
                      opacity: missingInAms ? 0.75 : 1
                    }}
                  >
                    <span
                      className="w-5 h-5 rounded-full border border-black/30 shadow-sm shrink-0"
                      style={color ? { backgroundColor: color } : { border: '1px dashed var(--app-border)' }}
                    />
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="text-[11px] font-extrabold flex items-center gap-1" style={{ color: 'var(--app-text)' }}>
                        Slot {slotIdx}
                        {wrongSpool && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                      </div>
                      <div className="text-[10px] truncate" style={{ color: 'var(--app-text-muted)' }}>
                        {emptyAll ? 'leer' : `${brand}${brand && material ? ' · ' : ''}${material}`}
                        {missingInAms ? ' · leer im AMS' : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setTagSlot(slotIdx);
                      }}
                      aria-label={`NFC-Tag für Slot ${slotIdx} lesen`}
                      title="Tag lesen und diesem Slot zuweisen"
                      className="w-7 h-7 rounded-full border flex items-center justify-center shrink-0 cursor-pointer active:scale-90"
                      style={{ borderColor: 'var(--app-accent)', color: 'var(--app-accent-text)', backgroundColor: 'var(--app-accent-sub)' }}
                    >
                      <Nfc className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* 5. Spule: extern (Spulenhalter hinten). Zählt NICHT zum AMS und steht nicht in der AMS-Trocknung. */}
            {(() => {
              const spool = spools.find(s => s.id === (amsSlots[EXTERNAL_SLOT] || ''));
              const hwFilled = Boolean(ext && !ext.empty);
              const color = hwFilled ? ext!.colorHex || '#888888' : spool?.colorHex || null;
              const brand = spool ? spool.brand : hwFilled ? ext!.brand || '–' : '';
              const material = hwFilled ? ext!.type : spool ? spool.material : '';
              const emptyAll = !color && !brand && !material;
              const isActive = shownActive === EXTERNAL_SLOT;
              const wrong = mismatch(spool, ext || undefined);
              return (
                <div
                  onClick={() => setPickSlot(EXTERNAL_SLOT)}
                  title="Externe Spule (nicht im AMS). Tippen = Spule wählen"
                  className={`rounded-xl border px-2 py-1.5 flex items-center gap-2 cursor-pointer transition active:scale-[0.98] ${isActive ? 'ring-2 ring-[#00AE42]/80' : ''} ${emptyAll ? 'border-dashed' : ''}`}
                  style={{ backgroundColor: 'var(--app-card-sub)', borderColor: color && !emptyAll ? `${color}90` : 'var(--app-border)' }}
                >
                  <span
                    className="w-5 h-5 rounded-full border border-black/30 shadow-sm shrink-0"
                    style={color ? { backgroundColor: color } : { border: '1px dashed var(--app-border)' }}
                  />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="text-[11px] font-extrabold flex items-center gap-1" style={{ color: 'var(--app-text)' }}>
                      Extern (5. Spule)
                      {wrong && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                    </div>
                    <div className="text-[10px] truncate" style={{ color: 'var(--app-text-muted)' }}>
                      {emptyAll ? 'leer' : `${brand}${brand && material ? ' · ' : ''}${material}`} · nicht im AMS
                    </div>
                  </div>
                </div>
              );
            })()}

            {pickSlot !== null && (
              <SpoolPicker
                spools={spools}
                title={pickSlot === EXTERNAL_SLOT ? 'Spule für Extern (5.)' : `Spule für Slot ${pickSlot}`}
                selectedId={amsSlots[pickSlot] || ''}
                allowClear
                hint={(() => {
                  const t = pickSlot === EXTERNAL_SLOT ? ext : trays.find(x => x.slot === pickSlot);
                  return t && !t.empty ? { material: t.type, colorHex: t.colorHex || undefined } : undefined;
                })()}
                onClose={() => setPickSlot(null)}
                onPick={s => {
                  const slot = pickSlot;
                  setPickSlot(null);
                  handleSetAmsSlot(slot, s ? s.id : '');
                }}
              />
            )}
            {tagSlot !== null && (
              <SlotTagSheet
                slot={tagSlot}
                spools={spools}
                tray={trays.find(t => t.slot === tagSlot)}
                connected={connected}
                onAssign={(slot, spoolId) => handleSetAmsSlot(slot, spoolId)}
                onClose={() => setTagSlot(null)}
              />
            )}

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
                        : 'bg-[var(--app-card-sub)] text-[var(--app-text-muted)] border-[var(--app-border)]'
                    }`}
                  >
                    {isDryingActive ? '🔥 Trocknung aktiv' : 'Inaktiv (Standby)'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-[var(--app-text-muted)] font-mono">
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
                        amsDryHours === hrs ? 'bg-sky-500/25 border-sky-400 text-sky-300' : 'border-[var(--app-border)] text-[var(--app-text-muted)]'
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
                        amsDryTemp === t.val ? 'bg-amber-500/25 border-amber-400 text-amber-300' : 'border-[var(--app-border)] text-[var(--app-text-muted)]'
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
  );
};
