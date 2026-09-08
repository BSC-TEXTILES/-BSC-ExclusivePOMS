import { useEffect, useState } from 'react';
import api, { errMessage } from '../api.js';
import Modal from '../components/Modal.jsx';

export default function Collections() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', displayOrder: 0 });
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/collections').then((r) => setRows(r.data.data || [])).catch((e) => setError(errMessage(e)));
  };
  useEffect(load, []);

  const save = async () => {
    setSaving(true); setError('');
    try {
      if (modal === 'edit') {
        await api.patch(`/collections/${form.id}`, form);
      } else {
        await api.post('/collections', form);
      }
      setModal(null); load();
    } catch (e) { setError(errMessage(e)); }
    setSaving(false);
  };

  return (
    <div className="content">
      <div className="page-header">
        <div><h1 className="page-title">Collections</h1><p className="page-sub" style={{ margin: 0 }}>Manage product collections (Men, Women, Kids, etc.)</p></div>
        <button className="btn primary" onClick={() => { setForm({ code: '', name: '', description: '', displayOrder: 0 }); setModal('create'); }}>+ Add Collection</button>
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="panel">
        <div className="brands-grid">
          {rows.map((c) => (
            <div className="brand-card" key={c.id}>
              <div className="brand-card-logo" style={{ background: `hsl(${c.display_order * 36}, 45%, 92%)` }}>
                <span className="brand-card-initials" style={{ color: `hsl(${c.display_order * 36}, 55%, 35%)` }}>{c.name.slice(0, 2).toUpperCase()}</span>
              </div>
              <div className="brand-card-info">
                <div className="brand-card-name">{c.name}</div>
                <div className="brand-card-meta"><span className="mono">{c.code}</span></div>
                {c.description && <div className="brand-card-mfr">{c.description}</div>}
                <div className="brand-card-footer">
                  <span className={`chip st-${c.status}`}>{c.status}</span>
                  <span className="brand-card-count">{c.brand_count ?? 0} brands</span>
                </div>
              </div>
              <button className="brand-card-edit" onClick={() => { setForm({ id: c.id, code: c.code, name: c.name, description: c.description || '', displayOrder: c.display_order }); setModal('edit'); }}>Edit</button>
            </div>
          ))}
        </div>
      </div>
      {modal && (
        <Modal title={modal === 'create' ? 'Add Collection' : 'Edit Collection'} onClose={() => setModal(null)}>
          <div className="modal-body">
            <label className="field"><span className="field-label">Code *</span><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={modal === 'edit'} /></label>
            <label className="field"><span className="field-label">Name *</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="field"><span className="field-label">Description</span><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <label className="field"><span className="field-label">Display Order</span><input type="number" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: +e.target.value })} /></label>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn primary" onClick={save} disabled={saving || !form.code || !form.name}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
