import { useState, useEffect, useRef } from 'react';
import api, { uploadFile, formatBytes, fileKind, errMessage, assetUrl } from '../api.js';

export default function Attachments() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [editing, setEditing] = useState(null); // { id, fileName, description }
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const inputRef = useRef(null);
  const replaceRefs = useRef({}); // id -> hidden input

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const r = await api.get(`/files?${params}`);
      setFiles(r.data.data || []);
    } catch (e) { setError(errMessage(e)); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [search]);

  const handleUpload = async (selectedFiles) => {
    if (!selectedFiles?.length) return;
    setUploading(true); setError('');
    try {
      await uploadFile('/files', selectedFiles);
      load();
    } catch (e) { setError(errMessage(e)); }
    setUploading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  const removeFile = async (id) => {
    if (!confirm('Delete this file?')) return;
    try { await api.delete(`/files/${id}`); load(); } catch (e) { setError(errMessage(e)); }
  };

  // Replace the stored content of an attachment, keeping the same record.
  const replaceFile = async (id, file) => {
    if (!file) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/files/${id}/replace`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setNotice('File replaced successfully.');
      load();
    } catch (e) { setError(errMessage(e)); }
    setBusy(false);
  };

  const saveDetails = async () => {
    if (!editing) return;
    setBusy(true); setError('');
    try {
      await api.patch(`/files/${editing.id}`, { fileName: editing.fileName, description: editing.description });
      setEditing(null);
      setNotice('Attachment details updated.');
      load();
    } catch (e) { setError(errMessage(e)); }
    setBusy(false);
  };

  const getIcon = (mime, name) => {
    const k = fileKind(mime, name);
    if (k.icon === 'image') return { icon: '🖼️', color: '#7c3aed', bg: '#f5f3ff' };
    if (k.icon === 'video') return { icon: '🎬', color: '#dc2626', bg: '#fef2f2' };
    if (k.label === 'PDF') return { icon: '📄', color: '#dc2626', bg: '#fef2f2' };
    if (k.label === 'Spreadsheet') return { icon: '📊', color: '#16a34a', bg: '#f0fdf4' };
    if (k.label === 'Document') return { icon: '📝', color: '#2563eb', bg: '#eff6ff' };
    if (k.label === 'Archive') return { icon: '📦', color: '#ca8a04', bg: '#fefce8' };
    if (k.label === 'Audio') return { icon: '🎵', color: '#9333ea', bg: '#faf5ff' };
    return { icon: '📎', color: '#6b7280', bg: '#f9fafb' };
  };

  const renderPreview = (file) => {
    const mime = file.mime_type || '';
    const src = assetUrl(file.url);
    if (mime.startsWith('image/')) return <img src={src} alt={file.file_name} />;
    if (mime.startsWith('video/')) return <video src={src} controls autoPlay />;
    if (mime === 'application/pdf') return <iframe src={src} title={file.file_name} />;
    return <div className="attach-preview-fallback"><p>Preview not available for this file type</p><a href={src} download>Download {file.file_name}</a></div>;
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attachments</h1>
          <p className="page-sub" style={{ margin: 0 }}>Upload and manage files — PDF, Excel, Word, images, video, any format</p>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert ok">{notice}</div>}

      {/* Drop zone */}
      <div
        className={`attach-dropzone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef} type="file" multiple style={{ display: 'none' }}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp,.svg,.mp4,.webm,.mp3,.wav,.zip,.rar,.7z,image/*,video/*,audio/*,application/*"
          onChange={(e) => { handleUpload(e.target.files); e.target.value = ''; }}
        />
        <div className="attach-dropzone-icon">📎</div>
        <div className="attach-dropzone-text">
          {uploading ? 'Uploading…' : 'Drag & drop files here, or click to browse'}
        </div>
        <div className="attach-dropzone-hint">PDF, Excel, Word, images, video, audio, archives — up to 200 MB per file</div>
      </div>

      {/* Search */}
      <div className="attach-toolbar">
        <input
          className="attach-search"
          placeholder="Search files…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="attach-count">{files.length} file{files.length !== 1 ? 's' : ''}</div>
      </div>

      {/* File list */}
      {loading ? (
        <div className="attach-loading">Loading…</div>
      ) : files.length === 0 ? (
        <div className="attach-empty">
          <div className="attach-empty-icon">📁</div>
          <p>No files uploaded yet</p>
        </div>
      ) : (
        <div className="attach-grid">
          {files.map((f) => {
            const ic = getIcon(f.mime_type, f.file_name);
            const isImage = (f.mime_type || '').startsWith('image/');
            return (
              <div className="attach-card" key={f.id}>
                <div className="attach-card-preview" onClick={() => setPreview(f)}>
                  {isImage ? (
                    <img src={assetUrl(f.url)} alt={f.file_name} />
                  ) : (
                    <div className="attach-card-icon" style={{ background: ic.bg, color: ic.color }}>{ic.icon}</div>
                  )}
                </div>
                <div className="attach-card-info">
                  <div className="attach-card-name" title={f.file_name}>{f.file_name}</div>
                  <div className="attach-card-meta">
                    <span>{formatBytes(f.size_bytes)}</span>
                    <span>•</span>
                    <span>{f.uploaded_by_name || 'Unknown'}</span>
                  </div>
                  <div className="attach-card-date">{new Date(f.uploaded_at).toLocaleDateString()}</div>
                </div>
                <div className="attach-card-actions">
                  <button className="attach-btn-icon" onClick={() => setPreview(f)} title="Preview">👁️</button>
                  <a className="attach-btn-icon" href={assetUrl(f.url)} download title="Download">⬇️</a>
                  <button className="attach-btn-icon" onClick={() => replaceRefs.current[f.id]?.click()} disabled={busy} title="Replace file">🔄</button>
                  <button className="attach-btn-icon" onClick={() => setEditing({ id: f.id, fileName: f.file_name, description: f.description || '' })} title="Edit details">✏️</button>
                  <button className="attach-btn-icon attach-btn-delete" onClick={() => removeFile(f.id)} title="Delete">🗑️</button>
                  <input
                    ref={(el) => { replaceRefs.current[f.id] = el; }}
                    type="file" style={{ display: 'none' }}
                    onChange={(e) => { replaceFile(f.id, e.target.files[0]); e.target.value = ''; }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="attach-modal" onClick={() => setPreview(null)}>
          <div className="attach-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="attach-modal-header">
              <span className="attach-modal-title">{preview.file_name}</span>
              <button className="attach-modal-close" onClick={() => setPreview(null)}>✕</button>
            </div>
            <div className="attach-modal-body">
              {renderPreview(preview)}
            </div>
            <div className="attach-modal-footer">
              <span>{formatBytes(preview.size_bytes)} • {preview.mime_type}</span>
              <a href={assetUrl(preview.url)} download className="attach-modal-download">Download</a>
            </div>
          </div>
        </div>
      )}

      {/* Edit-details modal */}
      {editing && (
        <div className="attach-modal" onClick={() => setEditing(null)}>
          <div className="attach-modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="attach-modal-header">
              <span className="attach-modal-title">Edit attachment details</span>
              <button className="attach-modal-close" onClick={() => setEditing(null)}>✕</button>
            </div>
            <div className="attach-modal-body" style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                File name
                <input value={editing.fileName} onChange={(e) => setEditing({ ...editing, fileName: e.target.value })} />
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                Description
                <textarea rows={3} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </label>
              <div className="row">
                <button className="btn primary" disabled={busy} onClick={saveDetails}>{busy ? 'Saving…' : 'Save details'}</button>
                <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
