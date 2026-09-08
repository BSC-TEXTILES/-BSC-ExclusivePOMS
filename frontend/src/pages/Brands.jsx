import { useEffect, useState } from 'react';
import api, { errMessage } from '../api.js';
import Modal from '../components/Modal.jsx';

export default function Brands() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ brandNumber: '', brandSerial: '', brandName: '', brandCode: '', manufacturer: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/brands', { params: { page, limit: 20, search } })
      .then((r) => { setRows(r.data.data || []); setTotal(r.data.total || 0); })
      .catch((e) => setError(errMessage(e)));
  };
  useEffect(load, [page, search]);

  const save = async () => {
    setSaving(true); setError('');
    try {
      await api.post('/brands', form);
      setModal(null); load();
    } catch (e) { setError(errMessage(e)); }
    setSaving(false);
  };

  return (
    <div className="content">
      <div className="page-header">
        <div><h1 className="page-title">Brands</h1><p className="page-sub" style={{ margin: 0 }}>Manage product brands</p></div>
        <button className="btn primary" onClick={() => { setForm({ brandNumber: '', brandSerial: '', brandName: '', brandCode: '', manufacturer: '' }); setModal('create'); }}>+ Add Brand</button>
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="panel">
        <label className="field" style={{ maxWidth: 300 }}><span className="field-label">Search</span>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search brands…" />
        </label>
        <table className="grid">
          <thead><tr><th>Number</th><th>Serial</th><th>Name</th><th>Code</th><th>Manufacturer</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td className="mono">{b.brand_number}</td>
                <td className="mono">{b.brand_serial}</td>
                <td style={{ fontWeight: 600 }}>{b.brand_name}</td>
                <td>{b.brand_code || '—'}</td>
                <td>{b.manufacturer || '—'}</td>
                <td><span className={`chip st-${b.status}`}>{b.status}</span></td>
                <td><button className="btn sm" onClick={() => { setForm({ brandNumber: b.brand_number, brandSerial: b.brand_serial, brandName: b.brand_name, brandCode: b.brand_code || '', manufacturer: b.manufacturer || '', id: b.id }); setModal('edit'); }}>Edit</button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>No brands found</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={modal === 'create' ? 'Add Brand' : 'Edit Brand'} onClose={() => setModal(null)}>
          <div className="modal-body">
            <div className="fields-2">
              <label className="field"><span className="field-label">Brand Number *</span><input value={form.brandNumber} onChange={(e) => setForm({ ...form, brandNumber: e.target.value })} disabled={modal === 'edit'} /></label>
              <label className="field"><span className="field-label">Brand Serial *</span><input value={form.brandSerial} onChange={(e) => setForm({ ...form, brandSerial: e.target.value })} disabled={modal === 'edit'} /></label>
              <label className="field"><span className="field-label">Brand Name *</span><input value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} /></label>
              <label className="field"><span className="field-label">Brand Code</span><input value={form.brandCode} onChange={(e) => setForm({ ...form, brandCode: e.target.value })} /></label>
            </div>
            <label className="field"><span className="field-label">Manufacturer</span><input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></label>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn primary" onClick={save} disabled={saving || !form.brandNumber || !form.brandSerial || !form.brandName}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
