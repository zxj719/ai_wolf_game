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

  getProject(projectName) {
    return request(`/projects/${encodeURIComponent(projectName)}`);
  },

  getChapter(projectName, chapterId) {
    return request(`/projects/${encodeURIComponent(projectName)}/chapters/${encodeURIComponent(chapterId)}`);
  },

  generateNextChapter(projectName, guidance) {
    return request(`/projects/${encodeURIComponent(projectName)}/generate`, {
      method: 'POST',
      body: JSON.stringify({ guidance }),
    });
  },

  getJob(jobId) {
    return request(`/jobs/${encodeURIComponent(jobId)}`);
  },
};
