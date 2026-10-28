import React from 'react';
import { Box, RefreshCw, Edit3, Droplets, Sun, Square } from 'lucide-react';
import { safeStorage } from '../../utils/safeStorage';
import { addSystemLog } from '../../utils/logService';
import type { PrinterExpandedPanelProps as ParentProps } from './PrinterExpandedPanel';
import { printerApi } from '../../api';
import { getSpoolProfile } from '../../utils/spoolProfile';
import { readTrays, activeSlotFromPrinter, syncSlots, mismatch } from '../../utils/amsMatch';

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
  handleSetActiveSlot,
  setEditingAmsSlot,
  setAmsEditColor,
  setAmsEditMaterial,
  handleSetAmsSlot,
  onApplyDryingCredit,
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
  const trays = connected ? readTrays(liveState.data.ams) : [];
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
    const { slots, lines } = syncSlots(spools, trays, amsSlots);
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
              <span className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                {printerActive ? 'Druckt aus' : 'Aktiver Slot'}: <strong>Slot {shownActive}</strong>
              </span>
            </div>

            {/* 4 AMS Slots mit physischer Telemetrie unter jedem Slot */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {[1, 2, 3, 4].map(slotIdx => {
                const effectiveSpoolId = amsSlots[slotIdx] || '';
                const spool = spools.find(s => s.id === effectiveSpoolId);
                const isActive = shownActive === slotIdx;

                // Daten laut Drucker (nur wenn verbunden). Die Farbe kommt dann immer vom Drucker, nicht aus der Zuweisung.
                const hw = trays.find(t => t.slot === slotIdx);
                const rawHwColor = hw?.colorHex ? hw.colorHex.slice(1) : '';
                const hwType = hw && !hw.empty ? hw.type : '';
                const isSlotEmpty = hw ? hw.empty : !spool;
                const wrongSpool = mismatch(spool, hw);

                const slotColorHex = hw ? (hw.empty ? null : hw.colorHex || '#888888') : spool?.colorHex || null;
                const slotTitle = hw
                  ? hw.empty
                    ? 'Leer (laut Drucker)'
                    : `${hw.brand || hwType}`
                  : spool
                  ? `${spool.brand} ${spool.name}`
                  : 'Keine Spule zugewiesen';
                const slotSub = hw
                  ? hw.empty
                    ? 'Keine Spule im Slot'
                    : `${hwType}${slotColorHex ? ' · ' + slotColorHex.toUpperCase() : ''}${hw.remain != null && hw.remain >= 0 ? ` · ${hw.remain}%` : ''}`
                  : connected
                  ? 'Warte auf Daten vom Drucker …'
                  : 'Drucker offline · zeigt deine Zuweisung';

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

                    {/* Profil-Vorschlag: beste Temperaturen der Spule an den Slot schicken */}
                    {spool && liveState.connected && (() => {
                      const prof = getSpoolProfile(spool);
                      return (
                        <button
                          type="button"
                          onClick={async e => {
                            e.stopPropagation();
                            try {
                              const res = await printerApi.amsFilament({
                                slotIdx: slotIdx - 1,
                                colorHex: prof.colorHex.replace('#', ''),
                                material: prof.material,
                                minTemp: prof.minTemp,
                                maxTemp: prof.maxTemp
                              });
                              setActionToast({
                                text: res.ok && res.data?.success !== false
                                  ? `Slot ${slotIdx}: ${spool.name} (${prof.minTemp}-${prof.maxTemp} °C) an den Drucker gesendet.`
                                  : (res.data?.error || 'Drucker hat den Befehl abgelehnt (Entwicklermodus nötig?).'),
                                ok: res.ok && res.data?.success !== false
                              });
                            } catch {
                              setActionToast({ text: 'Verbindungsfehler zum Drucker.', ok: false });
                            }
                          }}
                          className="w-full px-2 py-1 rounded-lg border border-[#00AE42]/40 bg-[#00AE42]/10 hover:bg-[#00AE42]/20 text-[10px] font-bold text-[#00AE42] cursor-pointer text-left"
                          title="Farbe, Material und Temperaturbereich dieser Spule an den Slot senden"
                        >
                          📡 Profil senden: {prof.material} {prof.minTemp}-{prof.maxTemp} °C · Bett {prof.bedTemp} °C{prof.custom ? ' (eigenes Profil)' : ''}
                        </button>
                      );
                    })()}

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

                    {/* WAS DER DRUCKER IN DIESEM SLOT MELDET */}
                    <div className="p-2 rounded-xl border border-white/10 bg-black/20 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-slate-400">{hw ? 'Laut Drucker:' : 'Drucker:'}</span>
                        <span className="font-mono text-[9.5px] text-slate-500">
                          {hw && !hw.empty && hw.minTemp ? `${hw.minTemp}-${hw.maxTemp}°` : ''}
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
                            {slotTitle}
                          </span>
                          <span className="font-mono text-[9.5px] block text-slate-400 truncate">{slotSub}</span>
                        </div>
                      </div>
                      {wrongSpool && (
                        <p className="text-[10px] font-bold text-amber-400">
                          ⚠ Zugewiesene Spule passt nicht ({spool?.material}, {spool?.colorHex}). Tippe auf „Mit Drucker synchronisieren“.
                        </p>
                      )}
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
  );
};
