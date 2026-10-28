// Gemeinsame API-Schicht: ein Ort für API-Key, JSON-Handling und Timeouts.
// Alle Aufrufe an das eigene Backend (/api/...) laufen hier durch.

import { IS_STATIC } from '../utils/env';

const API_KEY_STORAGE = 'app_api_key';

export interface ApiOptions {
  method?: string;
  /** Objekte werden automatisch als JSON gesendet */
  body?: unknown;
  /** Abbruch nach X Millisekunden (Standard: kein Timeout) */
  timeoutMs?: number;
  signal?: AbortSignal;
  cache?: RequestCache;
}

export interface ApiResult<T = any> {
  /** HTTP-Status 200-299 */
  ok: boolean;
  status: number;
  /** Geparste JSON-Antwort, bei leerer oder ungültiger Antwort ein leeres Objekt */
  data: T;
  /** true, wenn die Antwort wirklich JSON war */
  isJson: boolean;
}

/** Standard-Antwortformat des Servers */
export interface ApiBase {
  success?: boolean;
  error?: string;
  message?: string;
}

function readApiKey(): string | null {
  try {
    return localStorage.getItem(API_KEY_STORAGE);
  } catch {
    return null;
  }
}

/**
 * Wie fetch, hängt aber bei /api-Pfaden den optionalen API-Key an
 * (Server-Variable APP_API_KEY, im Browser unter localStorage 'app_api_key').
 * Externe URLs (z. B. Cloud-Sync) bekommen den Key nie.
 */
export function apiFetch(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  // GitHub Pages hat keinen Server: /api-Aufrufe gar nicht erst senden
  if (IS_STATIC && path.startsWith('/api')) {
    return Promise.resolve(
      new Response(
        JSON.stringify({ success: false, error: 'Nicht verfügbar auf GitHub Pages (kein Server). Dafür den Server auf dem Raspberry Pi oder Docker nutzen.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    );
  }
  const { timeoutMs, ...rest } = init;
  const headers = new Headers(rest.headers);
  const key = path.startsWith('/api') ? readApiKey() : null;
  if (key) headers.set('x-api-key', key);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let signal = rest.signal ?? undefined;
  if (timeoutMs && !signal) {
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), timeoutMs);
    signal = controller.signal;
  }

  return fetch(path, { ...rest, headers, signal }).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Sendet eine Anfrage und liefert Status plus JSON. Wirft nur bei Netzwerkfehlern oder Timeout,
 * nicht bei HTTP-Fehlern (dafür ok/status prüfen).
 */
export async function apiRequest<T = any>(path: string, options: ApiOptions = {}): Promise<ApiResult<T>> {
  const { method = 'GET', body, timeoutMs, signal, cache } = options;
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await apiFetch(path, { method, headers, body: payload, timeoutMs, signal, cache });
  const isJson = Boolean(res.headers.get('content-type')?.includes('application/json'));

  let data: any = {};
  try {
    const text = await res.text();
    if (text) data = JSON.parse(text);
  } catch {
    data = {};
  }
  return { ok: res.ok, status: res.status, data: data as T, isJson };
}

export const apiGet = <T = any>(path: string, options: Omit<ApiOptions, 'method' | 'body'> = {}) =>
  apiRequest<T>(path, { ...options, method: 'GET' });

export const apiPost = <T = any>(path: string, body?: unknown, options: Omit<ApiOptions, 'method' | 'body'> = {}) =>
  apiRequest<T>(path, { ...options, method: 'POST', body });
