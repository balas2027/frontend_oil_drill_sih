import axios from 'axios';

// Deployed backend (currently 500 - needs env vars configured on Vercel):
// const API_BASE_URL = 'https://backend-oil-drill-sih.vercel.app/api/v1';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('nwis_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('nwis_token');
      localStorage.removeItem('nwis_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
