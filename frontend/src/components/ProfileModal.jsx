import { useRef, useState } from 'react';
import api, { errMessage, uploadFile } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Avatar } from '../components/Topbar.jsx';
import { Field } from '../components/DataTable.jsx';

// Mandatory profile completion. Rendered over the app until the user saves
// their profile (users.profile_updated_at) — admin-created accounts start
// uncompleted, so every new user must fill their own details first.
export default function ProfileModal() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ fullName: user.fullName || '', phone: user.phone || '', designation: user.designation || '' });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const photoRef = useRef(null);

  async function save() {
    setBusy(true); setError('');
    try {
      if (newPassword && newPassword.length < 8) throw new Error('New password must be at least 8 characters');
      if (newPassword && !currentPassword) throw new Error('Enter your current password to set the new one');
      if (newPassword) await api.post('/auth/change-password', { currentPassword, newPassword });
      const { data } = await api.patch('/users/me', form);
      updateUser({
        fullName: data.data.full_name,
        phone: data.data.phone,
        designation: data.data.designation,
        profileUpdatedAt: data.data.profile_updated_at,
      });
    } catch (e) { setError(errMessage(e)); }
    setBusy(false);
  }

  return (
    <div className="modal-backdrop" style={{ zIndex: 80 }} onMouseDown={(e) => e.stopPropagation()}>
      <div className="modal">
        <div className="modal-head">
          <h3>Complete your profile</h3>
        </div>
        <div className="modal-body">
          <p className="muted" style={{ margin: '0 0 12px', fontSize: 12.5 }}>
            Welcome, {user.email}! Your account was created by the Administrator. Update your
            details before continuing — this keeps our records accurate and your profile secure.
          </p>
          <div className="row" style={{ alignItems: 'center', marginBottom: 12 }}>
            <Avatar user={user} size={48} />
            <div>
              <button className="btn sm" onClick={() => photoRef.current?.click()}>Upload photo</button>
              <input ref={photoRef} type="file" accept="image/*" hidden onChange={async (e) => {
                const f = e.target.files[0];
                if (!f) return;
                try {
                  const { data } = await uploadFile('/users/me/photo', f, 'file');
                  updateUser({ profilePhotoUrl: data.data.profilePhotoUrl });
                } catch (err) { setError(errMessage(err)); }
                e.target.value = '';
              }} />
            </div>
          </div>
          <div className="fields-2">
            <Field label="Full name" hint="shown across the system">
              <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="e.g. Gagan C B" />
            </Field>
            <Field label="Phone">
              <input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 …" />
            </Field>
            <Field label="Designation">
              <input value={form.designation || ''} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Purchase Executive" />
            </Field>
            <Field label="Set new password (optional)">
              <input type="password" name="new-password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="min 8 characters" />
            </Field>
            {!!newPassword && (
              <Field label="Current password" hint="needed to set the new password">
                <input type="password" name="current-password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </Field>
            )}
          </div>
          {error && <div className="alert error" style={{ marginTop: 10 }}>{error}</div>}
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save profile & continue'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
