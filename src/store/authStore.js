import { create } from 'zustand';
import { apiClient } from '../api/client';

export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('nwis_user') || 'null'),
  token: localStorage.getItem('nwis_token') || null,
  isAuthenticated: !!localStorage.getItem('nwis_token'),
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

      const { access_token, user } = response.data;

      localStorage.setItem('nwis_token', access_token);
      localStorage.setItem('nwis_user', JSON.stringify(user));

      set({
        token: access_token,
        user,
        isAuthenticated: true,
        loading: false,
        error: null,
      });

      return true;
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Login failed. Please check credentials.';
      set({ error: errMsg, loading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('nwis_token');
    localStorage.removeItem('nwis_user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('nwis_token');
    if (!token) {
      set({ isAuthenticated: false, user: null });
      return;
    }
    try {
      const res = await apiClient.get('/auth/me');
      set({ user: res.data, isAuthenticated: true });
    } catch (e) {
      localStorage.removeItem('nwis_token');
      localStorage.removeItem('nwis_user');
      set({ user: null, token: null, isAuthenticated: false });
    }
  },
}));
