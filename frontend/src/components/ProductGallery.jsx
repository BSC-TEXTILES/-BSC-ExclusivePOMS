import { useEffect, useState, useCallback, useRef } from 'react';
import api, { errMessage, uploadFile } from '../api.js';
import Icon from './Icon.jsx';

// Shared product image gallery — upload, set primary, delete.
// Backed by POST/GET /api/products/:id/images (images persisted in product_images).
export default function ProductGallery({ product, canManage, onChanged }) {
  const [images, setImages] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(() => {
    api.get(`/products/${product.id}/images`)
      .then((r) => setImages(r.data.data || []))
      .catch((e) => setError(errMessage(e)));
  }, [product.id]);
  useEffect(load, [load]);

  async function upload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBusy(true); setError('');
    try {
      await uploadFile(`/products/${product.id}/images`, files);
      onChanged?.();
      load();
    } catch (err) { setError(errMessage(err)); }
    setBusy(false);
    e.target.value = '';
  }

  async function makePrimary(img) {
    await api.patch(`/products/${product.product_id || product.id}/images/${img.id}/primary`).catch(() => {});
    onChanged?.();
    load();
  }

  async function remove(img) {
    if (!window.confirm(`Remove image "${img.file_name}"?`)) return;
    await api.delete(`/products/${product.id}/images/${img.id}`).catch(() => {});
    onChanged?.();
    load();
  }

  return (
    <div className="gallery">
      <div className="gallery-bar">
        <strong>Image gallery</strong>
        {canManage && (
          <>
            <button className="btn sm primary" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={14} /> {busy ? 'Uploading…' : 'Upload images'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={upload} />
          </>
        )}
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="gallery-grid">
        {(images || []).map((img) => (
          <div key={img.id} className="gallery-cell">
            <img src={img.url} alt={img.file_name} loading="lazy" />
            {img.is_primary && <span className="chip primary-tag">Primary</span>}
            {canManage && (
              <div className="gallery-actions">
                {!img.is_primary && <button className="btn sm" title="Set as primary" onClick={() => makePrimary(img)}><Icon name="check" size={13} /></button>}
                <button className="btn sm danger" title="Delete" onClick={() => remove(img)}><Icon name="trash" size={13} /></button>
              </div>
            )}
          </div>
        ))}
        {images && !images.length && <div className="muted" style={{ padding: 12 }}>No images yet{canManage ? ' — upload the first one.' : '.'}</div>}
        {!images && <div className="muted" style={{ padding: 12 }}>Loading…</div>}
      </div>
    </div>
  );
}
