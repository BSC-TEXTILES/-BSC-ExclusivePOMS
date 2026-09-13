import axios from 'axios';

// Cross-origin deployments (Vercel frontend → Render backend) set
// VITE_API_BASE to e.g. https://poms-api.onrender.com/api ; single-origin
// deployments leave it unset and the same server serves both.
export const API_BASE = import.meta.env.VITE_API_BASE || '/api';
// Origin of the API server — used to build absolute URLs for locally-stored
// files (Supabase-stored files already carry absolute public URLs).
export const API_ORIGIN = API_BASE.startsWith('http')
  ? new URL(API_BASE).origin
  : '';

// Prefix app-relative file URLs (/uploads/...) with the API origin when the
// frontend runs on a different origin than the backend.
export const assetUrl = (url) => {
  if (!url) return url;
  if (/^(https?:|data:|blob:)/.test(url)) return url;
  return `${API_ORIGIN}${url}`;
};

const api = axios.create({ baseURL: API_BASE });

// ─── Token integration ──────────────────────────────────────────────────────
// A module-level getter is set by the AuthProvider so that the Axios
// interceptor can attach the current JWT without importing React hooks.
let _getToken = null;
export function setTokenGetter(fn) { _getToken = fn; }

api.interceptors.request.use(async (cfg) => {
  if (_getToken) {
    try {
      const token = await _getToken();
      if (token) cfg.headers.Authorization = `Bearer ${token}`;
    } catch { /* ignore — will result in 401 from backend */ }
  }
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      // Session expired — just redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const errMessage = (e) => {
  if (!e) return 'Request failed';

  // Network errors (no response received)
  if (!e.response) {
    if (e.code === 'ERR_NETWORK') {
      return 'Backend server is not running. Please start the backend server and ensure it is accessible at http://localhost:4040';
    }
    if (e.message?.includes('ECONNREFUSED') || e.message?.includes('Failed to fetch')) {
      return 'Cannot connect to backend server. Please start the backend server on port 4040.';
    }
    return `Network error: ${e.message || 'Unknown error'}`;
  }

  // Server errors
  if (e.response.status >= 500) {
    return `Server error: ${e.response.status} - ${e.response.data?.error?.message || 'Internal server error'}`;
  }

  // Other errors with response
  return e.response.data?.error?.message || e.message || 'Request failed';
};

// Multipart upload helper — every file type accepted server-side (200 MB cap).
export const uploadFile = (path, files, field = 'files') => {
  const fd = new FormData();
  for (const f of Array.isArray(files) ? files : [files]) fd.append(field, f);
  return api.post(path, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};

export const formatBytes = (n) => {
  if (!n && n !== 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
};

// Human icon for any mime type — used in attachment drawers.
export const fileKind = (mime = '', name = '') => {
  const m = mime.toLowerCase(), ext = (name.split('.').pop() || '').toLowerCase();
  if (m.startsWith('image/')) return { icon: 'image', label: 'Image' };
  if (m.startsWith('video/') || ['mp4', 'mkv', 'avi', 'mov', 'webm', 'wmv', 'flv', '3gp'].includes(ext)) return { icon: 'video', label: 'Video' };
  if (m === 'application/pdf' || ext === 'pdf') return { icon: 'file', label: 'PDF' };
  if (['xlsx', 'xls', 'csv', 'ods'].includes(ext) || m.includes('spreadsheet') || m.includes('excel') || m === 'text/csv') return { icon: 'reports', label: 'Spreadsheet' };
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext) || m.includes('word')) return { icon: 'file', label: 'Document' };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || m.includes('zip') || m.includes('compressed')) return { icon: 'file', label: 'Archive' };
  if (m.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return { icon: 'video', label: 'Audio' };
  return { icon: 'file', label: 'File' };
};

export default api;
// ── Import / Data Import API helpers (admin-only) ──────────────────────────
export const importUpload = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post('/import/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const importConfirm = (importId, mapping) =>
  api.post(`/import/${importId}/confirm`, { mapping });
export const importHistory = (params = {}) =>
  api.get('/import/history', { params });
export const importCancel = (importId) =>
  api.delete(`/import/${importId}`);
export const importRecords = (importId) =>
  api.get(`/import/${importId}/records`);
