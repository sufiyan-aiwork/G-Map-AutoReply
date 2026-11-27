const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

let unauthorizedHandler = null;
let csrfToken = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export function setCsrfToken(token) {
  csrfToken = token || null;
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const { skipUnauthorizedHandler, ...fetchOptions } = options;
  const method = (fetchOptions.method || 'GET').toUpperCase();
  const isUnsafeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  const hasBody = fetchOptions.body !== undefined && fetchOptions.body !== null;
  const headers = {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(isUnsafeMethod && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    ...(fetchOptions.headers || {}),
  };

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      method,
      credentials: 'include',
      headers,
    });
    if (!response.ok) {
      if (response.status === 401) {
        csrfToken = null;
        if (!skipUnauthorizedHandler && unauthorizedHandler) {
          unauthorizedHandler();
        }
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Request failed with status ${response.status}`);
    }
    if (response.status === 204) {
      return null;
    }
    const rawText = await response.text();
    const data = rawText ? JSON.parse(rawText) : null;
    if (data && typeof data === 'object' && 'csrf_token' in data) {
      csrfToken = data.csrf_token || null;
    }
    return data;
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error);
    throw error;
  }
}

export const api = {
  // Admin Authentication
  adminLogin: (username, password) =>
    request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      skipUnauthorizedHandler: true,
    }),
  adminLogout: async () => {
    try {
      return await request('/api/admin/logout', {
        method: 'POST',
        skipUnauthorizedHandler: true,
      });
    } finally {
      csrfToken = null;
    }
  },
  getAdminSession: () =>
    request('/api/admin/me', {
      skipUnauthorizedHandler: true,
    }),

  // Dashboard Summary & Analytics
  getDashboardSummary: (days = 'all') => {
    const qs = days != null && days !== 'all' ? `?days=${encodeURIComponent(days)}` : '';
    return request(`/api/dashboard/summary${qs}`);
  },

  // Customer Reviews
  getReviews: (params = {}) => {
    const query = new URLSearchParams();
    if (params.rating) query.append('rating', params.rating);
    if (params.status) query.append('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/api/reviews${qs}`);
  },
  getReviewById: (id) => request(`/api/reviews/${encodeURIComponent(id)}`),
  previewReviewReply: (id) => request(`/api/reviews/${encodeURIComponent(id)}/preview-reply`),
  publishReviewReply: (id) => request(`/api/reviews/${encodeURIComponent(id)}/publish-reply`, {
    method: 'POST',
  }),
  simulateReview: (data) => request('/api/reviews/test-simulate', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  syncReviewsNow: () => request('/api/reviews/sync-now', {
    method: 'POST',
  }),

  // Reply Templates
  getTemplates: () => request('/api/replies/templates'),
  updateTemplate: (category, data) => request(`/api/replies/templates/${encodeURIComponent(category)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // Automation Settings
  getAutomationStatus: () => request('/api/automation/status'),
  pauseAutomation: () => request('/api/automation/pause', { method: 'POST' }),
  resumeAutomation: () => request('/api/automation/resume', { method: 'POST' }),
  updateAutomationSettings: (data) => request('/api/automation/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // System Logs
  getLogs: (limit = 50) => request(`/api/logs?limit=${encodeURIComponent(limit)}`),

  // Google Integration Status & OAuth
  getGoogleStatus: () => request('/api/auth/google/status'),
  getGoogleAuthUrl: () => request('/api/auth/google/login'),
  disconnectGoogle: () => request('/api/auth/google/disconnect', { method: 'POST' }),
};
