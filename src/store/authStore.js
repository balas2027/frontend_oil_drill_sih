import { create } from 'zustand';
import {
  apiClient,
  apiErrorMessage,
  clearSession,
  storeSession,
  TOKEN_KEY,
  USER_KEY,
} from '../api/client';

function storedUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

/** Role checks mirror the backend RBAC matrix. */
export const canReview = (user) => ['reviewer', 'admin'].includes(user?.role);
/** Engineers and above acknowledge / rate alerts; viewers only read. */
export const canActOnAlerts = (user) => ['engineer', 'reviewer', 'admin'].includes(user?.role);
export const isAdmin = (user) => user?.role === 'admin';

export const useAuthStore = create((set) => ({
  user: storedUser(),
  token: localStorage.getItem(TOKEN_KEY) || null,
  isAuthenticated: !!localStorage.getItem(TOKEN_KEY),
  loading: false,
  error: null,

  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);

      const response = await apiClient.post('/auth/login', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      storeSession(response.data);
      set({
        token: response.data.access_token,
        user: response.data.user,
        isAuthenticated: true,
        loading: false,
        error: null,
      });
      return true;
    } catch (err) {
      set({
        error: apiErrorMessage(err, 'Login failed. Please check credentials.'),
        loading: false,
      });
      return false;
    }
  },

  logout: () => {
    clearSession();
    // Cached API responses (PWA offline cache) must not outlive the session
    if (typeof caches !== 'undefined') caches.delete('nwis-api').catch(() => {});
    set({ user: null, token: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      set({ isAuthenticated: false, user: null });
      return;
    }
    try {
      // The client interceptor refreshes an expired access token transparently
      const res = await apiClient.get('/auth/me');
      set({ user: res.data, isAuthenticated: true, token: localStorage.getItem(TOKEN_KEY) });
    } catch (err) {
      // No response = offline / API unreachable: keep the stored session so the
      // PWA can show cached data. Only a rejection by the server ends the session.
      if (!err?.response) return;
      clearSession();
      set({ user: null, token: null, isAuthenticated: false });
    }
  },
}));
