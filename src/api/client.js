import axios from 'axios';

const rawBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const API_BASE_URL = rawBaseUrl.endsWith('/api/v1')
  ? rawBaseUrl
  : `${rawBaseUrl.replace(/\/+$/, '')}/api/v1`;

export const TOKEN_KEY = 'nwis_token';
export const REFRESH_KEY = 'nwis_refresh';
export const USER_KEY = 'nwis_user';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function storeSession({ access_token, refresh_token, user }) {
  localStorage.setItem(TOKEN_KEY, access_token);
  if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Pull a human-readable message out of the API's error envelope. */
export function apiErrorMessage(err, fallback = 'Request failed.') {
  const data = err?.response?.data;
  return (
    data?.error?.message || (typeof data?.detail === 'string' ? data.detail : null) || fallback
  );
}

// Attach token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// One refresh at a time; concurrent 401s wait for the same promise
let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) throw new Error('No refresh token');
  // Plain axios call so this request bypasses the interceptors below
  const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
  storeSession(res.data);
  return res.data.access_token;
}

function redirectToLogin() {
  clearSession();
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

// Expired access token -> refresh once and retry; otherwise send to login
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;
    const isAuthCall =
      config?.url?.startsWith('/auth/login') || config?.url?.startsWith('/auth/refresh');
    if (response?.status !== 401 || isAuthCall) {
      return Promise.reject(error);
    }
    if (config._retried) {
      redirectToLogin();
      return Promise.reject(error);
    }
    try {
      refreshPromise =
        refreshPromise || refreshAccessToken().finally(() => (refreshPromise = null));
      const token = await refreshPromise;
      config._retried = true;
      config.headers.Authorization = `Bearer ${token}`;
      return apiClient(config);
    } catch {
      redirectToLogin();
      return Promise.reject(error);
    }
  }
);
