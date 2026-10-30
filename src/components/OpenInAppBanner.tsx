import React, { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { appIntentLink, spoolIdFromHash } from '../utils/spoolLink';
import { IS_DESKTOP, isAppShell } from '../utils/env';

/**
 * Wer ein QR-Etikett mit der Kamera scannt, landet im Handy-Browser. Ist die Android-App installiert,
 * öffnet dieser Knopf sie direkt bei der Spule.
 */
export const OpenInAppBanner: React.FC = () => {
  const [hidden, setHidden] = useState(false);

  // Gleich beim Öffnen einmal versuchen, die App zu starten (Chrome erlaubt das nicht immer ohne Tipp: dann bleibt der Knopf)
  useEffect(() => {
    if (typeof window === 'undefined' || IS_DESKTOP || isAppShell() || !/Android/i.test(navigator.userAgent)) return;
    const id = spoolIdFromHash(window.location.hash);
    if (!id) return;
    const key = `filamenthub_auto_open_${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      /* ohne Speicher: trotzdem einmal versuchen */
    }
    const t = window.setTimeout(() => {
      window.location.href = appIntentLink(id, window.location.href);
    }, 400);
    return () => window.clearTimeout(t);
  }, []);

  if (hidden || typeof window === 'undefined' || IS_DESKTOP || isAppShell()) return null;
  if (!/Android/i.test(navigator.userAgent)) return null;
  const id = spoolIdFromHash(window.location.hash);
  if (!id) return null;
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b" style={{ backgroundColor: 'var(--app-accent-sub)', borderColor: 'var(--app-accent)', color: 'var(--app-text)' }}>
      <Smartphone className="w-5 h-5 shrink-0" style={{ color: 'var(--app-accent-text)' }} />
      <span className="text-xs font-bold flex-1 min-w-0">Diese Spule direkt in der App öffnen</span>
      <a href={appIntentLink(id, window.location.href)} className="px-3 py-1.5 rounded-lg text-xs font-extrabold text-white shrink-0" style={{ backgroundColor: 'var(--app-accent)' }}>
        In der App öffnen
      </a>
      <button onClick={() => setHidden(true)} className="p-1 cursor-pointer shrink-0" style={{ color: 'var(--app-text-muted)' }} aria-label="Schließen">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
