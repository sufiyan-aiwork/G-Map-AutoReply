const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const { skipUnauthorizedHandler, ...fetchOptions } = options;
  const headers = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers || {}),
  };

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      credentials: 'include',
      headers,
    });
    if (!response.ok) {
      if (response.status === 401 && !skipUnauthorizedHandler && unauthorizedHandler) {
        unauthorizedHandler();
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Request failed with status ${response.status}`);
    }
    return await response.json();
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
  adminLogout: () =>
    request('/api/admin/logout', {
      method: 'POST',
      skipUnauthorizedHandler: true,
    }),
  getAdminSession: () =>
    request('/api/admin/me', {
      skipUnauthorizedHandler: true,
    }),

  // Dashboard Summary & Analytics
  getDashboardSummary: () => request('/api/dashboard/summary'),

  // Customer Reviews
  getReviews: (params = {}) => {
    const query = new URLSearchParams();
    if (params.rating) query.append('rating', params.rating);
    if (params.status) query.append('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/api/reviews${qs}`);
  },
  getReviewById: (id) => request(`/api/reviews/${id}`),
  previewReviewReply: (id) => request(`/api/reviews/${id}/preview-reply`),
  publishReviewReply: (id) => request(`/api/reviews/${id}/publish-reply`, {
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
  updateTemplate: (category, data) => request(`/api/replies/templates/${category}`, {
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
  getLogs: (limit = 50) => request(`/api/logs?limit=${limit}`),

  // Google Integration Status & OAuth
  getGoogleStatus: () => request('/api/auth/google/status'),
  getGoogleAuthUrl: () => request('/api/auth/google/login'),
  disconnectGoogle: () => request('/api/auth/google/disconnect', { method: 'POST' }),
};
