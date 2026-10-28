// true im GitHub-Pages-Build (reines Frontend, kein Server). Wird in .github/workflows/pages.yml gesetzt.
export const IS_STATIC = import.meta.env.VITE_STATIC === 'true';

// true in der Android-App (Capacitor-Build, siehe .github/workflows/apk.yml)
export const IS_NATIVE = import.meta.env.VITE_NATIVE === 'true';

// Fester Download-Link der APK (GitHub Release "apk-latest", wird bei jedem Push auf main neu gebaut)
export const APK_URL =
  import.meta.env.VITE_APK_URL ||
  'https://github.com/tomden234/filament-website-google-ai/releases/latest/download/FilamentHub.apk';
