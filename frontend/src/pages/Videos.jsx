import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMessage, formatBytes } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { formatDuration } from '../components/VideoPlayer.jsx';

const CATEGORY_LABELS = {
  training: 'Training', product: 'Product', process: 'Process', marketing: 'Marketing', other: 'Other',
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Videos() {
  const { hasPermission, user } = useAuth();
  const isSuperAdmin = user?.isSuperAdmin;
  const [videos, setVideos] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'training', module: '' });
  const [file, setFile] = useState(null);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (category) params.category = category;
      const { data } = await api.get('/videos', { params });
      setVideos(data.data);
      setError('');
    } catch (e) {
      setError(errMessage(e));
      setVideos([]);
    }
  }, [search, category]);

  useEffect(() => { load(); }, [load]);

  async function submitUpload(e) {
    e.preventDefault();
    setFormError('');
    if (!form.title.trim()) { setFormError('Title is required'); return; }
    if (!file) { setFormError('Please choose a video file'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', form.title.trim());
      fd.append('description', form.description.trim());
      fd.append('category', form.category);
      if (form.module.trim()) fd.append('module', form.module.trim());
      await api.post('/videos', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setShowUpload(false);
      setForm({ title: '', description: '', category: 'training', module: '' });
      setFile(null);
      load();
    } catch (err) {
      setFormError(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function archiveVideo(v) {
    if (!window.confirm(`Archive "${v.title}"? It will no longer appear in the library.`)) return;
    try {
      await api.delete(`/videos/${v.id}`);
      load();
    } catch (e) {
      alert(errMessage(e));
    }
  }

  const canManage = hasPermission('videos.manage') || isSuperAdmin;

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Video Library</h1>
          <p className="page-sub">Training, product and process videos for the team</p>
        </div>
        {canManage && (
          <button className="btn primary" onClick={() => setShowUpload(true)}>
            <Icon name="upload" size={15} /> Upload Video
          </button>
        )}
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Icon name="search" size={15} />
          <input placeholder="Search videos by title, description or module…" value={search}
            onChange={(e) => setSearch(e.target.value)} aria-label="Search videos" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {error && <div className="alert error">{error}</div>}

      {!videos && !error && (
        <div className="video-grid">
          {[1, 2, 3, 4].map((i) => <div key={i} className="video-card skeleton-card"><div className="sk sk-thumb" /><div className="sk sk-line" /><div className="sk sk-line short" /></div>)}
        </div>
      )}

      {videos && videos.length === 0 && (
        <div className="empty-state">
          <Icon name="video" size={40} />
          <h3>No videos found</h3>
          <p>{search || category ? 'Try changing your search or filters.' : 'Upload or add a video to display it here.'}</p>
          {canManage && !search && !category && (
            <button className="btn primary" onClick={() => setShowUpload(true)}><Icon name="upload" size={15} /> Upload first video</button>
          )}
        </div>
      )}

      {videos && videos.length > 0 && (
        <div className="video-grid">
          {videos.map((v) => (
            <Link key={v.id} to={`/videos/${v.id}`} className="video-card" aria-label={`Open video: ${v.title}`}>
              <div className="video-thumb">
                {v.thumbnailUrl
                  ? <img src={v.thumbnailUrl} alt="" loading="lazy" />
                  : <video src={v.url} preload="metadata" muted tabIndex={-1} />}
                <span className="video-play-badge" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                </span>
                {v.duration_seconds != null && <span className="video-duration">{formatDuration(v.duration_seconds)}</span>}
              </div>
              <div className="video-meta">
                <div className="video-title" title={v.title}>{v.title}</div>
                <div className="video-sub">
                  <span className={`chip cat-${v.category}`}>{CATEGORY_LABELS[v.category] || v.category}</span>
                  {v.module && <span className="video-module">{v.module.replace(/_/g, ' ')}</span>}
                </div>
                <div className="video-sub">
                  {v.uploaded_by_name ? `By ${v.uploaded_by_name}` : 'Unknown'} · {fmtDate(v.created_at)}
                  {v.size_bytes ? ` · ${formatBytes(v.size_bytes)}` : ''}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showUpload && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowUpload(false); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Upload video">
            <div className="modal-head">
              <h3>Upload Video</h3>
              <button className="icon-btn" onClick={() => setShowUpload(false)} aria-label="Close"><Icon name="x" size={16} /></button>
            </div>
            <form onSubmit={submitUpload} className="modal-body">
              {formError && <div className="alert error">{formError}</div>}
              <label className="field">
                <span className="field-label">Title <em>*</em></span>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Purchase Order Walkthrough" required maxLength={200} />
              </label>
              <label className="field">
                <span className="field-label">Description</span>
                <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What does this video cover?" maxLength={2000} />
              </label>
              <div className="field-row">
                <label className="field">
                  <span className="field-label">Category</span>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Related module</span>
                  <input value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })}
                    placeholder="e.g. purchase_orders" maxLength={60} />
                </label>
              </div>
              <label className="field">
                <span className="field-label">Video file <em>*</em> <span className="muted">(mp4 / webm / mov — max 200 MB)</span></span>
                <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files[0] || null)} />
              </label>
              {file && <div className="muted" style={{ fontSize: 12 }}>{file.name} · {formatBytes(file.size)}</div>}
              <div className="modal-foot">
                <button type="button" className="btn ghost" onClick={() => setShowUpload(false)} disabled={busy}>Cancel</button>
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? <><span className="loading-spinner" /> Uploading…</> : <><Icon name="upload" size={15} /> Upload</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}