import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check } from 'lucide-react';

interface QrModalProps {
  isOpen: boolean;
  onClose: () => void;
  cloudDbUrl: string;
}

export const QrModal: React.FC<QrModalProps> = ({
  isOpen,
  onClose,
  cloudDbUrl
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [pairingUrl, setPairingUrl] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const base = window.location.href.split('?')[0].split('#')[0];
    const url = `${base}?pairCloud=${encodeURIComponent(cloudDbUrl)}`;
    setPairingUrl(url);

    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 220,
        margin: 2,
        color: {
          dark: '#0b111e',
          light: '#ffffff'
        }
      }, err => {
        if (err) console.error(err);
      });
    }
  }, [isOpen, cloudDbUrl]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pairingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
        <div className="flex justify-between items-start border-b border-slate-800 pb-2.5">
          <div>
            <h3 className="text-base font-bold text-white">📱 Handy & PC Live-Kopplung</h3>
            <p className="text-[11px] text-slate-400">
              Scanne den QR-Code mit der Handykamera für sofortige Synchronisation.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-center">
          <div className="p-3 rounded-2xl bg-white shadow-xl flex items-center justify-center">
            <canvas ref={canvasRef} className="rounded-lg" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] text-slate-400">
            Kopplungs-Link (inkl. Cloud-Datenbank)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={pairingUrl}
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white outline-none font-mono-num truncate"
            />
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 whitespace-nowrap flex items-center gap-1 transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Kopiert!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Kopieren</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ECHTE DAUERHAFTE WEBSEITE ERKLÄRUNG */}
        <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
            <span>🌐</span>
            <span>Echte Webseite – Ohne Chat oder Token nutzbar</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Du kannst diese URL direkt in jedem Browser (Chrome, Safari, Firefox, Edge) aufrufen und als <strong>Lesezeichen</strong> speichern oder über das Browsermenü auf <strong>„Zum Home-Bildschirm“</strong> bzw. <strong>„App installieren“</strong> klicken. Sie funktioniert komplett eigenständig!
          </p>
          <a
            href={typeof window !== 'undefined' ? window.location.href.split('?')[0].split('#')[0] : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
          >
            <span>Webseite in neuem Fenster öffnen</span>
            <span>↗</span>
          </a>
        </div>
      </div>
    </div>
  );
};
