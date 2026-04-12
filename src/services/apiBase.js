// Shared API base handling for auth/game services.

export function resolveApiBase(rawBase, isDev) {
  const trimmedBase = (rawBase || '').trim();
  const fallbackBase = isDev ? 'http://localhost:8787' : '';

  if (!trimmedBase) {
    return fallbackBase;
  }

  // In local development, ignore accidentally configured remote worker URLs.
  // This repo expects dev traffic to hit the local Wrangler worker.
  if (isDev && /\.workers\.dev(?:\/|$)/i.test(trimmedBase)) {
    return fallbackBase;
  }

  return trimmedBase.replace(/\/+$/, '');
}

const rawBase = import.meta.env.VITE_AUTH_API_URL;
const isDev = import.meta.env.DEV;

export const API_BASE = resolveApiBase(rawBase, isDev);

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
