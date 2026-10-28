// Färbt die Systemleisten passend zum gewählten Theme:
//  - Android-App: Statusleiste = Hintergrundfarbe, untere Navigationsleiste = Akzentfarbe (über das kleine Plugin FilamentBars)
//  - Web/PWA: <meta name="theme-color"> = Hintergrundfarbe (Android färbt die Statusleiste damit)
import { IS_NATIVE } from './env';

function cssVar(name: string, fallback: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

export function applySystemBars(): void {
  if (typeof document === 'undefined') return;
  const bg = cssVar('--app-bg', '#d6dce5');
  const accent = cssVar('--app-accent', '#f97316');

  try {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', bg);
  } catch {
    // Meta-Tag nicht änderbar, egal
  }

  if (IS_NATIVE) {
    try {
      const cap = (window as any).Capacitor;
      const opts = { status: bg, nav: accent };
      if (typeof cap?.nativePromise === 'function') {
        cap.nativePromise('FilamentBars', 'setBars', opts).catch(() => {});
      } else {
        cap?.Plugins?.FilamentBars?.setBars?.(opts);
      }
    } catch {
      // Native Leiste nicht verfügbar (z. B. alte App-Version), egal
    }
  }
}
