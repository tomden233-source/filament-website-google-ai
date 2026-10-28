import { LabelPrintButton } from '../LabelPrintButton';
import React from 'react';
import { Zap, Camera, Tag, Plus, Minus, Pencil, Trash2 } from 'lucide-react';
import { BambuPrinterWidget } from '../BambuPrinterWidget';
import { SpoolBadges } from '../workshop/SpoolBadges';
import { LocationFilter } from '../workshop/LocationFilter';

export interface MobileAppViewProps {
  spools: any;
  totalGrams: any;
  setIsCameraModalOpen: any;
  setNfcSpoolId: any;
  setNfcModalMode: any;
  setIsNfcModalOpen: any;
  setSpoolToEdit: any;
  setSpoolPrefill: any;
  setIsSpoolModalOpen: any;
  setIsQuickDeductOpen: any;
  viewMode: any;
  handleDeductWeight: (...args: any[]) => any;
  handleApplyDryingCredit: any;
  searchQuery: any;
  setSearchQuery: any;
  setActiveMaterialFilter: any;
  activeMaterialFilter: any;
  filteredSpools: any;
  handleAddWeight: (...args: any[]) => any;
  handleOpenSpoolNfc: any;
  handleDeleteSpool: (...args: any[]) => any;
  locations: any;
  activeLocationFilter: any;
  setActiveLocationFilter: any;
}

export const MobileAppView: React.FC<MobileAppViewProps> = ({
  spools,
  totalGrams,
  setIsCameraModalOpen,
  setNfcSpoolId,
  setNfcModalMode,
  setIsNfcModalOpen,
  setSpoolToEdit,
  setSpoolPrefill,
  setIsSpoolModalOpen,
  setIsQuickDeductOpen,
  viewMode,
  handleDeductWeight,
  handleApplyDryingCredit,
  searchQuery,
  setSearchQuery,
  setActiveMaterialFilter,
  activeMaterialFilter,
  filteredSpools,
  handleAddWeight,
  handleOpenSpoolNfc,
  handleDeleteSpool,
  locations,
  activeLocationFilter,
  setActiveLocationFilter
}) => {
  return (
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
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-orange-400 text-white flex items-center justify-center shadow-sm">
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
              compact
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

              <LocationFilter locations={locations} active={activeLocationFilter} onChange={setActiveLocationFilter} />
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
                filteredSpools.map((spool: any) => {
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
                            <div className="flex flex-wrap items-center gap-1 mt-1 empty:hidden">
                              <SpoolBadges spool={spool} />
                            </div>
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

                      {/* 1-Klick Schnellabzug & Hinzufügen: feste Raster, nichts bricht mehr um */}
                      <div className="pt-2 border-t space-y-1.5" style={{ borderColor: 'var(--app-border)' }}>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[10, 25, 50, 100].map(grams => (
                            <button
                              key={grams}
                              onClick={() => handleDeductWeight(spool.id, grams)}
                              className="py-1.5 rounded-lg border text-[11px] font-mono-num font-bold transition cursor-pointer active:scale-95 text-rose-400 bg-rose-500/10 border-rose-500/30"
                            >
                              −{grams}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[10, 25, 50, 100].map(grams => (
                            <button
                              key={grams}
                              onClick={() => handleAddWeight(spool.id, grams)}
                              className="py-1.5 rounded-lg border text-[11px] font-mono-num font-bold transition cursor-pointer active:scale-95 text-emerald-500 bg-emerald-500/10 border-emerald-500/30"
                            >
                              +{grams}
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                          <button
                            onClick={() => handleOpenSpoolNfc(spool.id)}
                            className={`py-1.5 rounded-lg border text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                              spool.nfcWritten
                                ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30'
                                : 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                            }`}
                            title={spool.nfcWritten ? 'NFC: Beschrieben (Klicken für Details/Löschen)' : 'NFC: Unbeschrieben (Klicken zum Beschreiben)'}
                          >
                            <Tag className="w-3.5 h-3.5" />
                            <span>NFC</span>
                          </button>
                          <LabelPrintButton spool={spool} className="w-full py-1.5" />
                          <button
                            onClick={() => {
                              setSpoolToEdit(spool);
                              setSpoolPrefill(null);
                              setIsSpoolModalOpen(true);
                            }}
                            className="py-1.5 rounded-lg border text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1"
                            style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                            title="Spule bearbeiten"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Ändern</span>
                          </button>
                          <button
                            onClick={() => handleDeleteSpool(spool.id)}
                            className="py-1.5 rounded-lg border text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1 text-rose-500 bg-rose-500/10 border-rose-500/30"
                            title="Spule löschen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Löschen</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
  );
};
