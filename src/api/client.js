import axios from 'axios';
import { useUiStore } from '../store/uiStore';

const rawBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const API_BASE_URL = rawBaseUrl.endsWith('/api/v1')
  ? rawBaseUrl
  : `${rawBaseUrl.replace(/\/+$/, '')}/api/v1`;

export const TOKEN_KEY = 'nwis_token';
export const REFRESH_KEY = 'nwis_refresh';
export const USER_KEY = 'nwis_user';

/** WebSocket URL for an API path (same host as the REST API, token in the query string). */
export function wsUrl(path) {
  const base = new URL(API_BASE_URL, window.location.origin);
  const proto = base.protocol === 'https:' ? 'wss:' : 'ws:';
  const token = localStorage.getItem(TOKEN_KEY) || '';
  return `${proto}//${base.host}${base.pathname.replace(/\/+$/, '')}${path}?token=${encodeURIComponent(token)}`;
}

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

// Attach token to requests; refuse writes while offline (reads may come from the PWA cache)
apiClient.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  if (method !== 'get' && typeof navigator !== 'undefined' && navigator.onLine === false) {
    const err = new Error('You are offline - changes are disabled until the connection returns.');
    err.response = { data: { error: { message: err.message } } };
    return Promise.reject(err);
  }
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
  (response) => {
    useUiStore.getState().markSynced();
    return response;
  },
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
