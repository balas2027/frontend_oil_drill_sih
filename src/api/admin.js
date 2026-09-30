import { apiClient } from './client';
import { clean } from './wells';

export const dashboardApi = {
  get: (params = {}) => apiClient.get('/dashboard', { params: clean(params) }),
};

export const adminApi = {
  users: () => apiClient.get('/users'),
  createUser: (body) => apiClient.post('/users', body),
  updateUser: (id, body) => apiClient.patch(`/users/${id}`, body),
  audit: (params = {}) => apiClient.get('/audit', { params: clean(params) }),
  metrics: () => apiClient.get('/metrics'),
  sources: () => apiClient.get('/admin/sources'),
  models: () => apiClient.get('/admin/models'),
  notifications: () => apiClient.get('/admin/notifications'),
  saveNotifications: (body) => apiClient.put('/admin/notifications', body),
  testEmail: (to) => apiClient.post('/admin/notifications/test', { to }),
  emailLog: (limit = 50) => apiClient.get('/admin/notifications/log', { params: { limit } }),
};

export const learningApi = {
  status: () => apiClient.get('/learning/status'),
  runs: (limit = 20) => apiClient.get('/learning/runs', { params: { limit } }),
  start: (retrain = 'auto') => apiClient.post('/learning/run', null, { params: { retrain } }),
  updateSchedule: (body) => apiClient.patch('/learning/schedule', body),
};
