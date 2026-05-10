import { buildApiUrl } from './apiBase';
import { getToken } from '../utils/authToken';

const REQUEST_TIMEOUT = 30000;

async function request(endpoint, options = {}) {
  const token = getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(buildApiUrl(`/api/novel${endpoint}`), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
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
