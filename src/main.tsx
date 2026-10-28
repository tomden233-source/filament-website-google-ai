import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { registerSW } from 'virtual:pwa-register';

// Hinweis: Der optionale API-Key (APP_API_KEY) wird jetzt zentral in src/api/client.ts angehängt.

// Service-Worker Handling: Im iFrame (AI Studio Preview) keine Caches erzwingen
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    const isIframe = window.self !== window.top;
    if (isIframe) {
      // Im iFrame Service Worker deregistrieren, damit keine Caching-Konflikte auftreten
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) {
          reg.unregister().catch(() => {});
        }
      }).catch(() => {});
    } else {
      registerSW({
        immediate: true,
        onRegisterError(err) {
          console.warn('SW registration notice:', err);
        }
      });
    }
  } catch (e) {
    console.warn('Service Worker registration skipped:', e);
  }
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
