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

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('poms_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('poms_token');
      localStorage.removeItem('poms_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const errMessage = (e) =>
  e?.response?.data?.error?.message || e?.message || 'Request failed';

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
