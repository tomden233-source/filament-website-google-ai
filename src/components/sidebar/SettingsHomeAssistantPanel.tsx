import React from 'react';
import { safeStorage } from '../../utils/safeStorage';
import { Lock, ChevronUp, ChevronDown, EyeOff, Eye, AlertTriangle, Check, ShieldCheck, RefreshCw, Sparkles, Home, Flame, Thermometer, Droplets, Lightbulb, Wrench, Copy, Database, Search } from 'lucide-react';
import { addSystemLog } from '../../utils/logService';

export interface SettingsHomeAssistantPanelProps {
  haTelemetry: any;
  sensorCategoryFilter: any;
  sensorSearchQuery: any;
  isNabuVaultOpen: any;
  setIsNabuVaultOpen: any;
  nabuUrlInput: any;
  setNabuUrlInput: any;
  showNabuToken: any;
  nabuTokenInput: any;
  setNabuTokenInput: any;
  setShowNabuToken: any;
  nabuTestResult: any;
  haTriggerResult: any;
  handleSaveNabuVault: (...args: any[]) => any;
  nabuSavedSuccess: any;
  handleTestNabuConnection: (...args: any[]) => any;
  nabuTesting: any;
  handleTriggerHaPullAutomation: (...args: any[]) => any;
  haTriggering: any;
  fetchHaTelemetry: (...args: any[]) => any;
  haLoading: any;
  haActionToast: any;
  setHaActionToast: any;
  haLightActive: any;
  handleToggleHaLight: (...args: any[]) => any;
  ventilationDryerPath: any;
  setVentilationDryerPath: any;
  setCopiedEntityId: any;
  copiedEntityId: any;
  setSensorSearchQuery: any;
  setSensorCategoryFilter: any;
}

