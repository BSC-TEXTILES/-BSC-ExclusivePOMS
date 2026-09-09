import { useEffect, useState } from 'react';
import api, { errMessage } from '../api.js';
import { useAuth } from '../auth.jsx';
import Modal from '../components/Modal.jsx';

// Colors master — colour code entry and approval is ADMIN-ONLY. Once the Admin
// approves (saves) a colour code, the swatch automatically applies the colour
// and renders with it everywhere in the system.
export default function Colors() {
  const { user } = useAuth();
  const isAdmin = !!user?.isSuperAdmin;
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
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Colors</h1><p className="page-sub" style={{ margin: 0 }}>Colour codes & swatches — only the Admin can add or approve colours</p></div>
        {isAdmin && (
          <button className="btn primary" onClick={() => { setForm({ code: '', name: '', colourFamily: '', swatchHex: '' }); setModal('create'); }}>+ Add Color (Admin only)</button>
        )}
      </div>
      {!isAdmin && <div className="alert" style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>🔒 Read-only: colour codes can be entered and approved only by the Administrator.</div>}
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
      {modal && isAdmin && (
        <Modal title="Add Color — Admin approval" onClose={() => setModal(null)}>
            <div className="fields-2">
              <label className="field"><span className="field-label">Code *</span><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. NAVY-BLUE" /></label>
              <label className="field"><span className="field-label">Name *</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Navy Blue" /></label>
              <label className="field"><span className="field-label">Color Family</span><input value={form.colourFamily} onChange={(e) => setForm({ ...form, colourFamily: e.target.value })} placeholder="e.g. Blue" /></label>
              <label className="field"><span className="field-label">Hex Colour Code</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="color" value={form.swatchHex || '#cccccc'} onChange={(e) => setForm({ ...form, swatchHex: e.target.value })} style={{ width: 40, height: 36, padding: 2, cursor: 'pointer' }} />
                  <input value={form.swatchHex} onChange={(e) => setForm({ ...form, swatchHex: e.target.value })} placeholder="#1B2A4A" />
                  {/* Approved colour code auto-applies to the live swatch preview */}
                  <span title="Approved colour preview (auto-applied)" style={{ display: 'inline-block', width: 32, height: 32, borderRadius: '50%', background: form.swatchHex || '#e5e7eb', border: '2px solid #b98a2f' }} />
                </div>
                <span className="field-hint">On approval the colour is automatically applied to the swatch.</span>
              </label>
            </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn primary" onClick={save} disabled={saving || !form.code || !form.name}>{saving ? 'Approving…' : 'Approve & Apply Colour'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
