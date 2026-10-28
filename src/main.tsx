import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { registerSW } from 'virtual:pwa-register';

// Service Worker (PWA): wird von vite-plugin-pwa erzeugt und passt sich dem Basispfad an (GitHub Pages: /Repo-Name/)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    registerSW({
      immediate: true,
      onRegisterError(err) {
        console.warn('SW registration notice:', err);
      }
    });
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
