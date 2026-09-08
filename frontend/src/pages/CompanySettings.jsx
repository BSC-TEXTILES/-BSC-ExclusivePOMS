import { useEffect, useState, useRef } from 'react';
import api, { errMessage } from '../api.js';

export default function CompanySettings() {
  const [form, setForm] = useState({ companyName: '', address: '', city: '', state: '', pinCode: '', phone: '', email: '', gstNumber: '', website: '', logoUrl: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    api.get('/company').then((r) => {
      if (r.data.data) {
        const d = r.data.data;
        setForm({ companyName: d.company_name || '', address: d.address || '', city: d.city || '', state: d.state || '', pinCode: d.pin_code || '', phone: d.phone || '', email: d.email || '', gstNumber: d.gst_number || '', website: d.website || '', logoUrl: d.logo_url || '' });
      }
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      await api.put('/company', form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError(errMessage(e)); }
    setSaving(false);
  };

  const uploadLogo = async (file) => {
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await api.post('/uploads', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm((f) => ({ ...f, logoUrl: r.data.data.url }));
    } catch (e) { setError(errMessage(e)); }
  };

  return (
    <div className="content">
      <div className="page-header">
        <div><h1 className="page-title">Company Settings</h1><p className="page-sub" style={{ margin: 0 }}>Configure company details for PDFs and documents</p></div>
      </div>
      {error && <div className="alert error">{error}</div>}
      {saved && <div className="alert" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>Settings saved successfully</div>}
      <div className="panel">
        <h3>Company Logo</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ width: 80, height: 80, borderRadius: 12, border: '1px solid #e5e7eb', display: 'grid', placeItems: 'center', overflow: 'hidden', background: '#f9fafb' }}>
            {form.logoUrl ? <img src={form.logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ color: '#9ca3af', fontSize: 12 }}>No logo</span>}
          </div>
          <div>
            <button className="btn sm" onClick={() => fileRef.current?.click()}>Upload Logo</button>
            <input type="file" accept="image/*" ref={fileRef} style={{ display: 'none' }} onChange={(e) => { if (e.target.files[0]) uploadLogo(e.target.files[0]); }} />
            {form.logoUrl && <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => setForm((f) => ({ ...f, logoUrl: '' }))}>Remove</button>}
          </div>
        </div>
      </div>
      <div className="panel">
        <h3>Company Details</h3>
        <div className="fields-2">
          <label className="field"><span className="field-label">Company Name</span><input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></label>
          <label className="field"><span className="field-label">GST Number</span><input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} /></label>
          <label className="field"><span className="field-label">Phone</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label className="field"><span className="field-label">Email</span><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label className="field"><span className="field-label">Website</span><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></label>
        </div>
        <label className="field"><span className="field-label">Address</span><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
        <div className="fields-2">
          <label className="field"><span className="field-label">City</span><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
          <label className="field"><span className="field-label">State</span><input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></label>
          <label className="field"><span className="field-label">PIN Code</span><input value={form.pinCode} onChange={(e) => setForm({ ...form, pinCode: e.target.value })} /></label>
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</button>
        </div>
      </div>
    </div>
  );
}
