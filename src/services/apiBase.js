// Shared API base handling for auth/game services.

const rawBase = (import.meta.env.VITE_AUTH_API_URL || '').trim();
const isDev = import.meta.env.DEV;
const fallbackBase = isDev ? 'http://localhost:8787' : '';

const normalizedBase = (rawBase || fallbackBase).replace(/\/+$/, '');

export const API_BASE = normalizedBase;

export function buildApiUrl(endpoint) {
  const safeEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (!API_BASE) {
    return safeEndpoint;
  }

  // Avoid double "/api" if the base already ends with it.
  if (API_BASE.endsWith('/api') && safeEndpoint.startsWith('/api/')) {
    return `${API_BASE}${safeEndpoint.slice(4)}`;
  }

  return `${API_BASE}${safeEndpoint}`;
}
