import { useEffect, useState } from 'react';
import api, { errMessage } from '../api.js';
import Modal from '../components/Modal.jsx';

export default function Attributes() {
  const [rows, setRows] = useState([]);
  const [sections, setSections] = useState([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ sectionId: '', attributeKey: '', attributeLabel: '', dataType: 'text', isRequired: false });
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/sections').then((r) => setSections(r.data.data || [])).catch(() => {});
    // Attributes are embedded in sections; flatten for display
    api.get('/sections').then((r) => {
      const all = [];
      (r.data.data || []).forEach((s) => {
        (s.attributes_list || []).forEach((a) => all.push({ ...a, sectionName: s.name, sectionId: s.id }));
      });
      setRows(all);
    }).catch((e) => setError(errMessage(e)));
  };
  useEffect(load, []);

  const save = async () => {
    setSaving(true); setError('');
    try {
      const existing = sections.find((s) => s.id === form.sectionId)?.attributes_list || [];
      const updated = { ...existing.reduce((o, a) => ({ ...o, [a.attribute_key]: a }), {}), [form.attributeKey]: { attribute_label: form.attributeLabel, data_type: form.dataType, is_required: form.isRequired } };
      await api.patch(`/sections/${form.sectionId}`, { attributes: updated });
      setModal(null); load();
    } catch (e) { setError(errMessage(e)); }
    setSaving(false);
  };

  const DATA_TYPES = ['text', 'number', 'enum', 'boolean'];

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Attributes</h1><p className="page-sub" style={{ margin: 0 }}>Manage product attributes (material, pattern, fit, etc.)</p></div>
        <button className="btn primary" onClick={() => { setForm({ sectionId: '', attributeKey: '', attributeLabel: '', dataType: 'text', isRequired: false }); setModal('create'); }}>+ Add Attribute</button>
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="panel">
        <table className="grid">
          <thead><tr><th>Section</th><th>Key</th><th>Label</th><th>Type</th><th>Required</th></tr></thead>
          <tbody>
            {rows.map((a, i) => (
              <tr key={i}>
                <td>{a.sectionName}</td>
                <td className="mono">{a.attribute_key}</td>
                <td style={{ fontWeight: 600 }}>{a.attribute_label}</td>
                <td><span className="chip">{a.data_type}</span></td>
                <td>{a.is_required ? '✓' : '—'}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>No attributes defined</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title="Add Attribute" onClose={() => setModal(null)}>
            <label className="field"><span className="field-label">Section *</span>
              <select value={form.sectionId} onChange={(e) => setForm({ ...form, sectionId: e.target.value })}>
                <option value="">— select —</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <div className="fields-2">
              <label className="field"><span className="field-label">Attribute Key *</span><input value={form.attributeKey} onChange={(e) => setForm({ ...form, attributeKey: e.target.value })} placeholder="e.g. material" /></label>
              <label className="field"><span className="field-label">Attribute Label *</span><input value={form.attributeLabel} onChange={(e) => setForm({ ...form, attributeLabel: e.target.value })} placeholder="e.g. Material" /></label>
              <label className="field"><span className="field-label">Data Type</span>
                <select value={form.dataType} onChange={(e) => setForm({ ...form, dataType: e.target.value })}>
                  {DATA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="field"><span className="field-label">Required</span>
                <select value={form.isRequired ? 'true' : 'false'} onChange={(e) => setForm({ ...form, isRequired: e.target.value === 'true' })}>
                  <option value="false">No</option><option value="true">Yes</option>
                </select>
              </label>
            </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn primary" onClick={save} disabled={saving || !form.sectionId || !form.attributeKey || !form.attributeLabel}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
