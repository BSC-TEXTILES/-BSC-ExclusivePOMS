import { useEffect, useState, useCallback } from 'react';
import api, { errMessage } from '../api.js';
import { useAuth } from '../auth.jsx';
import StatusChip from '../components/StatusChip.jsx';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { Field } from '../components/DataTable.jsx';

const PAGE_SIZE = 20;

const EMPTY = {
  name: '', company: '', contactPerson: '', phone: '', email: '',
  address: '', city: '', state: '', country: '', postalCode: '',
  gstNumber: '', panNumber: '', taxInfo: '', notes: '', status: 'active',
};

export default function Customers() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('masters.manage');

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ q: '', status: '' });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const params = { page, limit: PAGE_SIZE };
    if (filters.q) params.q = filters.q;
    if (filters.status) params.status = filters.status;
    api.get('/customers', { params })
      .then((r) => { setRows(r.data.data); setTotal(r.data.total); setError(''); })
      .catch((e) => setError(errMessage(e)));
  }, [page, filters]);

  useEffect(load, [load]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const setF = (patch) => { setPage(1); setFilters({ ...filters, ...patch }); };

  function openNew() { setEditing({}); setForm({ ...EMPTY }); }
  function openEdit(row) {
    setEditing(row);
    setForm({ ...EMPTY, ...row });
  }

  async function save() {
    setBusy(true); setError('');
    try {
      if (editing.id) {
        const { customerCode, createdAt, updatedAt, ...payload } = form;
        await api.patch(`/customers/${editing.id}`, payload);
      } else {
        const { customerCode, ...payload } = form;
        await api.post('/customers', payload);
      }
      setEditing(null); load();
    } catch (e) { setError(errMessage(e)); } finally { setBusy(false); }
  }

  async function remove(row) {
    if (!window.confirm(`Delete customer "${row.name}"?`)) return;
    setBusy(true); setError('');
    try {
      await api.delete(`/customers/${row.id}`);
      load();
    } catch (e) { setError(errMessage(e)); } finally { setBusy(false); }
  }

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="page">
      <h1 className="page-title">Customers</h1>
      <p className="page-sub">Manage customer master data — contact details, tax IDs, and status</p>
      {error && <div className="alert error">{error}</div>}

      <div className="panel">
        <div className="row" style={{ marginBottom: 12 }}>
          <label className="field grow">
            <span className="field-label">Search</span>
            <input value={filters.q} onChange={(e) => setF({ q: e.target.value })} placeholder="Name, company, code, contact…" />
          </label>
          <label className="field">
            <span className="field-label">Status</span>
            <select value={filters.status} onChange={(e) => setF({ status: e.target.value })}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          {canManage && (
            <div style={{ alignSelf: 'flex-end' }}>
              <button className="btn primary" onClick={openNew}><Icon name="plus" size={14} /> New Customer</button>
            </div>
          )}
        </div>

        <table className="grid">
          <thead>
            <tr>
              <th>Code</th><th>Name</th><th>Company</th><th>Contact</th>
              <th>Phone</th><th>Email</th><th>City</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="mono">{c.customerCode}</td>
                <td><strong>{c.name}</strong></td>
                <td>{c.company || '—'}</td>
                <td>{c.contactPerson || '—'}</td>
                <td className="mono">{c.phone || '—'}</td>
                <td className="mono">{c.email || '—'}</td>
                <td>{c.city || '—'}</td>
                <td><StatusChip status={c.status} /></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {canManage && <>
                    <button className="btn sm" onClick={() => openEdit(c)}>Edit</button>{' '}
                    <button className="btn sm danger" onClick={() => remove(c)}>Delete</button>
                  </>}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="muted">No customers found.</td></tr>}
          </tbody>
        </table>

        <div className="row mt">
          <span className="muted">Page {page} of {pages} · {total} customers</span>
          <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      </div>

      {editing && (
        <Modal title={editing.id ? `Edit — ${editing.name}` : 'New Customer'} onClose={() => setEditing(null)} wide>
          <div className="fields-2">
            <Field label="Name"><input value={form.name || ''} onChange={set('name')} /></Field>
            <Field label="Company"><input value={form.company || ''} onChange={set('company')} /></Field>
            <Field label="Contact person"><input value={form.contactPerson || ''} onChange={set('contactPerson')} /></Field>
            <Field label="Phone"><input value={form.phone || ''} onChange={set('phone')} /></Field>
            <Field label="Email"><input type="email" value={form.email || ''} onChange={set('email')} /></Field>
            <Field label="City"><input value={form.city || ''} onChange={set('city')} /></Field>
            <Field label="State"><input value={form.state || ''} onChange={set('state')} /></Field>
            <Field label="Country"><input value={form.country || ''} onChange={set('country')} /></Field>
            <Field label="Postal code"><input value={form.postalCode || ''} onChange={set('postalCode')} /></Field>
          </div>
          <Field label="Address"><input value={form.address || ''} onChange={set('address')} /></Field>
          <div className="fields-2">
            <Field label="GST number"><input value={form.gstNumber || ''} onChange={set('gstNumber')} /></Field>
            <Field label="PAN number"><input value={form.panNumber || ''} onChange={set('panNumber')} /></Field>
          </div>
          <Field label="Tax info"><input value={form.taxInfo || ''} onChange={set('taxInfo')} /></Field>
          <Field label="Notes"><input value={form.notes || ''} onChange={set('notes')} /></Field>
          {editing.id && (
            <Field label="Status">
              <select value={form.status || 'active'} onChange={set('status')}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="archived">archived</option>
              </select>
            </Field>
          )}
          <div className="row">
            <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
            <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
