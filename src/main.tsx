import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { registerSW } from 'virtual:pwa-register';

// Optionaler API-Key: Ist auf dem Server APP_API_KEY gesetzt, wird er hier aus dem Browser
// (localStorage 'app_api_key') an alle /api-Aufrufe angehängt.
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
      const key = localStorage.getItem('app_api_key');
      if (key && url.startsWith('/api')) {
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
        headers.set('x-api-key', key);
        return originalFetch(input, { ...init, headers });
      }
    } catch {
      // ohne Key weiter wie bisher
    }
    return originalFetch(input, init);
  };
}

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
