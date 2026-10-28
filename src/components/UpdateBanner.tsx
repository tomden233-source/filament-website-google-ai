import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { APK_URL, APP_VERSION, IS_NATIVE, REPO } from '../utils/env';

// Hinweis in der Android-App, wenn eine neuere APK bereitsteht (Web/PWA aktualisiert sich selbst).
// Android erlaubt es nicht, eine APK still im Hintergrund zu ersetzen: ein Tipp auf "Aktualisieren" lädt sie,
// danach nur "Installieren" bestätigen. Die Daten der App bleiben erhalten.

const parts = (v: string) => (v.match(/\d+/g) || []).map(Number);

function isNewer(a: string, b: string): boolean {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d > 0;
  }
  return false;
}

export const UpdateBanner: React.FC = () => {
  const [latest, setLatest] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!IS_NATIVE) return;
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/apk-latest`, {
          headers: { Accept: 'application/vnd.github+json' }
        });
        if (!res.ok) return;
        const json = await res.json();
        const m = String(json.name || '').match(/v(\d+(?:\.\d+)+)/);
        if (m && isNewer(m[1], APP_VERSION) && !cancelled) setLatest(m[1]);
      } catch {
        // offline oder GitHub nicht erreichbar: beim nächsten Start erneut prüfen
      }
    };

    check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!latest || hidden) return null;

  return (
    <div
      role="status"
      className="px-3 py-2 flex items-center gap-2 text-white text-xs font-bold shadow-md"
      style={{ backgroundColor: 'var(--app-accent)' }}
    >
      <Download className="w-4 h-4 shrink-0" />
      <span className="flex-1 min-w-0">Neue Version v{latest} verfügbar</span>
      <button
        onClick={() => {
          window.location.href = APK_URL;
        }}
        className="px-3 py-1 rounded-lg bg-white/25 hover:bg-white/35 transition cursor-pointer"
      >
        Aktualisieren
      </button>
      <button onClick={() => setHidden(true)} aria-label="Später" className="p-1 rounded-lg hover:bg-white/20 cursor-pointer">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
