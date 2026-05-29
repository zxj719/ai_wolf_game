import { buildApiUrl } from './apiBase';
import { getToken } from '../utils/authToken';

const REQUEST_TIMEOUT = 30000;
const READ_ONLY_METHODS = new Set(['GET', 'HEAD']);

async function request(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const token = getToken();
  // Only writes require auth; reads are public so guests/non-admins can browse novels.
  if (!READ_ONLY_METHODS.has(method) && !token) {
    throw new Error('Not authenticated');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(buildApiUrl(`/api/novel${endpoint}`), {
      ...options,
      headers,
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      throw new Error(data.error || `Request failed: ${response.status}`);
    }
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const novelService = {
  listProjects() {
    return request('/projects');
  },

  createProject(payload) {
    return request('/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getProject(projectName) {
    return request(`/projects/${encodeURIComponent(projectName)}`);
  },

  getChapter(projectName, chapterId) {
    return request(`/projects/${encodeURIComponent(projectName)}/chapters/${encodeURIComponent(chapterId)}`);
  },

  saveChapter(projectName, chapterId, content) {
    return request(`/projects/${encodeURIComponent(projectName)}/chapters/${encodeURIComponent(chapterId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    });
  },

  getCodexSession(projectName, targetDocument) {
    return request(`/projects/${encodeURIComponent(projectName)}/session`, {
      method: 'POST',
      body: JSON.stringify({ targetDocument }),
    });
  },

  saveMemoryFile(projectName, path, content) {
    return request(`/projects/${encodeURIComponent(projectName)}/memory`, {
      method: 'PATCH',
      body: JSON.stringify({ path, content }),
    });
  },

  generateNextChapter(projectName, options = {}) {
    const payload = typeof options === 'string' ? { guidance: options } : options;
    return request(`/projects/${encodeURIComponent(projectName)}/generate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getJob(jobId) {
    return request(`/jobs/${encodeURIComponent(jobId)}`);
  },
};
