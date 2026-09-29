import { apiClient } from './client';

/** Drop empty-string params so the API only sees filters that are set. */
const clean = (params) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null));

export const wellsApi = {
  listWells: (params = {}) => apiClient.get('/wells', { params: clean(params) }),
  getWell: (wellId) => apiClient.get(`/wells/${wellId}`),
  getFilterOptions: () => apiClient.get('/wells/filters'),
  getWellTops: (wellId) => apiClient.get(`/wells/${wellId}/tops`),
  getWellTrajectory: (wellId) => apiClient.get(`/wells/${wellId}/trajectory`),
  getWellTimeline: (wellId) => apiClient.get(`/wells/${wellId}/timeline`),
};

export const nearbyApi = {
  getNearbyWells: (params) => apiClient.get('/nearby', { params: clean(params) }),
};

export const eventsApi = {
  listEvents: (params = {}) => apiClient.get('/events', { params: clean(params) }),
  getEvent: (eventId) => apiClient.get(`/events/${eventId}`),
  getEventsGeo: (params = {}) => apiClient.get('/events/geo', { params: clean(params) }),
};
