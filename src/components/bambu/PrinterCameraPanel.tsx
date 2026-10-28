import React from 'react';
import { Camera, RefreshCw, Lightbulb, Power, Plug } from 'lucide-react';

export interface PrinterCameraPanelProps {
  setCameraSnapshotKey: any;
  handleToggleLight: (...args: any[]) => any;
  isLightOn: any;
  isSocketOff: any;
  handleToggleSwitch: (...args: any[]) => any;
  haSwitchLoading: any;
  cameraSource: any;
  haCameraBlobUrl: any;
  haCreds: any;
  cameraSnapshotKey: any;
  printerLocalIp: any;
  haSwitchState: any;
}

export const PrinterCameraPanel: React.FC<PrinterCameraPanelProps> = ({
  setCameraSnapshotKey,
  handleToggleLight,
  isLightOn,
  isSocketOff,
  handleToggleSwitch,
  haSwitchLoading,
  cameraSource,
  haCameraBlobUrl,
  haCreds,
  cameraSnapshotKey,
  printerLocalIp,
  haSwitchState
}) => {
  return (
<div
          className="p-4 border-b space-y-3 transition-all animate-fadeIn"
          style={{
            backgroundColor: 'var(--app-card-sub)',
            borderColor: 'var(--app-border)'
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Camera className="w-4 h-4 text-[#00AE42]" />
              <span className="font-extrabold text-xs sm:text-sm" style={{ color: 'var(--app-text)' }}>
                Bambu Lab X2D Live Kamera
              </span>

              {/* Status Badge */}
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] flex items-center gap-1 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live Feed (Snapshot)
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Bild manuell aktualisieren */}
              <button
                onClick={() => setCameraSnapshotKey(Date.now())}
                className="px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer hover:bg-white/10"
                style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                title="Kamerabild jetzt sofort neu abrufen"
              >
                <RefreshCw className="w-3 h-3 text-[#00AE42]" />
                <span>Bild aktualisieren</span>
              </button>

              {/* Licht schalten */}
              <button
                onClick={handleToggleLight}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  isLightOn ? 'bg-amber-500/25 border-amber-500/50 text-amber-300' : 'hover:bg-white/10'
                }`}
                style={{ borderColor: isLightOn ? undefined : 'var(--app-border)', color: isLightOn ? undefined : 'var(--app-text)' }}
              >
                <Lightbulb className="w-3 h-3 text-amber-400" />
                <span>{isLightOn ? 'Licht Aus' : 'Licht An'}</span>
              </button>
            </div>
          </div>

          {/* Kamera-Bild Container mit Realschnappschuss – stabil ohne Blinken & ohne Flackern */}
          <div className="relative rounded-2xl overflow-hidden border border-black/40 shadow-2xl bg-black aspect-video flex items-center justify-center group">
            {isSocketOff ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3 bg-gradient-to-b from-slate-950 via-slate-900 to-black">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-lg">
                  <Power className="w-7 h-7" />
                </div>
                <div className="max-w-sm">
                  <p className="text-sm font-bold text-slate-200">
                    Live-Kamera offline • Drucker ist stromlos
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Die Kamera des Bambu Lab X2D wird mit Strom versorgt, sobald die Home Assistant Steckdose eingeschaltet ist.
                  </p>
                </div>
                <button
                  onClick={handleToggleSwitch}
                  disabled={haSwitchLoading}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{haSwitchLoading ? 'Schaltet ein...' : '⚡ Jetzt Steckdose einschalten'}</span>
                </button>
              </div>
            ) : (
              <>
                <img
                  src={
                    cameraSource === 'ha'
                      ? (haCameraBlobUrl || `/api/homeassistant/camera-snapshot?entity=${encodeURIComponent(haCreds.cameraEntity)}&t=${cameraSnapshotKey}`)
                      : `/api/printer/camera-snapshot?t=${cameraSnapshotKey}`
                  }
                  onError={e => {
                    e.currentTarget.onerror = null;
                    if (haCameraBlobUrl) {
                      e.currentTarget.src = haCameraBlobUrl;
                    } else {
                      e.currentTarget.src = `/api/printer/camera-snapshot?t=${Date.now()}`;
                    }
                  }}
                  alt="Bambu Lab X2D Live Kamera"
                  className="w-full h-full object-cover"
                />

                {/* Overlay Hinweis oben rechts (ohne RTSP) */}
                <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15 text-[10px] text-slate-300 font-mono flex items-center gap-2 pointer-events-none">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>
                    {cameraSource === 'ha'
                      ? `Home Assistant: ${haCreds.cameraEntity}`
                      : `X2D Live Snapshot (${printerLocalIp})`}
                  </span>
                </div>

                {/* Dezent eingeblendetes Overlay unten */}
                <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[10px] text-white/90 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 pointer-events-none">
                  <span className="flex items-center gap-1.5 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Bambu Lab X2D Live Kamera</span>
                  </span>
                  <span className="font-mono text-[9px] text-slate-300">
                    {haCreds.cameraEntity} • Auto-Refresh aktiv
                  </span>
                </div>
              </>
            )}
          </div>

          {/* LAN-STECKDOSE STATUS & SCHALTER DIREKT UNTER DER KAMERA */}
          <div
            className="p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2.5"
            style={{
              backgroundColor: 'var(--app-card)',
              borderColor: 'var(--app-border)'
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                  haSwitchState.state === 'on'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                }`}
              >
                <Plug className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold" style={{ color: 'var(--app-text)' }}>
                    LAN-Steckdose ({haCreds.switchEntity}):
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      haSwitchState.state === 'on'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                    }`}
                  >
                    {haSwitchState.state === 'on' ? '🟢 EINGESCHALTET (STROM AN)' : '🔴 AUSGESCHALTET (STROM AUS)'}
                  </span>
                  {haSwitchState.power && (
                    <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/30">
                      ⚡ {haSwitchState.power} W
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 truncate">
                  Raspberry Pi Home Assistant ({haCreds.url})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleSwitch}
                disabled={haSwitchLoading}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md disabled:opacity-50 ${
                  haSwitchState.state === 'on'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>
                  {haSwitchLoading ? 'Schaltet...' : haSwitchState.state === 'on' ? 'Steckdose Ausschalten' : 'Steckdose Einschalten'}
                </span>
              </button>
            </div>
          </div>
        </div>
  );
};
