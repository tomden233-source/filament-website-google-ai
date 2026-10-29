// Zugriff auf die Cloud-Datenbank (privater GitHub-Gist oder alt: npoint). Bei npoint läuft der Aufruf in der Windows-App über den eingebauten Server,
// weil das Fenster sonst vom Browser-Schutz (CORS) blockiert werden kann („Failed to fetch“).
import { IS_DESKTOP } from './env';
import { gistFetch, isGistUrl } from './gistStore';

export async function cloudFetch(url: string, init: { method?: string; body?: string; cache?: RequestCache; headers?: Record<string, string> } = {}): Promise<Response> {
  // Privater GitHub-Gist („gist:<ID>“): api.github.com erlaubt Zugriffe aus dem Browser, auch in der Windows-App
  if (isGistUrl(url)) return gistFetch(url, init);
  if (!IS_DESKTOP) return fetch(url, init);
  // Windows-App ab 1.95: über das Hauptprogramm (Windows-Zertifikate, kein CORS)
  const bridge = (window as any).desktop;
  if (bridge?.cloudFetch) {
    const r: { status: number; text: string } = await bridge.cloudFetch({ url, method: init.method || 'GET', body: init.body });
    return new Response(r.text, { status: r.status, headers: { 'Content-Type': 'application/json' } });
  }
  return fetch('/api/cloud-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, method: init.method || 'GET', body: init.body })
  });
}
