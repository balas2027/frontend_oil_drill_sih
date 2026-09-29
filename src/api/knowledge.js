import { apiClient } from './client';
import { clean } from './wells';

export const knowledgeApi = {
  search: (body) => apiClient.post('/search', clean(body)),
  ask: (body) => apiClient.post('/advisor/ask', clean(body)),
  feedback: (answerId, useful, comment) =>
    apiClient.post(`/advisor/${answerId}/feedback`, { useful, comment }),
  suggestions: (wellId) =>
    apiClient.get('/advisor/suggestions', { params: clean({ well_id: wellId }) }),
  history: () => apiClient.get('/advisor/history'),
  metrics: () => apiClient.get('/advisor/metrics'),
};

export const lessonsApi = {
  list: (params = {}) => apiClient.get('/lessons', { params: clean(params) }),
  get: (id) => apiClient.get(`/lessons/${id}`),
  draft: (eventIds) =>
    apiClient.get('/lessons/draft', { params: { event_ids: eventIds.join(',') } }),
  create: (body) => apiClient.post('/lessons', body),
  update: (id, body) => apiClient.patch(`/lessons/${id}`, body),
  remove: (id) => apiClient.delete(`/lessons/${id}`),
};

/** Split "text [1][3]" into plain text and citation-marker parts for rendering. */
export function splitCitations(sentence) {
  const parts = [];
  const rx = /\[(\d+)\]/g;
  let last = 0;
  let m;
  while ((m = rx.exec(sentence))) {
    if (m.index > last) parts.push({ text: sentence.slice(last, m.index) });
    parts.push({ cite: Number(m[1]) });
    last = rx.lastIndex;
  }
  if (last < sentence.length) parts.push({ text: sentence.slice(last) });
  return parts;
}
