import { useState, useEffect } from 'react';
import api, { errMessage } from '../api.js';
import { useAuth } from '../auth.jsx';
import Modal from '../components/Modal.jsx';

export default function Locations() {
  const { hasPermission } = useAuth();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', address: '', city: '', state: '', country: 'India', latitude: '', longitude: '', contactPerson: '', phone: '', notes: '' });
  const [error, setError] = useState('');
  const canManage = hasPermission('masters.manage') || hasPermission('orders.manage');

  useEffect(() => { loadLocations(); }, []);

  async function loadLocations() {
    setLoading(true);
    try {
      const { data } = await api.get('/locations');
      setLocations(data.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm({ code: '', name: '', address: '', city: '', state: '', country: 'India', latitude: '', longitude: '', contactPerson: '', phone: '', notes: '' });
    setShowModal(true);
  }

  function openEdit(loc) {
    setEditing(loc);
    setForm({
      code: loc.code, name: loc.name, address: loc.address || '', city: loc.city || '',
      state: loc.state || '', country: loc.country || 'India',
      latitude: loc.latitude || '', longitude: loc.longitude || '',
      contactPerson: loc.contact_person || '', phone: loc.phone || '', notes: loc.notes || '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    setError('');
    try {
      const payload = { ...form, latitude: form.latitude ? Number(form.latitude) : null, longitude: form.longitude ? Number(form.longitude) : null };
      if (editing) {
        await api.patch(`/locations/${editing.id}`, payload);
      } else {
        await api.post('/locations', payload);
      }
      setShowModal(false);
      loadLocations();
    } catch (e) { setError(errMessage(e)); }
  }

  async function handleDelete(loc) {
    if (!confirm(`Delete location "${loc.name}"?`)) return;
    try { await api.delete(`/locations/${loc.id}`); loadLocations(); } catch (e) { alert(errMessage(e)); }
  }

  function getDirections(loc) {
    if (loc.latitude && loc.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}`, '_blank');
    } else if (loc.city) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(loc.city + ', ' + (loc.state || '') + ', ' + (loc.country || 'India'))}`, '_blank');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Locations</h1>
        {canManage && <button className="btn primary" onClick={openAdd}>+ Add Location</button>}
      </div>

      {loading ? <div className="loading"><span className="loading-spinner" /> Loading…</div> : (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Code</th><th>Name</th><th>City</th><th>State</th><th>Contact</th><th>Phone</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => (
                <tr key={loc.id}>
                  <td><span className="chip">{loc.code}</span></td>
                  <td><strong>{loc.name}</strong></td>
                  <td>{loc.city || '—'}</td>
                  <td>{loc.state || '—'}</td>
                  <td>{loc.contact_person || '—'}</td>
                  <td>{loc.phone || '—'}</td>
                  <td><span className={`status-chip ${loc.status}`}>{loc.status}</span></td>
                  <td className="actions-cell">
                    <button className="btn sm" onClick={() => getDirections(loc)} title="Get Directions">Directions</button>
                    {canManage && (
                      <>
                        <button className="btn sm" onClick={() => openEdit(loc)}>Edit</button>
                        <button className="btn sm danger" onClick={() => handleDelete(loc)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {!locations.length && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>No locations found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title={editing ? 'Edit Location' : 'Add Location'} onClose={() => setShowModal(false)}>
          {error && <div className="alert error">{error}</div>}
          <div className="form-grid">
            <label>Code *<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={!!editing} /></label>
            <label>Name *<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Address<textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} /></label>
            <label>City<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
            <label>State<input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></label>
            <label>Country<input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></label>
            <label>Latitude<input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} /></label>
            <label>Longitude<input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} /></label>
            <label>Contact Person<input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></label>
            <label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label>Notes<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></label>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
