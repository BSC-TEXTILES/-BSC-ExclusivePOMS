import { useEffect, useState, useRef, useMemo } from 'react';
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
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [sectionFilterLocal, setSectionFilterLocal] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState({ brandNumber: '', brandSerial: '', brandName: '', brandCode: '', manufacturer: '', departmentId: '', sectionIds: [] });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);
  const fileRef = useRef({});

  const visibleSections = useMemo(() => {
    if (!departmentFilter) return sections;
    return sections.filter((s) => s.department_id === departmentFilter);
  }, [sections, departmentFilter]);

  const formSections = useMemo(() => {
    if (!form.departmentId) return sections;
    return sections.filter((s) => s.department_id === form.departmentId);
  }, [sections, form.departmentId]);

  const load = () => {
    const params = { page, limit: 20, search };
    if (sectionFilter) params.sectionId = sectionFilter;
    else if (sectionFilterLocal) params.sectionId = sectionFilterLocal;
    else if (departmentFilter) params.departmentId = departmentFilter;
    api.get('/brands', { params })
      .then((r) => { setRows(r.data.data || []); setTotal(r.data.total || 0); })
      .catch((e) => setError(errMessage(e)));
  };
  useEffect(load, [page, search, departmentFilter, sectionFilterLocal, sectionFilter, sections]);
  useEffect(() => {
    Promise.all([api.get('/departments'), api.get('/sections?status=active')])
      .then(([d, s]) => { setDepartments(d.data.data || []); setSections(s.data.data || []); })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true); setError('');
    try {
      if (form.id) {
        await api.patch(`/brands/${form.id}`, {
          brandName: form.brandName,
          brandCode: form.brandCode,
          manufacturer: form.manufacturer,
          sectionIds: form.sectionIds,
        });
      } else {
        await api.post('/brands', {
          ...form,
          sectionIds: form.sectionIds,
        });
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

  const toggleSection = (sid) => {
    setForm((prev) => {
      const ids = prev.sectionIds || [];
      const next = ids.includes(sid) ? ids.filter((i) => i !== sid) : [...ids, sid];
      return { ...prev, sectionIds: next };
    });
  };

  const openEdit = (b) => {
    const secIds = (b.sections || []).map((s) => s.id);
    const firstSection = b.sections?.[0];
    const deptId = firstSection?.department_id || '';
    setForm({
      brandNumber: b.brand_number,
      brandSerial: b.brand_serial,
      brandName: b.brand_name,
      brandCode: b.brand_code || '',
      manufacturer: b.manufacturer || '',
      departmentId: deptId,
      sectionIds: secIds,
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
            <button className="btn primary" onClick={() => { setForm({ brandNumber: '', brandSerial: '', brandName: '', brandCode: '', manufacturer: '', departmentId: '', sectionIds: [] }); setModal('create'); }}>+ Add Brand</button>
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
            <select value={departmentFilter} onChange={(e) => { setDepartmentFilter(e.target.value); setSectionFilterLocal(''); setPage(1); }}>
              <option value="">All Collections</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
          {departmentFilter && (
            <label className="field" style={{ maxWidth: 220, marginBottom: 0 }}><span className="field-label">Sub Category</span>
              <select value={sectionFilterLocal} onChange={(e) => { setSectionFilterLocal(e.target.value); setPage(1); }}>
                <option value="">All Sub Categories</option>
                {visibleSections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
          )}
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
                {b.sections?.length > 0 && (
                  <div className="brand-card-collections">
                    {b.sections.map((s) => (
                      <span key={s.id} className="chip collection-chip">{s.name}</span>
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
            <div className="fields-2">
              <label className="field">
                <span className="field-label">Collection</span>
                <select
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value, sectionIds: [] })}
                >
                  <option value="">Select Collection</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Sub Category</span>
                <select
                  value={form.sectionIds?.[0] || ''}
                  onChange={(e) => setForm({ ...form, sectionIds: e.target.value ? [e.target.value] : [] })}
                  disabled={!form.departmentId}
                >
                  <option value="">{form.departmentId ? 'Select Sub Category' : 'Select Collection first'}</option>
                  {formSections.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
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
