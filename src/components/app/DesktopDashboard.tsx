import React from 'react';
import { Edit3, Wand2, Camera, Search, X, ArrowUpDown, Tag, Layers } from 'lucide-react';
import { BambuPrinterWidget } from '../BambuPrinterWidget';
import { SpoolCard } from '../SpoolCard';
import { LocationFilter } from '../workshop/LocationFilter';
import type { Spool } from '../../types/filament';

export interface DesktopDashboardProps {
  spools: Spool[];
  totalGrams: any;
  totalValue: any;
  dueDryingCount: any;
  setEditUsedInputValue: any;
  totalUsedGrams: any;
  setIsEditUsedModalOpen: any;
  viewMode: any;
  handleDeductWeight: (...args: any[]) => any;
  handleApplyDryingCredit: any;
  setSpoolToEdit: any;
  setSpoolPrefill: any;
  setIsSpoolModalOpen: any;
  setIsCameraModalOpen: any;
  quickLinkText: any;
  setQuickLinkText: any;
  handleQuickScan: (...args: any[]) => any;
  isQuickScanning: any;
  searchQuery: any;
  setSearchQuery: any;
  sortBy: any;
  setSortBy: any;
  activeMaterialFilter: any;
  setActiveMaterialFilter: any;
  filteredSpools: Spool[];
  appSettings: any;
  now: any;
  handleApplyScale: (...args: any[]) => any;
  handleMarkDried: (...args: any[]) => any;
  handleDuplicateSpool: (...args: any[]) => any;
  handleDeleteSpool: (...args: any[]) => any;
  handleOpenSpoolNfc: any;
  locations: any;
  activeLocationFilter: any;
  setActiveLocationFilter: any;
}

export const DesktopDashboard: React.FC<DesktopDashboardProps> = ({
  spools,
  totalGrams,
  totalValue,
  dueDryingCount,
  setEditUsedInputValue,
  totalUsedGrams,
  setIsEditUsedModalOpen,
  viewMode,
  handleDeductWeight,
  handleApplyDryingCredit,
  setSpoolToEdit,
  setSpoolPrefill,
  setIsSpoolModalOpen,
  setIsCameraModalOpen,
  quickLinkText,
  setQuickLinkText,
  handleQuickScan,
  isQuickScanning,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  activeMaterialFilter,
  setActiveMaterialFilter,
  filteredSpools,
  appSettings,
  now,
  handleApplyScale,
  handleMarkDried,
  handleDuplicateSpool,
  handleDeleteSpool,
  handleOpenSpoolNfc,
  locations,
  activeLocationFilter,
  setActiveLocationFilter
}) => {
  return (
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
                  {(searchQuery || activeMaterialFilter !== 'ALL' || activeLocationFilter !== 'ALL') && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setActiveMaterialFilter('ALL');
                        setActiveLocationFilter('ALL');
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

              {locations.length > 0 && (
                <div className="pt-2 border-t" style={{ borderColor: 'var(--app-border)' }}>
                  <LocationFilter locations={locations} active={activeLocationFilter} onChange={setActiveLocationFilter} />
                </div>
              )}
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
  );
};
