import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api, { errMessage } from '../api.js';
import Modal from '../components/Modal.jsx';

export default function Categories() {
  const [searchParams] = useSearchParams();
  const sectionFilter = searchParams.get('sectionId') || '';
  const [rows, setRows] = useState([]);
  const [sections, setSections] = useState([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ sectionId: '', parentCategoryId: '', code: '', name: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/categories', { params: sectionFilter ? { sectionId: sectionFilter } : {} })
      .then((r) => setRows(r.data.data || [])).catch((e) => setError(errMessage(e)));
    api.get('/sections').then((r) => setSections(r.data.data || [])).catch(() => {});
  };
  useEffect(load, [sectionFilter]);

  const save = async () => {
    setSaving(true); setError('');
    try {
      await api.post('/categories', form);
      setModal(null); load();
    } catch (e) { setError(errMessage(e)); }
    setSaving(false);
  };

  const getSectionName = (id) => sections.find((s) => s.id === id)?.name || '—';

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Categories</h1><p className="page-sub" style={{ margin: 0 }}>Create and manage any number of product categories under any section — no limits</p></div>
        <button className="btn primary" onClick={() => { setForm({ sectionId: '', parentCategoryId: '', code: '', name: '' }); setModal('create'); }}>+ Add Category</button>
      </div>
      {sectionFilter && (
        <div className="row" style={{ marginBottom: 10 }}>
          <span className="chip section-chip">
            Filtered to collection: {sections.find((s) => s.id === sectionFilter)?.name || sectionFilter}
            {' '}<Link to="/categories" style={{ color: 'inherit', fontWeight: 700 }}>✕</Link>
          </span>
        </div>
      )}
      {error && <div className="alert error">{error}</div>}
      <div className="panel">
        <table className="grid">
          <thead><tr><th>Code</th><th>Name</th><th>Section</th><th>Parent</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="mono">{c.code}</td>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td>{getSectionName(c.section_id)}</td>
                <td>{c.parent_category_id ? rows.find((p) => p.id === c.parent_category_id)?.name || '—' : '—'}</td>
                <td><span className={`chip st-${c.status}`}>{c.status}</span></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>No categories found</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title="Add Category" onClose={() => setModal(null)}>
            <label className="field"><span className="field-label">Section *</span>
              <select value={form.sectionId} onChange={(e) => setForm({ ...form, sectionId: e.target.value })}>
                <option value="">— select —</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="field"><span className="field-label">Parent Category</span>
              <select value={form.parentCategoryId} onChange={(e) => setForm({ ...form, parentCategoryId: e.target.value })}>
                <option value="">— none (top-level) —</option>
                {rows.filter((c) => c.section_id === form.sectionId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <div className="fields-2">
              <label className="field"><span className="field-label">Code *</span><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
              <label className="field"><span className="field-label">Name *</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn primary" onClick={save} disabled={saving || !form.sectionId || !form.code || !form.name}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
