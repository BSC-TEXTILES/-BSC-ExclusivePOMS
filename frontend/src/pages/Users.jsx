import { useEffect, useState, useCallback, useRef } from 'react';
import api, { errMessage, uploadFile, assetUrl } from '../api.js';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { Field } from '../components/DataTable.jsx';
import { useAuth } from '../auth.jsx';

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

function UserAvatar({ user, size = 34 }) {
  if (user.profile_photo_url) return <img className="avatar-img" src={assetUrl(user.profile_photo_url)} alt={user.full_name} style={{ width: size, height: size }} />;
  return <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials(user.full_name)}</div>;
}

// Client-side password strength validation (matches server-side Zod schema)
function validatePassword(password) {
  if (!password) return { valid: true, errors: [] };
  const errors = [];
  if (password.length < 8) errors.push('at least 8 characters');
  if (password.length > 128) errors.push('no more than 128 characters');
  if (!/[A-Z]/.test(password)) errors.push('at least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('at least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('at least one number');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('at least one special character');
  return { valid: errors.length === 0, errors };
}

export default function Users() {
  const { user } = useAuth();
  const isAdmin = !!user.isSuperAdmin;
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [sections, setSections] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // user object or {} for new
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const photoRef = useRef(null);

  const load = useCallback(() => {
    Promise.all([api.get('/users'), api.get('/users/_meta/roles'), api.get('/divisions'), api.get('/sections')])
      .then(([u, r, d, s]) => {
        setRows(u.data.data || []); setRoles(r.data.data || []); setDivisions(d.data.data || []);
        setSections((s.data.data || []).filter((x) => x.status !== 'archived'));
      })
      .catch((e) => setError(errMessage(e)));
  }, []);
  useEffect(load, [load]);

  function openNew() {
    setEditing({});
    setForm(isAdmin
      ? { email: '', username: '', fullName: '', password: '', roles: ['viewer'], divisionIds: [], sectionIds: [] }
      : { email: '', username: '', fullName: '', phone: '', password: '' });
  }
  function openEdit(u) {
    setEditing(u);
    setForm({ ...u, roles: u.roles, divisionIds: u.division_ids, sectionIds: u.section_ids || [], password: '' });
  }

  async function save() {
    setBusy(true); setError('');
    try {
      // Validate password strength before sending to server
      if (form.password) {
        const pwCheck = validatePassword(form.password);
        if (!pwCheck.valid) {
          throw new Error('Password does not meet requirements: ' + pwCheck.errors.join(', '));
        }
      }
      if (editing.id) {
        const patch = { fullName: form.fullName, phone: form.phone, status: form.status, roles: form.roles, divisionIds: form.divisionIds, sectionIds: form.sectionIds };
        await api.patch(`/users/${editing.id}`, patch);
        if (form.password) await api.post(`/users/${editing.id}/reset-password`, { newPassword: form.password });
      } else if (isAdmin) {
        await api.post('/users', form);
      } else {
        // Account creators: no role/scope fields — the Administrator assigns those.
        const { email, username, fullName, phone, password } = form;
        await api.post('/users', { email, username, fullName, phone, password });
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
      <p className="page-sub">{isAdmin
        ? 'Grant anyone access — pick their roles and divisions; access stays least-privilege (§6.1, RB-001)'
        : 'Create login accounts. Roles and access scope are decided by the Administrator.'}</p>
      {error && <div className="alert error">{error}</div>}

      <div className="panel">
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="btn primary" onClick={openNew}><Icon name="plus" size={14} /> New User</button>
        </div>
        <table className="grid">
          <thead><tr><th></th><th>User</th><th>Email</th><th>Roles</th><th>Collections</th><th>Divisions</th><th>Status</th><th>Last login</th><th></th></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className={u.status !== 'active' ? 'row-dim' : ''}>
                <td><UserAvatar user={u} /></td>
                <td><strong>{u.full_name}</strong>{u.designation && <div className="muted">{u.designation}</div>}<div className="muted mono">{u.username}</div></td>
                <td className="mono">{u.email}</td>
                <td>{u.roles.map((r) => <span key={r} className="chip role-chip">{r.replace(/_/g, ' ')}</span>)}</td>
                <td>{(u.section_ids || []).length
                  ? (u.section_ids.map((id) => sections.find((s) => s.id === id)?.name).filter(Boolean).join(', ') || `${u.section_ids.length} collection(s)`)
                  : <span className="muted">all</span>}</td>
                <td>{(u.division_ids || []).map((id) => divisions.find((d) => d.id === id)?.code || '?').join(', ')}</td>
                <td><span className={`chip st-${u.status}`}>{u.status}</span></td>
                <td className="muted">{u.last_login_at ? new Date(u.last_login_at).toLocaleString('en-IN') : 'never'}</td>
                <td>{isAdmin && <button className="btn sm" onClick={() => openEdit(u)}>Edit</button>}</td>
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
            {!editing.id && <Field label="Email"><input type="email" name="email" autoComplete="off" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>}
            {!editing.id && <Field label="Username"><input name="username" autoComplete="off" value={form.username || ''} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>}
            <Field label={editing.id ? 'New password (leave blank to keep)' : 'Password'} hint="min 8 chars, uppercase, lowercase, number, special char">
              <input type="password" name="new-password" autoComplete="new-password" value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              {form.password && (() => {
                const check = validatePassword(form.password);
                return !check.valid && (
                  <div style={{ marginTop: 6, fontSize: 12, color: '#b91c1c' }}>
                    {check.errors.map((e, i) => <div key={i}>• {e}</div>)}
                  </div>
                );
              })()}
            </Field>
            {editing.id && (
              <Field label="Status" hint="inactive users cannot sign in">
                <select value={form.status || 'active'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="active">active</option><option value="inactive">inactive</option>
                </select>
              </Field>
            )}
          </div>
          {isAdmin ? (
            <>
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
              <Field label="Collection scope — which product collections this user can order from and see" hint="leave empty for all collections">
                <div className="row">
                  {sections.map((s) => (
                    <label key={s.id} className={`role-pick ${(form.sectionIds || []).includes(s.id) ? 'on' : ''}`} title={s.code || ''}>
                      <input type="checkbox" checked={(form.sectionIds || []).includes(s.id)} onChange={() => toggle('sectionIds', s.id)} /> {s.name}
                    </label>
                  ))}
                </div>
              </Field>
            </>
          ) : (
            <div className="alert" style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e' }}>
              The account is created without access. Only the Administrator assigns roles and division scope — the new user can sign in, but will see nothing until the Administrator grants their role.
            </div>
          )}
          <div className="row">
            <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save user'}</button>
            <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
