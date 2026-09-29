import { apiClient } from './client';
import { clean } from './wells';

export const documentsApi = {
  /**
   * @param {File} file
   * @param {{ wellId?: string, onProgress?: (fraction: number) => void }} [opts]
   */
  upload: (file, { wellId, onProgress } = {}) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post('/documents/upload', form, {
      params: clean({ well_id: wellId }),
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => onProgress?.(e.total ? e.loaded / e.total : 0),
    });
  },
  list: (params = {}) => apiClient.get('/documents', { params: clean(params) }),
  get: (docId) => apiClient.get(`/documents/${docId}`),
  status: (docId) => apiClient.get(`/documents/${docId}/status`),
  items: (docId) => apiClient.get(`/documents/${docId}/items`),
  page: (docId, pageNo) => apiClient.get(`/documents/${docId}/pages/${pageNo}`),
  file: (docId) => apiClient.get(`/documents/${docId}/file`, { responseType: 'arraybuffer' }),
  reprocess: (docId, forceOcr = false) =>
    apiClient.post(`/documents/${docId}/reprocess`, null, { params: { force_ocr: forceOcr } }),
  update: (docId, body) => apiClient.patch(`/documents/${docId}`, body),
  remove: (docId) => apiClient.delete(`/documents/${docId}`),
  metrics: () => apiClient.get('/documents/metrics'),
};

export const reviewApi = {
  queue: (params = {}) => apiClient.get('/review/queue', { params: clean(params) }),
  get: (itemId) => apiClient.get(`/review/${itemId}`),
  approve: (itemId, body = {}) => apiClient.post(`/review/${itemId}/approve`, body),
  reject: (itemId, reason) => apiClient.post(`/review/${itemId}/reject`, { reason }),
  batchApprove: (body) => apiClient.post('/review/batch-approve', body),
};

export const PIPELINE_STEPS = [
  { agent: 'ingestion', label: 'Ingest' },
  { agent: 'ocr', label: 'OCR' },
  { agent: 'extraction', label: 'Extract' },
  { agent: 'normalisation', label: 'Normalise' },
  { agent: 'validation', label: 'Validate' },
  { agent: 'indexing', label: 'Index' },
];
