import { apiClient } from './client';
import { clean } from './wells';

export const riskApi = {
  lookahead: (wellId, params = {}) =>
    apiClient.get(`/risk/${wellId}/lookahead`, { params: clean(params) }),
  preSpudBrief: (wellId, params = {}) =>
    apiClient.get(`/risk/${wellId}/pre-spud-brief`, { params: clean(params) }),
  model: () => apiClient.get('/risk/model'),
  train: () => apiClient.post('/risk/train'),
  briefPdf: (wellId, params = {}) =>
    apiClient.get(`/risk/${wellId}/pre-spud-brief.pdf`, {
      params: clean(params),
      responseType: 'blob',
    }),
};

/** Fetch the pre-spud brief PDF (authenticated) and hand it to the browser as a download. */
export async function downloadBriefPdf(wellId, radiusKm) {
  const res = await riskApi.briefPdf(wellId, { radius_km: radiusKm });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `NWIS_pre-spud_brief_${wellId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export const alertsApi = {
  list: (params = {}) => apiClient.get('/alerts', { params: clean(params) }),
  summary: (wellId) => apiClient.get('/alerts/summary', { params: clean({ well_id: wellId }) }),
  ack: (id) => apiClient.post(`/alerts/${id}/ack`),
  dismiss: (id) => apiClient.post(`/alerts/${id}/dismiss`),
  resolve: (id) => apiClient.post(`/alerts/${id}/resolve`),
  feedback: (id, useful, comment) => apiClient.post(`/alerts/${id}/feedback`, { useful, comment }),
};

export const simulatorApi = {
  status: () => apiClient.get('/simulate/status'),
  start: ({ wellId, speed, startMd, radiusKm }) =>
    apiClient.post('/simulate/start', null, {
      params: clean({ well_id: wellId, speed, start_md: startMd, radius_km: radiusKm }),
    }),
  stop: (wellId) => apiClient.post('/simulate/stop', null, { params: { well_id: wellId } }),
  snapshot: (wellId) => apiClient.get(`/live/${wellId}`),
};
