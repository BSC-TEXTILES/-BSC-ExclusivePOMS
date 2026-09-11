import { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api, { errMessage, assetUrl } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import CSVImportModal from '../components/CSVImportModal.jsx';

export default function Brands() {
  const { user, hasPermission } = useAuth();
  const canManage = !!user?.isSuperAdmin || hasPermission('masters.manage');
  const isAdmin = canManage;
  const [searchParams] = useSearchParams();
  const sectionFilter = searchParams.get('sectionId') || '';
  const [rows, setRows] = useState([]);
  const [collections, setCollections] = useState([]);
  const [sections, setSections] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState({ brandNumber: '', brandSerial: '', brandName: '', brandCode: '', manufacturer: '', collectionIds: [] });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);
  const fileRef = useRef({});

  const load = () => {
    api.get('/brands', { params: { page, limit: 20, search, sectionId: sectionFilter || undefined, collectionId: collectionFilter || undefined } })
      .then((r) => { setRows(r.data.data || []); setTotal(r.data.total || 0); })
      .catch((e) => setError(errMessage(e)));
  };
  useEffect(load, [page, search, sectionFilter, collectionFilter]);
  useEffect(() => {
    api.get('/sections').then((r) => setSections(r.data.data || [])).catch(() => {});
    api.get('/collections').then((r) => setCollections(r.data.data || [])).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true); setError('');
    try {
      if (form.id) {
        await api.patch(`/brands/${form.id}`, {
          brandName: form.brandName,
          brandCode: form.brandCode,
          manufacturer: form.manufacturer,
          collectionIds: form.collectionIds,
        });
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

  const toggleCollection = (cid) => {
    setForm((prev) => {
      const ids = prev.collectionIds || [];
      const next = ids.includes(cid) ? ids.filter((i) => i !== cid) : [...ids, cid];
      return { ...prev, collectionIds: next };
    });
  };

  const openEdit = (b) => {
    const colIds = (b.collections || []).map((c) => c.id);
    setForm({
      brandNumber: b.brand_number,
      brandSerial: b.brand_serial,
      brandName: b.brand_name,
      brandCode: b.brand_code || '',
      manufacturer: b.manufacturer || '',
      collectionIds: colIds,
      id: b.id,
    });
    setModal('edit');
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Brands</h1><p className="page-sub" style={{ margin: 0 }}>Manage product brands and suppliers in collections</p></div>
        {canManage ? (
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <button className="btn" onClick={() => setImportOpen(true)} title="Import brands from a CSV — new brand names are created automatically">
              <Icon name="upload" size={15} /> Import CSV
            </button>
            <button className="btn primary" onClick={() => { setForm({ brandNumber: '', brandSerial: '', brandName: '', brandCode: '', manufacturer: '', collectionIds: [] }); setModal('create'); }}>+ Add Brand</button>
          </div>
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
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
          <label className="field" style={{ maxWidth: 300, marginBottom: 0 }}><span className="field-label">Search</span>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search brands…" />
          </label>
          <label className="field" style={{ maxWidth: 220, marginBottom: 0 }}><span className="field-label">Collection</span>
            <select value={collectionFilter} onChange={(e) => { setCollectionFilter(e.target.value); setPage(1); }}>
              <option value="">All Collections</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>
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
                ) : b.image_url ? (
                  <img src={b.image_url} alt={b.brand_name} style={{ objectFit: 'contain', background: '#fff' }} />
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
                {b.collections?.length > 0 && (
                  <div className="brand-card-collections">
                    {b.collections.map((c) => (
                      <span key={c.id} className="chip collection-chip">{c.name}</span>
                    ))}
                  </div>
                )}
                <div className="brand-card-footer">
                  <span className={`chip st-${b.status}`}>{b.status}</span>
                  <span className="brand-card-count">{b.product_count ?? 0} products</span>
                </div>
              </div>
              {b.qr_code && (
                <div
                  className="brand-card-qr"
                  dangerouslySetInnerHTML={{ __html: b.qr_code }}
                  title={`QR Code for ${b.brand_name}`}
                />
              )}
              {isAdmin && (
                <button className="brand-card-edit" onClick={() => openEdit(b)}>
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
            <div className="field">
              <span className="field-label">Collections (Men, Women, Kids, etc.)</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {collections.map((c) => (
                  <label
                    key={c.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                      borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                      borderColor: form.collectionIds?.includes(c.id) ? '#b98a2f' : '#e2e8f0',
                      background: form.collectionIds?.includes(c.id) ? '#fef9ee' : '#fff',
                      color: form.collectionIds?.includes(c.id) ? '#92640d' : '#475569',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.collectionIds?.includes(c.id) || false}
                      onChange={() => toggleCollection(c.id)}
                      style={{ width: 14, height: 14, accentColor: '#b98a2f' }}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn primary" onClick={save} disabled={saving || !form.brandName?.trim()}>
              {saving ? 'Saving…' : 'Save Brand'}
            </button>
          </div>
        </Modal>
      )}

      {/* CSV import — new brand names in the upload are created automatically; existing ones are reused */}
      <CSVImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => { load(); setTimeout(() => setImportOpen(false), 1500); }}
      />
    </div>
  );
}
