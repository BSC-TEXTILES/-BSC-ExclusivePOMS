import { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api, { errMessage, assetUrl } from '../api.js';
import { useAuth } from '../auth.jsx';
import Modal from '../components/Modal.jsx';

export default function Brands() {
  const { user, hasPermission } = useAuth();
  const canManage = !!user?.isSuperAdmin || hasPermission('masters.manage');
  const [searchParams] = useSearchParams();
  const sectionFilter = searchParams.get('sectionId') || '';
  const [rows, setRows] = useState([]);
  const [sections, setSections] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ brandNumber: '', brandSerial: '', brandName: '', brandCode: '', manufacturer: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);
  const fileRef = useRef({});

  const load = () => {
    api.get('/brands', { params: { page, limit: 20, search, sectionId: sectionFilter || undefined } })
      .then((r) => { setRows(r.data.data || []); setTotal(r.data.total || 0); })
      .catch((e) => setError(errMessage(e)));
  };
  useEffect(load, [page, search, sectionFilter]);
  useEffect(() => {
    api.get('/sections').then((r) => setSections(r.data.data || [])).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true); setError('');
    try {
      if (form.id) {
        await api.patch(`/brands/${form.id}`, { brandName: form.brandName, brandCode: form.brandCode, manufacturer: form.manufacturer });
      } else {
        await api.post('/brands', form);
      }
      setModal(null); load();
    } catch (e) { setError(errMessage(e)); }
    setSaving(false);
  };

  const uploadLogo = async (brandId, file) => {
    setUploading(brandId);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/brands/${brandId}/logo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      load();
    } catch (e) { setError(errMessage(e)); }
    setUploading(null);
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Brands</h1><p className="page-sub" style={{ margin: 0 }}>Manage product brands and suppliers</p></div>
        {canManage ? (
          <button className="btn primary" onClick={() => { setForm({ brandNumber: '', brandSerial: '', brandName: '', brandCode: '', manufacturer: '' }); setModal('create'); }}>+ Add Brand</button>
        ) : (
          <span className="chip">🔒 Read-only — Authorized roles manage brands</span>
        )}
      </div>
      {sectionFilter && (
        <div className="row" style={{ marginBottom: 10 }}>
          <span className="chip section-chip">
            Stocked in collection: {sections.find((s) => s.id === sectionFilter)?.name || sectionFilter}
            {' '}<Link to="/brands" style={{ color: 'inherit', fontWeight: 700 }}>✕</Link>
          </span>
        </div>
      )}
      {error && <div className="alert error">{error}</div>}
      <div className="panel">
        <label className="field" style={{ maxWidth: 300 }}><span className="field-label">Search</span>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search brands…" />
        </label>
        <div className="brands-grid">
          {rows.map((b) => (
            <div className="brand-card" key={b.id}>
              <div
                className="brand-card-logo"
                onClick={() => { if (isAdmin) fileRef.current[b.id]?.click(); }}
                style={{ cursor: isAdmin ? 'pointer' : 'default' }}
                title={isAdmin ? 'Upload brand image (Admin only)' : 'Only the Admin can upload brand images'}
              >
                {b.logo_url ? (
                  <img src={assetUrl(b.logo_url)} alt={b.brand_name} />
                ) : (
                  <span className="brand-card-initials">{getInitials(b.brand_name)}</span>
                )}
                {isAdmin && (
                  <div className="brand-card-upload-overlay">
                    {uploading === b.id ? '…' : '📷'}
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  ref={(el) => { fileRef.current[b.id] = el; }}
                  style={{ display: 'none' }}
                  onChange={(e) => { if (isAdmin && e.target.files[0]) uploadLogo(b.id, e.target.files[0]); e.target.value = ''; }}
                />
              </div>
              <div className="brand-card-info">
                <div className="brand-card-name">{b.brand_name}</div>
                <div className="brand-card-meta">
                  <span className="mono">{b.brand_number}</span>
                  {b.brand_code && <span>· {b.brand_code}</span>}
                </div>
                {b.manufacturer && <div className="brand-card-mfr">{b.manufacturer}</div>}
                <div className="brand-card-footer">
                  <span className={`chip st-${b.status}`}>{b.status}</span>
                  <span className="brand-card-count">{b.product_count ?? 0} products</span>
                </div>
              </div>
              {isAdmin && (
                <button className="brand-card-edit" onClick={() => { setForm({ brandNumber: b.brand_number, brandSerial: b.brand_serial, brandName: b.brand_name, brandCode: b.brand_code || '', manufacturer: b.manufacturer || '', id: b.id }); setModal('edit'); }}>
                  Edit
                </button>
              )}
            </div>
          ))}
          {!rows.length && <div className="brands-empty">No brands found</div>}
        </div>
      </div>
      {modal && (
        <Modal title={modal === 'create' ? 'Add Brand' : 'Edit Brand'} onClose={() => setModal(null)}>
            <div className="fields-2">
              <label className="field">
                <span className="field-label">Brand Name *</span>
                <input
                  value={form.brandName}
                  onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                  placeholder="e.g. Raymond, Arrow, Manyavar"
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Brand Code</span>
                <input
                  value={form.brandCode}
                  onChange={(e) => setForm({ ...form, brandCode: e.target.value })}
                  placeholder="e.g. RAY, ARW (auto-generated if empty)"
                />
              </label>
              <label className="field">
                <span className="field-label">Brand Number</span>
                <input
                  value={form.brandNumber}
                  onChange={(e) => setForm({ ...form, brandNumber: e.target.value })}
                  placeholder="Auto-generated if empty"
                  disabled={modal === 'edit'}
                />
              </label>
              <label className="field">
                <span className="field-label">Brand Serial</span>
                <input
                  value={form.brandSerial}
                  onChange={(e) => setForm({ ...form, brandSerial: e.target.value })}
                  placeholder="Auto-generated if empty"
                  disabled={modal === 'edit'}
                />
              </label>
            </div>
            <label className="field">
              <span className="field-label">Manufacturer / Vendor</span>
              <input
                value={form.manufacturer}
                onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                placeholder="e.g. Raymond Apparel Ltd."
              />
            </label>
          <div className="modal-actions">
            <button className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn primary" onClick={save} disabled={saving || !form.brandName?.trim()}>
              {saving ? 'Saving…' : 'Save Brand'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
