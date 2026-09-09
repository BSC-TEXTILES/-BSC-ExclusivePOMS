import { useEffect, useState } from 'react';
import api, { errMessage } from '../api.js';
import Modal from '../components/Modal.jsx';

const emptyForm = { code: '', name: '', contactPerson: '', phone: '', email: '', address: '', city: '', state: '', country: 'India', gstin: '', notes: '' };

export default function Manufacturers() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // null | 'create' | 'edit'
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/manufacturers', { params: { page, limit: 20, search } })
      .then((r) => { setRows(r.data.data || []); setTotal(r.data.total || 0); })
      .catch((e) => setError(errMessage(e)));
  };
  useEffect(load, [page, search]);

  const openCreate = () => { setForm(emptyForm); setModal('create'); };
  const openEdit = (m) => { setForm({ code: m.code, name: m.name, contactPerson: m.contact_person || '', phone: m.phone || '', email: m.email || '', address: m.address || '', city: m.city || '', state: m.state || '', country: m.country || 'India', gstin: m.gstin || '', notes: m.notes || '', id: m.id }); setModal('edit'); };

  const save = async () => {
    setSaving(true); setError('');
    try {
      if (modal === 'create') {
        await api.post('/manufacturers', form);
      } else {
        await api.patch(`/manufacturers/${form.id}`, form);
      }
      setModal(null); load();
    } catch (e) { setError(errMessage(e)); }
    setSaving(false);
  };

  const archive = async (id) => {
    if (!confirm('Archive this manufacturer?')) return;
    try { await api.delete(`/manufacturers/${id}`); load(); } catch (e) { setError(errMessage(e)); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Manufacturers</h1><p className="page-sub" style={{ margin: 0 }}>Manage manufacturer/supplier information</p></div>
        <button className="btn primary" onClick={openCreate}>+ Add Manufacturer</button>
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="panel">
        <label className="field" style={{ maxWidth: 300 }}><span className="field-label">Search</span>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name or code…" />
        </label>
        <table className="grid">
          <thead><tr><th>Code</th><th>Name</th><th>Contact</th><th>Phone</th><th>City</th><th>Status</th><th>Products</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td className="mono">{m.code}</td>
                <td style={{ fontWeight: 600 }}>{m.name}</td>
                <td>{m.contact_person || '—'}</td>
                <td>{m.phone || '—'}</td>
                <td>{m.city || '—'}</td>
                <td><span className={`chip st-${m.status}`}>{m.status}</span></td>
                <td className="num">{m.product_count || 0}</td>
                <td><button className="btn sm" onClick={() => openEdit(m)}>Edit</button>{' '}
                  {m.status !== 'archived' && <button className="btn sm danger" onClick={() => archive(m.id)}>Archive</button>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>No manufacturers found</td></tr>}
          </tbody>
        </table>
        {total > 20 && <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Page {page} of {Math.ceil(total / 20)}</span>
          <button className="btn sm" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>Next →</button>
        </div>}
      </div>
      {modal && (
        <Modal title={modal === 'create' ? 'Add Manufacturer' : 'Edit Manufacturer'} onClose={() => setModal(null)}>
            <div className="fields-2">
              <label className="field"><span className="field-label">Code *</span><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
              <label className="field"><span className="field-label">Name *</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="field"><span className="field-label">Contact Person</span><input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></label>
              <label className="field"><span className="field-label">Phone</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
              <label className="field"><span className="field-label">Email</span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label className="field"><span className="field-label">GSTIN</span><input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></label>
              <label className="field"><span className="field-label">City</span><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
              <label className="field"><span className="field-label">State</span><input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></label>
              <label className="field"><span className="field-label">Country</span><input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></label>
            </div>
            <label className="field"><span className="field-label">Address</span><textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
            <label className="field"><span className="field-label">Notes</span><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <div className="modal-actions">
            <button className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn primary" onClick={save} disabled={saving || !form.code || !form.name}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
