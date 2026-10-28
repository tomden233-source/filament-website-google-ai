import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { registerSW } from 'virtual:pwa-register';
import { IS_NATIVE } from './utils/env';
import { applySystemBars } from './utils/systemBars';
import { installNativeNfc } from './utils/nativeNfc';

// Android-App: NFC über das native Plugin (Web NFC gibt es in der WebView nicht)
installNativeNfc();

// Service Worker (PWA): erzeugt von vite-plugin-pwa, Basispfad passt sich an (GitHub Pages: /Repo-Name/).
// In der Android-App nicht nötig (die Dateien stecken in der App), dort würde er nur alte Stände festhalten.
if (!IS_NATIVE && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    registerSW({
      immediate: true,
      onRegisteredSW(_url, registration) {
        if (!registration) return;
        // Neue Version automatisch holen: alle 15 Minuten und sobald die App wieder in den Vordergrund kommt.
        // Die neue Version wird dann ohne Zutun geladen (registerType: autoUpdate).
        const check = () => registration.update().catch(() => {});
        setInterval(check, 15 * 60 * 1000);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });
      },
      onRegisterError(err) {
        console.warn('SW registration notice:', err);
      }
    });
  } catch (e) {
    console.warn('Service Worker registration skipped:', e);
  }
}

// Systemleisten passend zum Theme färben (Android-App noch einmal kurz nach dem Start, falls die Brücke später bereit ist)
setTimeout(applySystemBars, 800);

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
