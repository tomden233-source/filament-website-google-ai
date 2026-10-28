import { apiGet, apiPost, type ApiBase } from './client';

// Server-Speicher (/api/storage/*) und optionaler Cloud-Sync (externer JSON-Speicher).

export interface StorageStatsResponse extends ApiBase {
  stats?: { manualUsedGrams?: number; [key: string]: any };
}

export const storageApi = {
  getStats: () => apiGet<StorageStatsResponse>('/api/storage/stats'),
  saveManualUsedGrams: (manualUsedGrams: number) =>
    apiPost<ApiBase>('/api/storage/stats', { manualUsedGrams })
};

export interface CloudPayload {
  updatedAt?: number;
  spools?: unknown[];
  printHistory?: unknown[];
}

/**
 * Cloud-Sync gegen eine externe URL. Bewusst mit normalem fetch (nicht apiFetch),
 * damit der interne API-Key nie an Fremdserver gesendet wird.
 */
export const cloudSync = {
  async load(url: string): Promise<{ ok: boolean; data: CloudPayload | null }> {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { ok: false, data: null };
    return { ok: true, data: (await res.json()) as CloudPayload };
  },
  async save(url: string, payload: CloudPayload): Promise<boolean> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.ok;
  }
};
