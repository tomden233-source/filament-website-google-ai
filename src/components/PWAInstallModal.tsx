import React, { useState, useEffect } from 'react';
import { X, Smartphone, Download, Share, PlusSquare, Check } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Prüfen, ob bereits als eigenständige PWA installiert
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBeforePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforePrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (!isOpen) return null;

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      onClose();
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
        <div className="flex justify-between items-start border-b border-slate-800 pb-2.5">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-orange-400" />
              <span>Als Handy-App installieren</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              FilamentHub Studio direkt auf den Home-Bildschirm legen
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isInstalled ? (
          <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-center space-y-2">
            <Check className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-xs font-bold text-white">App ist bereits installiert!</p>
            <p className="text-[11px] text-slate-400">
              Du nutzt FilamentHub Studio bereits im Standalone-Modus auf deinem Smartphone.
            </p>
          </div>
        ) : deferredPrompt ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-300">
              Mit einem Klick installierst du FilamentHub als echte App auf deinem Smartphone – blitzschnell, ohne Browser-Suchleiste und immer griffbereit.
            </p>
            <button
              onClick={handleNativeInstall}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Jetzt App installieren</span>
            </button>
          </div>
        ) : isIOS ? (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <p className="font-bold text-white flex items-center gap-1.5">
                <span>Anleitung für iPhone / iPad:</span>
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px]">
                <li>
                  Tippe unten in Safari auf das <strong className="text-orange-400">Teilen-Symbol</strong>{' '}
                  <Share className="w-3.5 h-3.5 inline text-sky-400" />
                </li>
                <li>
                  Scrolle nach unten und tippe auf{' '}
                  <strong className="text-white">„Zum Home-Bildschirm“</strong>{' '}
                  <PlusSquare className="w-3.5 h-3.5 inline text-emerald-400" />
                </li>
                <li>
                  Tippe oben rechts auf <strong className="text-orange-400">„Hinzufügen“</strong>.
                </li>
              </ol>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
            >
              Verstanden
            </button>
          </div>
        ) : (
          <div className="space-y-3 text-xs text-slate-300">
            <p>
              Öffne das Browser-Menü (die drei Punkte ⋮ oben rechts in Chrome) und wähle{' '}
              <strong className="text-white">„App installieren“</strong> oder{' '}
              <strong className="text-white">„Zum Startbildschirm hinzufügen“</strong>.
            </p>
            <button
              onClick={onClose}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
            >
              Schließen
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
