import { useState, useEffect } from 'react';
import api, { errMessage } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { Field } from '../components/DataTable.jsx';

export default function CompanySettings() {
  const { hasPermission } = useAuth();
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState({ type: '', msg: '' });

  const canManage = hasPermission('settings.manage');

  useEffect(() => {
    if (!canManage) { setLoading(false); return; }
    api.get('/company-settings')
      .then((r) => setForm(r.data.data || {}))
      .catch((e) => setAlert({ type: 'error', msg: errMessage(e) }))
      .finally(() => setLoading(false));
  }, [canManage]);

  async function save(e) {
    e.preventDefault();
    setSaving(true); setAlert({ type: '', msg: '' });
    try {
      await api.put('/company-settings', form);
      setAlert({ type: 'success', msg: 'Settings saved successfully.' });
    } catch (e) {
      setAlert({ type: 'error', msg: errMessage(e) });
    } finally { setSaving(false); }
  }

  function set(key, val) { setForm((f) => ({ ...f, [key]: val })); }

  if (!canManage) return (
    <div className="page">
      <h1 className="page-title">Company Settings</h1>
      <div className="alert error">You do not have permission to manage company settings.</div>
    </div>
  );

  return (
    <div className="page">
      <h1 className="page-title"><Icon name="building" size={20} /> Company Settings</h1>
      <p className="page-sub">Configure company details, branding and defaults used across orders, invoices and PDFs.</p>

      {alert.msg && <div className={`alert ${alert.type === 'error' ? 'error' : 'success'}`}>{alert.msg}</div>}

      {loading ? <p className="muted">Loading…</p> : (
        <form onSubmit={save}>
          <div className="panel">
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>General Information</h2>
            <div className="fields-2">
              <Field label="Company Name" hint="Legal / trading name">
                <input value={form.company_name || ''} onChange={(e) => set('company_name', e.target.value)} />
              </Field>
              <Field label="Phone">
                <input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
              </Field>
              <Field label="Email">
                <input type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} />
              </Field>
              <Field label="Website">
                <input value={form.website || ''} onChange={(e) => set('website', e.target.value)} placeholder="https://" />
              </Field>
            </div>
            <Field label="Address">
              <textarea rows={2} value={form.address || ''} onChange={(e) => set('address', e.target.value)} />
            </Field>
          </div>

          <div className="panel">
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Tax & Registration</h2>
            <div className="fields-2">
              <Field label="GST Number">
                <input value={form.gst_number || ''} onChange={(e) => set('gst_number', e.target.value)} />
              </Field>
              <Field label="PAN Number">
                <input value={form.pan_number || ''} onChange={(e) => set('pan_number', e.target.value)} />
              </Field>
            </div>
            <Field label="Registration Info">
              <textarea rows={2} value={form.registration_info || ''} onChange={(e) => set('registration_info', e.target.value)} />
            </Field>
            <Field label="Authorized Signatory">
              <input value={form.authorized_signatory || ''} onChange={(e) => set('authorized_signatory', e.target.value)} />
            </Field>
          </div>

          <div className="panel">
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Order Defaults</h2>
            <div className="fields-2">
              <Field label="Order Prefix" hint="Auto-prepended to order numbers (e.g. ORD)">
                <input value={form.order_prefix || ''} onChange={(e) => set('order_prefix', e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="panel">
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Branding</h2>
            <Field label="Logo URL">
              <input value={form.logo_url || ''} onChange={(e) => set('logo_url', e.target.value)} placeholder="https://…" />
            </Field>
            {form.logo_url && (
              <div style={{ margin: '8px 0 12px' }}>
                <img src={form.logo_url} alt="Logo preview" style={{ maxHeight: 60, borderRadius: 4 }} />
              </div>
            )}
          </div>

          <div className="panel">
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>PDF & Invoice Templates</h2>
            <Field label="PDF Header">
              <textarea rows={3} value={form.pdf_header || ''} onChange={(e) => set('pdf_header', e.target.value)} />
            </Field>
            <Field label="PDF Footer">
              <textarea rows={3} value={form.pdf_footer || ''} onChange={(e) => set('pdf_footer', e.target.value)} />
            </Field>
            <Field label="Invoice Footer">
              <textarea rows={3} value={form.invoice_footer || ''} onChange={(e) => set('invoice_footer', e.target.value)} />
            </Field>
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            <button type="submit" className="btn primary" disabled={saving}>
              <Icon name="check" size={14} /> {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
