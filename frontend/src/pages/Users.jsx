import { useEffect, useState, useCallback, useRef } from 'react';
import api, { errMessage, uploadFile } from '../api.js';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { Field } from '../components/DataTable.jsx';

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

function UserAvatar({ user, size = 34 }) {
  if (user.profile_photo_url) return <img className="avatar-img" src={user.profile_photo_url} alt={user.full_name} style={{ width: size, height: size }} />;
  return <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials(user.full_name)}</div>;
}

export default function Users() {
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // user object or {} for new
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const photoRef = useRef(null);

  const load = useCallback(() => {
    Promise.all([api.get('/users'), api.get('/users/_meta/roles'), api.get('/divisions')])
      .then(([u, r, d]) => { setRows(u.data.data); setRoles(r.data.data); setDivisions(d.data.data); })
      .catch((e) => setError(errMessage(e)));
  }, []);
  useEffect(load, [load]);

  function openNew() {
    setEditing({});
    setForm({ email: '', username: '', fullName: '', password: '', roles: ['viewer'], divisionIds: [] });
  }
  function openEdit(u) {
    setEditing(u);
    setForm({ ...u, roles: u.roles, divisionIds: u.division_ids, password: '' });
  }

  async function save() {
    setBusy(true); setError('');
    try {
      if (editing.id) {
        const patch = { fullName: form.fullName, phone: form.phone, status: form.status, roles: form.roles, divisionIds: form.divisionIds };
        await api.patch(`/users/${editing.id}`, patch);
        if (form.password) await api.post(`/users/${editing.id}/reset-password`, { newPassword: form.password });
      } else {
        await api.post('/users', form);
      }
      setEditing(null); load();
    } catch (e) { setError(errMessage(e)); } finally { setBusy(false); }
  }

  async function uploadPhoto(e) {
    const f = e.target.files[0];
    if (!f || !editing?.id) return;
    try {
      await uploadFile(`/users/${editing.id}/photo`, f, 'file');
      setEditing(null); load();
    } catch (err) { setError(errMessage(err)); }
    e.target.value = '';
  }

  const toggle = (key, id) => {
    const cur = form[key] || [];
    setForm({ ...form, [key]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };

  return (
    <div className="page">
      <h1 className="page-title">Users & Roles</h1>
      <p className="page-sub">Grant anyone access — pick their roles and divisions; access stays least-privilege (§6.1, RB-001)</p>
      {error && <div className="alert error">{error}</div>}

      <div className="panel">
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="btn primary" onClick={openNew}><Icon name="plus" size={14} /> New User</button>
        </div>
        <table className="grid">
          <thead><tr><th></th><th>User</th><th>Email</th><th>Roles</th><th>Divisions</th><th>Status</th><th>Last login</th><th></th></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className={u.status !== 'active' ? 'row-dim' : ''}>
                <td><UserAvatar user={u} /></td>
                <td><strong>{u.full_name}</strong>{u.designation && <div className="muted">{u.designation}</div>}<div className="muted mono">{u.username}</div></td>
                <td className="mono">{u.email}</td>
                <td>{u.roles.map((r) => <span key={r} className="chip role-chip">{r.replace(/_/g, ' ')}</span>)}</td>
                <td>{u.division_ids.map((id) => divisions.find((d) => d.id === id)?.code || '?').join(', ')}</td>
                <td><span className={`chip st-${u.status}`}>{u.status}</span></td>
                <td className="muted">{u.last_login_at ? new Date(u.last_login_at).toLocaleString('en-IN') : 'never'}</td>
                <td><button className="btn sm" onClick={() => openEdit(u)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing.id ? `Edit — ${editing.full_name}` : 'New User'} onClose={() => setEditing(null)} wide>
          {editing.id && (
            <div className="row" style={{ alignItems: 'center', marginBottom: 14 }}>
              <UserAvatar user={editing} size={54} />
              <div>
                <div className="muted" style={{ fontSize: 12 }}>Profile photo</div>
                <button className="btn sm" onClick={() => photoRef.current?.click()}><Icon name="upload" size={13} /> Upload photo</button>
                <input ref={photoRef} type="file" accept="image/*" hidden onChange={uploadPhoto} />
              </div>
            </div>
          )}
          <div className="fields-2">
            <Field label="Full name"><input value={form.fullName || ''} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
            <Field label="Phone"><input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            {!editing.id && <Field label="Email"><input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>}
            {!editing.id && <Field label="Username"><input value={form.username || ''} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>}
            <Field label={editing.id ? 'New password (leave blank to keep)' : 'Password'} hint="min 8 characters">
              <input type="password" value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            {editing.id && (
              <Field label="Status" hint="inactive users cannot sign in">
                <select value={form.status || 'active'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="active">active</option><option value="inactive">inactive</option>
                </select>
              </Field>
            )}
          </div>
          <Field label="Roles — what this user can do">
            <div className="row">
              {roles.map((r) => (
                <label key={r.code} className={`role-pick ${(form.roles || []).includes(r.code) ? 'on' : ''}`} title={r.description}>
                  <input type="checkbox" checked={(form.roles || []).includes(r.code)} onChange={() => toggle('roles', r.code)} /> {r.name}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Division scope — where this user can act">
            <div className="row">
              {divisions.map((d) => (
                <label key={d.id} className={`role-pick ${(form.divisionIds || []).includes(d.id) ? 'on' : ''}`}>
                  <input type="checkbox" checked={(form.divisionIds || []).includes(d.id)} onChange={() => toggle('divisionIds', d.id)} /> {d.name}
                </label>
              ))}
            </div>
          </Field>
          <div className="row">
            <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save user'}</button>
            <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
