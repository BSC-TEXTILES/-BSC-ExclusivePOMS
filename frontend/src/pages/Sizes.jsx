import { useEffect, useState } from 'react';
import api, { errMessage } from '../api.js';
import Modal from '../components/Modal.jsx';

export default function Sizes() {
  const [rows, setRows] = useState([]);
  const [methods, setMethods] = useState([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ sizeMethodId: '', label: '', numericValue: '', displayOrder: 0 });
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/sizes').then((r) => setRows(r.data.data || [])).catch((e) => setError(errMessage(e)));
    api.get('/size-methods').then((r) => setMethods(r.data.data || [])).catch(() => {});
  };
  useEffect(load, []);

  const save = async () => {
    setSaving(true); setError('');
    try {
      await api.post('/sizes', { sizeMethodId: form.sizeMethodId, label: form.label, numericValue: form.numericValue ? Number(form.numericValue) : null, displayOrder: Number(form.displayOrder) });
      setModal(null); load();
    } catch (e) { setError(errMessage(e)); }
    setSaving(false);
  };

  const grouped = methods.map((m) => ({
    ...m,
    sizes: rows.filter((s) => s.size_method_id === m.id).sort((a, b) => (a.display_order || 0) - (b.display_order || 0)),
  }));

  return (
    <div className="content">
      <div className="page-header">
        <div><h1 className="page-title">Sizes</h1><p className="page-sub" style={{ margin: 0 }}>Manage size sets grouped by sizing method</p></div>
        <button className="btn primary" onClick={() => { setForm({ sizeMethodId: '', label: '', numericValue: '', displayOrder: 0 }); setModal('create'); }}>+ Add Size</button>
      </div>
      {error && <div className="alert error">{error}</div>}
      {grouped.map((g) => (
        <div className="panel" key={g.id}>
          <h3>{g.name} <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 12 }}>({g.sizes.length} sizes)</span></h3>
          <div className="tag-list">
            {g.sizes.map((s) => (
              <span key={s.id} className="tag">{s.label}{s.numeric_value ? ` (${s.numeric_value})` : ''}</span>
            ))}
            {!g.sizes.length && <span style={{ color: '#6b7280', fontSize: 13 }}>No sizes</span>}
          </div>
        </div>
      ))}
      {modal && (
        <Modal title="Add Size" onClose={() => setModal(null)}>
          <div className="modal-body">
            <label className="field"><span className="field-label">Size Method *</span>
              <select value={form.sizeMethodId} onChange={(e) => setForm({ ...form, sizeMethodId: e.target.value })}>
                <option value="">— select —</option>
                {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <div className="fields-3">
              <label className="field"><span className="field-label">Label *</span><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. XL" /></label>
              <label className="field"><span className="field-label">Numeric Value</span><input type="number" value={form.numericValue} onChange={(e) => setForm({ ...form, numericValue: e.target.value })} placeholder="optional" /></label>
              <label className="field"><span className="field-label">Display Order</span><input type="number" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: e.target.value })} /></label>
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn primary" onClick={save} disabled={saving || !form.sizeMethodId || !form.label}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
