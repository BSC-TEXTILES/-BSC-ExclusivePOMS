import { useEffect, useState } from 'react';
import api, { errMessage } from '../api.js';
import Modal from '../components/Modal.jsx';

export default function Colors() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', colourFamily: '', swatchHex: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/colours').then((r) => setRows(r.data.data || [])).catch((e) => setError(errMessage(e)));
  };
  useEffect(load, []);

  const save = async () => {
    setSaving(true); setError('');
    try {
      await api.post('/colours', form);
      setModal(null); load();
    } catch (e) { setError(errMessage(e)); }
    setSaving(false);
  };

  return (
    <div className="content">
      <div className="page-header">
        <div><h1 className="page-title">Colors</h1><p className="page-sub" style={{ margin: 0 }}>Manage product colors with hex swatches</p></div>
        <button className="btn primary" onClick={() => { setForm({ code: '', name: '', colourFamily: '', swatchHex: '' }); setModal('create'); }}>+ Add Color</button>
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="panel">
        <table className="grid">
          <thead><tr><th>Swatch</th><th>Code</th><th>Name</th><th>Family</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>{c.swatch_hex ? <span style={{ display: 'inline-block', width: 24, height: 24, borderRadius: '50%', background: c.swatch_hex, border: '1px solid #e5e7eb' }} /> : '—'}</td>
                <td className="mono">{c.code}</td>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td>{c.colour_family || '—'}</td>
                <td><span className={`chip st-${c.status}`}>{c.status}</span></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>No colors found</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title="Add Color" onClose={() => setModal(null)}>
          <div className="modal-body">
            <div className="fields-2">
              <label className="field"><span className="field-label">Code *</span><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. NAVY-BLUE" /></label>
              <label className="field"><span className="field-label">Name *</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Navy Blue" /></label>
              <label className="field"><span className="field-label">Color Family</span><input value={form.colourFamily} onChange={(e) => setForm({ ...form, colourFamily: e.target.value })} placeholder="e.g. Blue" /></label>
              <label className="field"><span className="field-label">Hex Code</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="color" value={form.swatchHex || '#cccccc'} onChange={(e) => setForm({ ...form, swatchHex: e.target.value })} style={{ width: 40, height: 36, padding: 2, cursor: 'pointer' }} />
                  <input value={form.swatchHex} onChange={(e) => setForm({ ...form, swatchHex: e.target.value })} placeholder="#1B2A4A" />
                </div>
              </label>
            </div>
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
