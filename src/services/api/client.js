/**
 * 统一 fetch 客户端 — 自动注入 base URL 与 Authorization。
 *
 * 用法：
 *   const api = createApiClient('cf-workers', { getAuthToken: () => getToken() });
 *   const data = await api.get('/api/user/stats');
 *   await api.post('/api/game/record', { role: '狼人', result: 'win' });
 *
 * Phase 2 定义，Phase 3+ 逐步接入各模块。services/apiBase.js 保留 thin shim
 * 以兼容旧调用。
 */

import { getBackend } from './registry';

function buildHeaders(token, extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export function createApiClient(backendKey, { getAuthToken } = {}) {
  const backend = getBackend(backendKey);
  const baseUrl = backend.baseUrl || '';

  async function request(method, path, { body, headers, signal, token } = {}) {
    const resolvedToken =
      token ?? (typeof getAuthToken === 'function' ? getAuthToken() : null);

    const safePath = path.startsWith('/') || path.startsWith('http') ? path : `/${path}`;
    const url = safePath.startsWith('http') ? safePath : `${baseUrl}${safePath}`;

    const init = {
      method,
      headers: buildHeaders(resolvedToken, headers),
      signal,
    };

    if (body !== undefined) {
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const res = await fetch(url, init);
    const text = await res.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = text; }
    }

    if (!res.ok) {
      const error = new Error(
        data?.error || data?.message || `${method} ${path} → ${res.status}`
      );
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  return {
    backendKey,
    baseUrl,
    get:    (path, opts) => request('GET',    path, opts),
    post:   (path, body, opts) => request('POST',   path, { ...opts, body }),
    put:    (path, body, opts) => request('PUT',    path, { ...opts, body }),
    delete: (path, opts) => request('DELETE', path, opts),
  };
}
