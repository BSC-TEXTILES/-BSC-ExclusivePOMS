import { useEffect, useState } from 'react';
import api, { errMessage } from '../api.js';
import Modal from '../components/Modal.jsx';

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [rolePerms, setRolePerms] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/roles').then((r) => setRoles(r.data.data || [])).catch((e) => setError(errMessage(e)));
    api.get('/roles/meta/permissions').then((r) => setPermissions(r.data.data || [])).catch(() => {});
  };
  useEffect(load, []);

  const selectRole = (role) => {
    setSelected(role);
    api.get(`/roles/${role.id}`).then((r) => {
      setRolePerms((r.data.data?.permissions || []).map((p) => p.code));
    }).catch((e) => setError(errMessage(e)));
  };

  const togglePerm = (code) => {
    setRolePerms((prev) => prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]);
  };

  const savePerms = async () => {
    setSaving(true); setError('');
    try {
      const permIds = permissions.filter((p) => rolePerms.includes(p.code)).map((p) => p.id);
      await api.put(`/roles/${selected.id}/permissions`, { permissionIds: permIds });
      setSaving(false);
    } catch (e) { setError(errMessage(e)); setSaving(false); }
  };

  const grouped = {};
  permissions.forEach((p) => {
    if (!grouped[p.module]) grouped[p.module] = [];
    grouped[p.module].push(p);
  });

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Roles & Permissions</h1><p className="page-sub" style={{ margin: 0 }}>Manage role-based access control</p></div>
      </div>
      {error && <div className="alert error">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 18 }}>
        <div className="panel">
          <h3>Roles</h3>
          {roles.map((r) => (
            <div key={r.id} onClick={() => selectRole(r)} style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', background: selected?.id === r.id ? '#ecfdf5' : 'transparent', border: `1px solid ${selected?.id === r.id ? '#10b981' : 'transparent'}`, marginBottom: 6 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{r.permission_count || 0} permissions</div>
            </div>
          ))}
        </div>
        <div className="panel">
          {selected ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>{selected.name} — Permissions</h3>
                <button className="btn primary" onClick={savePerms} disabled={saving}>{saving ? 'Saving…' : 'Save Permissions'}</button>
              </div>
              {Object.entries(grouped).map(([module, perms]) => (
                <div key={module} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: 6 }}>{module}</div>
                  {perms.map((p) => (
                    <label key={p.code} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" className="perm-check" checked={rolePerms.includes(p.code)} onChange={() => togglePerm(p.code)} />
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#475569' }}>{p.code}</span>
                      <span style={{ color: '#6b7280' }}>— {p.description}</span>
                    </label>
                  ))}
                </div>
              ))}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>← Select a role to manage permissions</div>
          )}
        </div>
      </div>
    </div>
  );
}
