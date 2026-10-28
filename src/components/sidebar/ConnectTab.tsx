import React from 'react';
import { Smartphone, Download, Check, Copy } from 'lucide-react';

export interface ConnectTabProps {
  qrCodeDataUrl: any;
  handleCopyPairLink: (...args: any[]) => any;
  copiedLink: any;
}

export const ConnectTab: React.FC<ConnectTabProps> = ({
  qrCodeDataUrl,
  handleCopyPairLink,
  copiedLink
}) => {
  return (
<div className="space-y-3.5">
              <div
                className="rounded-2xl border p-4 space-y-3 shadow-md transition-colors"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm" style={{ color: 'var(--app-text)' }}>
                        Android APK herunterladen
                      </h4>
                      <p className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                        FilamentHub v1.29 • Für alle Android-Geräte
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Auto-Sync
                  </span>
                </div>

                <a
                  href="/FilamentHub.apk"
                  download="FilamentHub.apk"
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs shadow-lg shadow-orange-500/20 transition flex items-center justify-center gap-2.5 cursor-pointer text-center"
                >
                  <Download className="w-4 h-4 text-white" />
                  <span>FilamentHub.apk jetzt herunterladen (2.8 MB)</span>
                </a>

                <div className="text-[11px] space-y-1" style={{ color: 'var(--app-text-muted)' }}>
                  <p>1. APK herunterladen und auf dem Smartphone antippen.</p>
                  <p>2. „Aus unbekannter Quelle installieren“ bestätigen.</p>
                  <p>3. Fertig! App synchronisiert sich vollautomatisch.</p>
                </div>
              </div>

              {/* QR-Kopplung */}
              <div
                className="rounded-2xl border p-4 space-y-3 transition-colors"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)'
                }}
              >
                <span className="font-bold text-xs block" style={{ color: 'var(--app-text)' }}>
                  Alternative: Live im Browser koppeln
                </span>
                <div className="flex justify-center p-2 rounded-xl" style={{ backgroundColor: 'var(--app-card)' }}>
                  {qrCodeDataUrl && (
                    <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-200">
                      <img src={qrCodeDataUrl} alt="Koppeln" className="w-32 h-32 object-contain" />
                    </div>
                  )}
                </div>
                <button
                  onClick={handleCopyPairLink}
                  className="w-full py-2 rounded-xl border font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                  style={{
                    backgroundColor: 'var(--app-card)',
                    borderColor: 'var(--app-border)',
                    color: 'var(--app-text)'
                  }}
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Koppel-Link in Zwischenablage!' : 'Koppel-Link kopieren'}</span>
                </button>
              </div>
            </div>
  );
};
