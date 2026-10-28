import { apiPost, type ApiBase } from './client';

// KI-Spulenerkennung per Kamera (/api/recognize-spool)

export const recognizeApi = {
  recognizeSpool: (imageBase64: string, mimeType: string) =>
    apiPost<ApiBase & { spool?: any }>('/api/recognize-spool', { imageBase64, mimeType })
};
