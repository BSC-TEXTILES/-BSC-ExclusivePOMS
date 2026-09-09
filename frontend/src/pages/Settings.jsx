import { useEffect, useState } from 'react';
import api, { errMessage } from '../api.js';

export default function Settings() {
  const [settings, setSettings] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/settings').then((r) => setSettings(r.data.data || [])).catch((e) => setError(errMessage(e)));
  };
  useEffect(load, []);

  const save = async (key) => {
    setSaving(true); setError('');
    try {
      let val = editValue;
      try { val = JSON.parse(editValue); } catch { /* keep as string */ }
      await api.put(`/settings/${key}`, { value: val });
      setEditing(null); load();
    } catch (e) { setError(errMessage(e)); }
    setSaving(false);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Settings</h1><p className="page-sub" style={{ margin: 0 }}>System configuration</p></div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="panel">
        <table className="grid">
          <thead><tr><th>Key</th><th>Value</th><th>Description</th><th>Actions</th></tr></thead>
          <tbody>
            {settings.map((s) => (
              <tr key={s.key}>
                <td className="mono" style={{ fontWeight: 600 }}>{s.key}</td>
                <td>
                  {editing === s.key ? (
                    <input value={editValue} onChange={(e) => setEditValue(e.target.value)} style={{ padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: 6, width: 200 }} />
                  ) : (
                    <span style={{ fontFamily: 'monospace' }}>{typeof s.value === 'object' ? JSON.stringify(s.value) : String(s.value)}</span>
                  )}
                </td>
                <td style={{ color: '#6b7280', fontSize: 12 }}>{s.description || '—'}</td>
                <td>
                  {editing === s.key ? (
                    <><button className="btn sm ok" onClick={() => save(s.key)} disabled={saving}>{saving ? '…' : 'Save'}</button> <button className="btn sm" onClick={() => setEditing(null)}>Cancel</button></>
                  ) : (
                    <button className="btn sm" onClick={() => { setEditing(s.key); setEditValue(typeof s.value === 'object' ? JSON.stringify(s.value) : String(s.value)); }}>Edit</button>
                  )}
                </td>
              </tr>
            ))}
            {!settings.length && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>No settings found</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="panel" style={{ marginTop: 18 }}>
        <h3>System Information</h3>
        <div className="product-detail-meta">
          <div className="meta-item"><div className="meta-label">Application</div><div className="meta-value">Men's Collection Management System</div></div>
          <div className="meta-item"><div className="meta-label">Version</div><div className="meta-value">1.0.0</div></div>
          <div className="meta-item"><div className="meta-label">Currency</div><div className="meta-value">INR (₹)</div></div>
          <div className="meta-item"><div className="meta-label">Database</div><div className="meta-value">PostgreSQL</div></div>
        </div>
      </div>
    </div>
  );
}
