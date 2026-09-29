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
};