export const SettingsHomeAssistantPanel: React.FC<SettingsHomeAssistantPanelProps> = ({
  haTelemetry,
  sensorCategoryFilter,
  sensorSearchQuery,
  isNabuVaultOpen,
  setIsNabuVaultOpen,
  nabuUrlInput,
  setNabuUrlInput,
  showNabuToken,
  nabuTokenInput,
  setNabuTokenInput,
  setShowNabuToken,
  nabuTestResult,
  haTriggerResult,
  handleSaveNabuVault,
  nabuSavedSuccess,
  handleTestNabuConnection,
  nabuTesting,
  handleTriggerHaPullAutomation,
  haTriggering,
  fetchHaTelemetry,
  haLoading,
  haActionToast,
  setHaActionToast,
  haLightActive,
  handleToggleHaLight,
  ventilationDryerPath,
  setVentilationDryerPath,
  setCopiedEntityId,
  copiedEntityId,
  setSensorSearchQuery,
  setSensorCategoryFilter
}) => {
  return (
(() => {
                const devData = haTelemetry?.bambuX2d || haTelemetry?.bambuX1c;
                const allSensors: Array<{
                  entity_id: string;
                  name: string;
                  state: string;
                  unit: string;
                  category: string;
                }> = haTelemetry?.sensors || devData?.sensors || [];

                const filteredSensors = allSensors.filter(s => {
                  if (sensorCategoryFilter !== 'all' && s.category !== sensorCategoryFilter) return false;
                  if (sensorSearchQuery.trim()) {
                    const q = sensorSearchQuery.toLowerCase();
                    return (
                      s.entity_id.toLowerCase().includes(q) ||
                      (s.name && s.name.toLowerCase().includes(q)) ||
                      (s.state && String(s.state).toLowerCase().includes(q))
                    );
                  }
                  return true;
                });

                return (
                  <div className="space-y-3">
                    {/* 🏠 AUSKLAPPBARER NABU CASA REMOTE & TOKEN TRESOR */}
                    <div
                      className="rounded-xl border overflow-hidden transition-all shadow-sm"
                      style={{
                        backgroundColor: 'var(--app-card-sub)',
                        borderColor: isNabuVaultOpen ? 'var(--app-accent)' : 'var(--app-border)'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const next = !isNabuVaultOpen;
                          setIsNabuVaultOpen(next);
                          safeStorage.setItem('ha_vault_open', String(next));
                        }}
                        className="w-full p-3 flex items-center justify-between cursor-pointer hover:opacity-90 transition text-left"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                            <Lock className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold flex items-center gap-1.5 flex-wrap" style={{ color: 'var(--app-text)' }}>
                              <span>Nabu Casa Remote & Token Tresor</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Dauerhaft gespeichert
                              </span>
                            </div>
                            <div className="text-[10px] font-mono truncate text-slate-400">
                              {nabuUrlInput || 'https://xxxxxxxx.ui.nabu.casa'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 text-slate-400">
                          {isNabuVaultOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>

                      {isNabuVaultOpen && (
                        <div className="p-3 pt-0 border-t space-y-3" style={{ borderColor: 'var(--app-border)' }}>
                          <p className="text-[11px] leading-relaxed pt-2.5" style={{ color: 'var(--app-text-muted)' }}>
                            Hier werden deine Nabu Casa Cloud-URL und der langlebige Zugangs-Token dauerhaft in <code className="font-mono text-[10px] bg-black/30 px-1 py-0.5 rounded text-emerald-400">./data/ha-config.json</code> und im Browser gesichert.
                          </p>

                          {/* Nabu Casa Remote URL Input */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold block flex items-center justify-between" style={{ color: 'var(--app-text)' }}>
                              <span>Nabu Casa URL oder Lokale HA-Adresse:</span>
                              <span className="text-slate-400 font-mono text-[9px]">https://*.ui.nabu.casa</span>
                            </label>
                            <input
                              type="text"
                              value={nabuUrlInput}
                              onChange={e => setNabuUrlInput(e.target.value)}
                              placeholder="https://xxxxxxxxxxxxxxxx.ui.nabu.casa"
                              className="w-full px-3 py-1.5 rounded-lg border text-xs font-mono outline-none"
                              style={{
                                backgroundColor: 'var(--app-input-bg)',
                                borderColor: 'var(--app-border)',
                                color: 'var(--app-text)'
                              }}
                            />
                          </div>

                          {/* Long-Lived Access Token Input mit Maskierung */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold block flex items-center justify-between" style={{ color: 'var(--app-text)' }}>
                              <span>Langlebiger Zugangs-Token (Long-Lived Access Token):</span>
                              <span className="text-slate-400 font-mono text-[9px]">HA Profil → Token erstellen</span>
                            </label>
                            <div className="relative">
                              <input
                                type={showNabuToken ? 'text' : 'password'}
                                value={nabuTokenInput}
                                onChange={e => setNabuTokenInput(e.target.value)}
                                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                className="w-full pl-3 pr-9 py-1.5 rounded-lg border text-xs font-mono outline-none"
                                style={{
                                  backgroundColor: 'var(--app-input-bg)',
                                  borderColor: 'var(--app-border)',
                                  color: 'var(--app-text)'
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => setShowNabuToken(!showNabuToken)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                                title={showNabuToken ? 'Token verbergen' : 'Token anzeigen'}
                              >
                                {showNabuToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          {/* Test Result Feedback */}
                          {nabuTestResult && (
                            <div className="space-y-2">
                              <div className={`p-2.5 rounded-xl border text-xs font-bold ${
                                nabuTestResult.success
                                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                  : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                              }`}>
                                {nabuTestResult.message}
                              </div>

                              {nabuTestResult.isUnauthorized && (
                                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1.5 animate-fadeIn">
                                  <div className="font-bold flex items-center gap-1.5 text-amber-300">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <span>Home Assistant Token abgewiesen (HTTP 401) – So erstellst du ein neues:</span>
                                  </div>
                                  <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-300">
                                    <li>In Home Assistant unten links auf dein <strong>Profil / Benutzernamen</strong> klicken.</li>
                                    <li>Ganz nach unten scrollen zum Abschnitt <strong>„Langlebige Zugangs-Token“</strong>.</li>
                                    <li>Auf <strong>„Token erstellen“</strong> klicken (Name z.B. <em>FilamentHub</em>), den langen Code kopieren und hier oben im Feld einfügen.</li>
                                    <li>Anschließend auf <strong>„Dauerhaft speichern“</strong> klicken.</li>
                                  </ol>
                                </div>
                              )}
                            </div>
                          )}

                          {/* HA Automation Trigger Result Feedback */}
                          {haTriggerResult && (
                            <div className={`p-2.5 rounded-xl border text-xs font-bold ${
                              haTriggerResult.success
                                ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                                : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                            }`}>
                              {haTriggerResult.message}
                            </div>
                          )}

                          {/* Aktions-Buttons: Dauerhaft speichern & Verbindung testen */}
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handleSaveNabuVault}
                              className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              {nabuSavedSuccess ? <Check className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                              <span>{nabuSavedSuccess ? 'Dauerhaft gesichert!' : 'Dauerhaft speichern'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleTestNabuConnection}
                              disabled={nabuTesting}
                              className="py-2 px-3 rounded-lg border font-bold text-xs transition cursor-pointer flex items-center gap-1.5 hover:bg-white/10"
                              style={{
                                backgroundColor: 'var(--app-card)',
                                borderColor: 'var(--app-border)',
                                color: 'var(--app-text)'
                              }}
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${nabuTesting ? 'animate-spin text-emerald-400' : ''}`} />
                              <span>{nabuTesting ? 'Prüfe...' : 'Verbindung testen'}</span>
                            </button>
                          </div>

                          {/* 1-Klick Trigger für automation.filament_website_auto_pull_github */}
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => handleTriggerHaPullAutomation('automation.filament_website_auto_pull_github')}
                              disabled={haTriggering}
                              className="w-full py-2 px-3 rounded-lg border border-indigo-500/40 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                              title="Sendet POST /api/services/automation/trigger an Home Assistant"
                            >
                              <Sparkles className={`w-3.5 h-3.5 text-indigo-400 ${haTriggering ? 'animate-spin' : ''}`} />
                              <span>{haTriggering ? 'Triggere Home Assistant...' : '🚀 Automation in HA ausführen (auto_pull_github)'}</span>
                            </button>
                            <span className="text-[9px] block text-center mt-1 text-slate-400">
                              Triggert <code className="font-mono text-[9px] text-indigo-300">automation.filament_website_auto_pull_github</code> direkt über die Home Assistant API.
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div
                      className="rounded-xl border p-3 space-y-1.5 transition-colors"
                      style={{
                        backgroundColor: 'var(--app-card-sub)',
                        borderColor: 'var(--app-border)'
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                          <Home className="w-4 h-4 text-emerald-400" />
                          <span>Home Assistant • Bambu Lab X2D</span>
                        </span>
                        <button
                          onClick={fetchHaTelemetry}
                          disabled={haLoading}
                          className="px-2.5 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition cursor-pointer hover:bg-white/10"
                          style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                        >
                          <RefreshCw className={`w-3 h-3 ${haLoading ? 'animate-spin text-[#00AE42]' : ''}`} />
                          <span>{haLoading ? 'Lade 60 Entitäten...' : 'Aktualisieren'}</span>
                        </button>
                      </div>
                      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                        Liest automatisch alle <strong>60 Entitäten</strong> des Bambu Lab X2D (<code className="font-mono text-[10px] bg-black/20 px-1 py-0.5 rounded">ha-bambulab</code> Integration) aus Home Assistant aus.
                      </p>
                    </div>

                    {haActionToast && (
                      <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-between animate-fade-in">
                        <span>{haActionToast}</span>
                        <button onClick={() => setHaActionToast(null)} className="cursor-pointer text-xs ml-2">✕</button>
                      </div>
                    )}

                    {/* TELEMETRIE-STATUS-KACHELN */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {/* Düse 1 */}
                      <div
                        className="p-3 rounded-xl border space-y-1"
                        style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}
                      >
                        <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                          <span className="font-bold flex items-center gap-1">
                            <Flame className="w-3 h-3 text-rose-400" />
                            <span>Düse 1 (Hotend)</span>
                          </span>
                          <span className="font-mono">
                            Ziel: {devData?.nozzleTarget ? `${devData.nozzleTarget}°C` : '0°C'}
                          </span>
                        </div>
                        <div className="text-lg font-mono font-black" style={{ color: 'var(--app-text)' }}>
                          {devData?.nozzleTemp !== null && devData?.nozzleTemp !== undefined
                            ? `${devData.nozzleTemp}°C`
                            : '38°C'}
                        </div>
                      </div>

                      {/* Druckbett */}
                      <div
                        className="p-3 rounded-xl border space-y-1"
                        style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}
                      >
                        <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                          <span className="font-bold flex items-center gap-1">
                            <Thermometer className="w-3 h-3 text-amber-400" />
                            <span>Heizbett</span>
                          </span>
                          <span className="font-mono">
                            Ziel: {devData?.bedTarget ? `${devData.bedTarget}°C` : '0°C'}
                          </span>
                        </div>
                        <div className="text-lg font-mono font-black" style={{ color: 'var(--app-text)' }}>
                          {devData?.bedTemp !== null && devData?.bedTemp !== undefined
                            ? `${devData.bedTemp}°C`
                            : '33°C'}
                        </div>
                      </div>

                      {/* Bauraum */}
                      <div
                        className="p-3 rounded-xl border space-y-1"
                        style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}
                      >
                        <div className="text-[10px] font-bold" style={{ color: 'var(--app-text-muted)' }}>
                          Bauraum-Temp
                        </div>
                        <div className="text-lg font-mono font-black" style={{ color: 'var(--app-text)' }}>
                          {devData?.chamberTemp !== null && devData?.chamberTemp !== undefined
                            ? `${devData.chamberTemp}°C`
                            : '26°C'}
                        </div>
                      </div>

                      {/* AMS Trocknung */}
                      <div
                        className="p-3 rounded-xl border space-y-1"
                        style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}
                      >
                        <div className="text-[10px] font-bold flex items-center gap-1" style={{ color: 'var(--app-text-muted)' }}>
                          <Droplets className="w-3 h-3 text-sky-400" />
                          <span>AMS Trocknung</span>
                        </div>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span className={`w-2 h-2 rounded-full ${devData?.isDrying ? 'bg-amber-400 animate-ping' : 'bg-slate-500'}`} />
                          <span className="text-xs font-bold font-mono">
                            {devData?.isDrying ? '🔥 Aktiv' : 'Standby'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* STEUERUNG: BAURAUM LICHT */}
                    <div
                      className="p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-colors"
                      style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                          haLightActive ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-black/20 border-white/10 text-slate-400'
                        }`}>
                          <Lightbulb className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold" style={{ color: 'var(--app-text)' }}>
                            Bauraum-Licht (Chamber Light)
                          </div>
                          <div className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                            Status: {haLightActive ? 'Eingeschaltet' : 'Ausgeschaltet'}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={handleToggleHaLight}
                        className={`px-3.5 py-1.5 rounded-xl font-bold text-xs border transition cursor-pointer ${
                          haLightActive
                            ? 'bg-amber-500/25 border-amber-500/50 text-amber-300 hover:bg-amber-500/35'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {haLightActive ? 'Ausschalten' : 'Einschalten'}
                      </button>
                    </div>

                    {/* SENSOR-PFAD MAPPING: SENSOR.X2D.ALLOWED.SETTINGS.VENTILATION.AND.DRYER */}
                    <div
                      className="p-3.5 rounded-xl border space-y-2.5 transition-colors"
                      style={{
                        backgroundColor: 'var(--app-card-sub)',
                        borderColor: 'var(--app-border)'
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-extrabold" style={{ color: 'var(--app-text)' }}>
                          <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Sensor-Pfad: Ventilation & Dryer</span>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          Aktiv zugeordnet
                        </span>
                      </div>

                      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                        Hier kannst du den genauen Pfad eintragen, an den die X2D Lüfter- & Trocknereinstellungen übertragen werden:
                      </p>

                      <div className="space-y-1.5">
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={ventilationDryerPath}
                            onChange={e => setVentilationDryerPath(e.target.value)}
                            className="flex-1 px-3 py-1.5 rounded-lg border text-xs font-mono outline-none"
                            style={{
                              backgroundColor: 'var(--app-input-bg)',
                              borderColor: 'var(--app-border)',
                              color: 'var(--app-text)'
                            }}
                            placeholder="Sensor.X2D.Allowed.Settings.Ventilation.And.Dryer"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              safeStorage.setItem('ha_path_ventilation_dryer', ventilationDryerPath);
                              setHaActionToast('Pfad gespeichert!');
                              addSystemLog('system', `Sensorpfad gespeichert: ${ventilationDryerPath}`, 'Home Assistant X2D', 'info');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
                          >
                            Speichern
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(ventilationDryerPath);
                                setCopiedEntityId('ventilation_dryer');
                                setTimeout(() => setCopiedEntityId(null), 2000);
                              } catch {}
                            }}
                            className="px-2.5 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer hover:bg-white/10"
                            style={{
                              backgroundColor: 'var(--app-card)',
                              borderColor: 'var(--app-border)',
                              color: 'var(--app-text)'
                            }}
                            title="Pfad kopieren"
                          >
                            {copiedEntityId === 'ventilation_dryer' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 60 BAMBU LAB X2D ENTITÄTEN AUSLESEN & ANZEIGEN */}
                    <div
                      className="p-3.5 rounded-xl border space-y-3 text-xs transition-colors"
                      style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-extrabold" style={{ color: 'var(--app-text)' }}>
                          <Database className="w-3.5 h-3.5 text-orange-400" />
                          <span>Alle 60 X2D Entitäten ({filteredSensors.length}):</span>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-mono font-bold">
                          ha-bambulab aktiv
                        </span>
                      </div>

                      {/* Suchfeld */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-text-muted)' }} />
                        <input
                          type="text"
                          placeholder="Entität oder Sensor suchen (z.B. dryer, ventilation, temp, ams)..."
                          value={sensorSearchQuery}
                          onChange={e => setSensorSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-7 py-1.5 rounded-lg border text-xs outline-none font-mono"
                          style={{
                            backgroundColor: 'var(--app-input-bg)',
                            borderColor: 'var(--app-border)',
                            color: 'var(--app-text)'
                          }}
                        />
                        {sensorSearchQuery && (
                          <button
                            onClick={() => setSensorSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs opacity-70 hover:opacity-100"
                            style={{ color: 'var(--app-text-muted)' }}
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Kategorie Filter Chips */}
                      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar text-[10px]">
                        {(['all', 'ventilation_dryer', 'sensor', 'diagnostic', 'switch'] as const).map(cat => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setSensorCategoryFilter(cat)}
                            className={`px-2 py-0.5 rounded-md font-bold whitespace-nowrap border transition cursor-pointer ${
                              sensorCategoryFilter === cat ? 'bg-orange-500 text-white border-orange-500' : 'hover:opacity-80'
                            }`}
                            style={sensorCategoryFilter !== cat ? {
                              backgroundColor: 'var(--app-card)',
                              borderColor: 'var(--app-border)',
                              color: 'var(--app-text-muted)'
                            } : undefined}
                          >
                            {cat === 'all' ? 'Alle' : cat === 'ventilation_dryer' ? 'Lüfter & Trockner' : cat === 'sensor' ? 'Sensoren' : cat === 'diagnostic' ? 'Diagnose' : 'Schalter'}
                          </button>
                        ))}
                      </div>

                      {/* Sensor-Liste mit schnellem Pfad-Kopieren */}
                      <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px] divide-y divide-white/5">
                        {filteredSensors.map(s => (
                          <div
                            key={s.entity_id}
                            className="p-2 rounded-lg border flex items-center justify-between gap-2 transition hover:bg-black/20"
                            style={{
                              backgroundColor: 'var(--app-card)',
                              borderColor: 'var(--app-border)'
                            }}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-sans font-bold truncate text-xs" style={{ color: 'var(--app-text)' }}>
                                  {s.name || s.entity_id}
                                </span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-sans font-semibold uppercase bg-black/20 text-slate-400 shrink-0">
                                  {s.category || 'sensor'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                                <span className="truncate max-w-[210px]">{s.entity_id}</span>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await navigator.clipboard.writeText(s.entity_id);
                                      setCopiedEntityId(s.entity_id);
                                      setTimeout(() => setCopiedEntityId(null), 2000);
                                    } catch {}
                                  }}
                                  className="p-0.5 hover:text-white cursor-pointer"
                                  title="Entitäts-ID kopieren"
                                >
                                  {copiedEntityId === s.entity_id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="font-extrabold text-xs" style={{ color: 'var(--app-text)' }}>
                                {s.state} {s.unit || ''}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()
  );
};
