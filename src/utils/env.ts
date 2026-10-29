// true im GitHub-Pages-Build (reines Frontend, kein Server). Wird in .github/workflows/pages.yml gesetzt.
export const IS_STATIC = import.meta.env.VITE_STATIC === 'true';

// true in der Android-App (Capacitor-Build, siehe .github/workflows/apk.yml)
export const IS_NATIVE = import.meta.env.VITE_NATIVE === 'true';

// Fester Download-Link der APK (GitHub Release "apk-latest", wird bei jedem Push auf main neu gebaut)
export const APK_URL =
  import.meta.env.VITE_APK_URL ||
  'https://github.com/tomden234/filament-website-google-ai/releases/download/apk-latest/FilamentHub.apk';

/** Installierte Web-App (PWA im Standalone-Modus) oder Android-App: läuft ohne Browser-Leiste */
export function isAppShell(): boolean {
  if (IS_NATIVE) return true;
  try {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  } catch {
    return false;
  }
}

/** Versionsnummer dieses Builds (aus package.json, wird beim Bauen eingesetzt) */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

/** GitHub-Repository, aus dem Updates und die APK kommen */
export const REPO = 'tomden234/filament-website-google-ai';

// Windows-App (Electron, Release "desktop-latest")
export const IS_DESKTOP = typeof navigator !== 'undefined' && /Electron\//.test(navigator.userAgent);
export const DESKTOP_URL = 'https://github.com/tomden234/filament-website-google-ai/releases/download/desktop-latest/FilamentHub-Setup.exe';
