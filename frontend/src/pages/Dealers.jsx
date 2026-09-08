import { useEffect, useState } from 'react';
import api, { errMessage } from '../api.js';
import Modal from '../components/Modal.jsx';

export default function Dealers() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const blank = { code: '', companyName: '', contactPerson: '', phone: '', email: '', address: '', city: '', state: '', gstin: '', pan: '', paymentTerms: 'net_30', notes: '' };
  const load = () => {
    api.get('/dealers', { params: { page, limit: 20, search } })
      .then((r) => { setRows(r.data.data || []); setTotal(r.data.total || 0); })
      .catch((e) => setError(errMessage(e)));
  };
  useEffect(load, [page, search]);

  const save = async () => {
    setSaving(true); setError('');
    try {
      if (modal === 'edit') { await api.patch(`/dealers/${form.id}`, form); }
      else { await api.post('/dealers', form); }
      setModal(null); load();
    } catch (e) { setError(errMessage(e)); }
    setSaving(false);
  };

  return (
    <div className="content">
      <div className="page-header">
        <div><h1 className="page-title">Dealers</h1><p className="page-sub" style={{ margin: 0 }}>Manage dealers and suppliers for purchase orders</p></div>
        <button className="btn primary" onClick={() => { setForm({ ...blank }); setModal('create'); }}>+ Add Dealer</button>
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="panel">
        <label className="field" style={{ maxWidth: 300 }}><span className="field-label">Search</span>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search dealers…" />
        </label>
        <table className="grid">
          <thead><tr><th>Code</th><th>Company</th><th>Contact</th><th>Phone</th><th>City</th><th>GSTIN</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td className="mono">{d.code}</td>
                <td style={{ fontWeight: 600 }}>{d.company_name}</td>
                <td>{d.contact_person || '—'}</td>
                <td>{d.phone || '—'}</td>
                <td>{d.city || '—'}</td>
                <td className="mono">{d.gstin || '—'}</td>
                <td><span className={`chip st-${d.status}`}>{d.status}</span></td>
                <td><button className="btn sm" onClick={() => { setForm({ id: d.id, code: d.code, companyName: d.company_name, contactPerson: d.contact_person || '', phone: d.phone || '', email: d.email || '', address: d.address || '', city: d.city || '', state: d.state || '', gstin: d.gstin || '', pan: d.pan || '', paymentTerms: d.payment_terms || 'net_30', notes: d.notes || '' }); setModal('edit'); }}>Edit</button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>No dealers found</td></tr>}
          </tbody>
        </table>
      </div>
      {total > 20 && <div className="panel" style={{ textAlign: 'center' }}><button className="btn sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button><span style={{ margin: '0 12px', fontSize: 13 }}>Page {page} of {Math.ceil(total / 20)}</span><button className="btn sm" disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}>Next →</button></div>}
      {modal && (
        <Modal title={modal === 'create' ? 'Add Dealer' : 'Edit Dealer'} onClose={() => setModal(null)}>
          <div className="modal-body">
            <div className="fields-2">
              <label className="field"><span className="field-label">Code *</span><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={modal === 'edit'} /></label>
              <label className="field"><span className="field-label">Company Name *</span><input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></label>
              <label className="field"><span className="field-label">Contact Person</span><input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></label>
              <label className="field"><span className="field-label">Phone</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
              <label className="field"><span className="field-label">Email</span><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label className="field"><span className="field-label">GSTIN</span><input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></label>
            </div>
            <label className="field"><span className="field-label">Address</span><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
            <div className="fields-2">
              <label className="field"><span className="field-label">City</span><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
              <label className="field"><span className="field-label">State</span><input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></label>
              <label className="field"><span className="field-label">PAN</span><input value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value })} /></label>
              <label className="field"><span className="field-label">Payment Terms</span>
                <select value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}>
                  <option value="advance">Advance</option><option value="net_30">Net 30</option><option value="net_60">Net 60</option><option value="against_delivery">Against Delivery</option><option value="custom">Custom</option>
                </select>
              </label>
            </div>
            <label className="field"><span className="field-label">Notes</span><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn primary" onClick={save} disabled={saving || !form.code || !form.companyName}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
