import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errMessage, formatBytes } from '../api.js';
import Icon from '../components/Icon.jsx';
import VideoPlayer, { formatDuration } from '../components/VideoPlayer.jsx';

const CATEGORY_LABELS = {
  training: 'Training', product: 'Product', process: 'Process', marketing: 'Marketing', other: 'Other',
};

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function VideoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [video, setVideo] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'training', module: '' });
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/videos/${id}`);
      setVideo(data.data || null);
      setForm({
        title: data.data.title || '',
        description: data.data.description || '',
        category: data.data.category || 'training',
        module: data.data.module || '',
      });
      setError('');
    } catch (e) {
      setError(errMessage(e));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function saveEdit(e) {
    e.preventDefault();
    setFormError('');
    if (!form.title.trim()) { setFormError('Title is required'); return; }
    setBusy(true);
    try {
      await api.patch(`/videos/${id}`, {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        module: form.module.trim() || null,
      });
      setEditing(false);
      load();
    } catch (err) {
      setFormError(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!window.confirm(`Archive "${video?.title}"? It will no longer appear in the library.`)) return;
    try {
      await api.delete(`/videos/${id}`);
      navigate('/videos');
    } catch (e) {
      alert(errMessage(e));
    }
  }

  if (error) {
    return (
      <div className="page">
        <div className="alert error">{error}</div>
        <Link to="/videos" className="btn ghost"><Icon name="chevronLeft" size={15} /> Back to Videos</Link>
      </div>
    );
  }
  if (!video) {
    return (
      <div className="page">
        <div className="detail-loading"><span className="loading-spinner" /> Loading video…</div>
      </div>
    );
  }

  const info = [
    ['Category', CATEGORY_LABELS[video.category] || video.category],
    ['Related module', video.module ? video.module.replace(/_/g, ' ') : '—'],
    ['Duration', formatDuration(video.duration_seconds)],
    ['File name', video.file_name],
    ['File type', video.mime_type],
    ['File size', formatBytes(video.size_bytes)],
    ['Uploaded by', video.uploaded_by_name || '—'],
    ['Uploaded on', fmtDateTime(video.created_at)],
    ['Last updated', fmtDateTime(video.updated_at)],
    ['Status', video.status],
  ];

  return (
    <div className="page">
      <div className="breadcrumbs">
        <Link to="/videos">Video Library</Link>
        <Icon name="chevronRight" size={13} />
        <span className="crumb-current">{video.title}</span>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">{video.title}</h1>
          <p className="page-sub">
            <span className={`chip cat-${video.category}`}>{CATEGORY_LABELS[video.category] || video.category}</span>
            {' '}<span className={`chip st-${video.status}`}>{video.status}</span>
          </p>
        </div>
        <div className="page-actions">
          <button className="btn ghost" onClick={() => setEditing(true)}><Icon name="file" size={15} /> Edit details</button>
          <button className="btn danger ghost" onClick={archive}><Icon name="trash" size={15} /> Archive</button>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <div className="card">
            <VideoPlayer src={video.url} poster={video.thumbnailUrl} title={video.title} />
          </div>
          <div className="card">
            <h3 className="card-title">Description</h3>
            <p className="video-desc">{video.description || 'No description provided for this video.'}</p>
          </div>
        </div>

        <div className="detail-side">
          <div className="card">
            <h3 className="card-title">Video information</h3>
            <dl className="info-list">
              {info.map(([k, v]) => (
                <div key={k} className="info-row">
                  <dt>{k}</dt>
                  <dd>{v || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="card">
            <h3 className="card-title">File</h3>
            <div className="file-row">
              <Icon name="video" size={20} />
              <div>
                <div className="file-name" title={video.file_name}>{video.file_name}</div>
                <div className="muted" style={{ fontSize: 12 }}>{formatBytes(video.size_bytes)} · {video.mime_type}</div>
              </div>
            </div>
            <a className="btn ghost full" href={video.url} download={video.file_name}>
              <Icon name="download" size={15} /> Download video
            </a>
          </div>
        </div>
      </div>

      {editing && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(false); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Edit video details">
            <div className="modal-head">
              <h3>Edit Video Details</h3>
              <button className="icon-btn" onClick={() => setEditing(false)} aria-label="Close"><Icon name="x" size={16} /></button>
            </div>
            <form onSubmit={saveEdit} className="modal-body">
              {formError && <div className="alert error">{formError}</div>}
              <label className="field">
                <span className="field-label">Title <em>*</em></span>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} />
              </label>
              <label className="field">
                <span className="field-label">Description</span>
                <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} />
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
                  <input value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} maxLength={60} />
                </label>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn ghost" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? <><span className="loading-spinner" /> Saving…</> : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}