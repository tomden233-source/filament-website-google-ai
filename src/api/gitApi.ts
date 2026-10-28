import { apiGet, apiPost, type ApiBase } from './client';

// Alle /api/git/* Aufrufe.

export interface GitResult extends ApiBase {
  hint?: string;
}

export const gitApi = {
  getConfig: () => apiGet<{ repoUrl?: string }>('/api/git/config'),

  testToken: (token: string, repoUrl: string) =>
    apiPost<GitResult & { valid?: boolean }>('/api/git/test-token', { token, repoUrl }),

  push: (payload: {
    repoUrl: string;
    token?: string;
    branch: string;
    commitMsg: string;
    haUrl?: string;
    haToken?: string;
  }) => apiPost<GitResult>('/api/git/push', payload)
};
