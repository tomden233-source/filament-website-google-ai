// Link, den das QR-Etikett einer Spule enthält. Beim Scannen öffnet die App die Spule.
import { REPO } from './env';

export function appBaseUrl(): string {
  const [owner, repo] = REPO.split('/');
  return `https://${owner}.github.io/${repo}/`;
}

export function spoolLink(id: string): string {
  return `${appBaseUrl()}#s=${encodeURIComponent(id)}`;
}

/** Spulen-ID aus dem URL-Hash (#s=ID) lesen */
export function spoolIdFromHash(hash: string): string | null {
  const m = /[#&]s=([^&]+)/.exec(hash || '');
  return m ? decodeURIComponent(m[1]) : null;
}
