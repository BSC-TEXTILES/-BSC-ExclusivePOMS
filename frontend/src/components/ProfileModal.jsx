import { useRef, useState } from 'react';
import api, { errMessage, uploadFile } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Field } from '../components/DataTable.jsx';

// Mandatory profile completion. Rendered over the app until the user saves
// their profile (users.profile_updated_at) — admin-created accounts start
// uncompleted, so every new user must fill their own details first.
export default function ProfileModal() {
  const { user, updateUser, logout } = useAuth();
  const [form, setForm] = useState({ fullName: user.fullName || '', phone: user.phone || '', designation: user.designation || '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const photoRef = useRef(null);

  const initials = (form.fullName || user.email || '?')
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

  async function save() {
    setBusy(true); setError(''); setSuccess('');
    try {
      if (!form.fullName?.trim()) throw new Error('Full name is required');
      const { data } = await api.patch('/users/me', form);
      updateUser({
        fullName: data.data.full_name,
        phone: data.data.phone,
        designation: data.data.designation,
        profileUpdatedAt: data.data.profile_updated_at,
      });
      setSuccess('Profile saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError(errMessage(e)); }
    setBusy(false);
  }

  return (
    <div className="modal-backdrop" style={{ zIndex: 80 }} onMouseDown={(e) => e.stopPropagation()}>
      <div style={{
        background: '#fff', borderRadius: 20, width: '100%', maxWidth: 860, maxHeight: '90vh',
        boxShadow: '0 25px 60px -12px rgba(0,0,0,0.25)', display: 'flex', overflow: 'hidden',
      }}>
        {/* ─── LEFT PANEL: Avatar & Info (Fixed / No Scroll) ─── */}
        <div style={{
          width: 300, flexShrink: 0, background: 'linear-gradient(160deg, #0f766e 0%, #115e59 40%, #134e4a 100%)',
          color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '36px 28px', position: 'relative', overflow: 'hidden',
        }}>
          {/* Decorative circles */}
          <div style={{ position: 'absolute', top: -60, right: -60, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ position: 'absolute', bottom: -40, left: -40, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

          {/* Back / Logout button */}
          <button
            onClick={logout}
            style={{
              position: 'absolute', top: 14, left: 14, background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, color: '#fff',
              padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4, transition: 'all .2s', zIndex: 2,
            }}
            onMouseEnter={(e) => { e.target.style.background = 'rgba(255,255,255,0.25)'; }}
            onMouseLeave={(e) => { e.target.style.background = 'rgba(255,255,255,0.15)'; }}
          >
            ← Back
          </button>

          {/* Avatar */}
          <div style={{ position: 'relative', marginTop: 20, marginBottom: 16 }}>
            <div style={{
              width: 96, height: 96, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
              border: '4px solid rgba(255,255,255,0.4)', display: 'grid', placeItems: 'center',
              fontSize: 32, fontWeight: 800, letterSpacing: 1, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            }}>
              {user.profilePhotoUrl ? (
                <img src={user.profilePhotoUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : initials}
            </div>
            <button
              onClick={() => photoRef.current?.click()}
              style={{
                position: 'absolute', bottom: 0, right: -4, width: 32, height: 32, borderRadius: '50%',
                background: '#fff', border: '2px solid #0f766e', display: 'grid', placeItems: 'center',
                cursor: 'pointer', fontSize: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', transition: 'all .2s',
              }}
              title="Upload photo"
              onMouseEnter={(e) => { e.target.style.transform = 'scale(1.1)'; }}
              onMouseLeave={(e) => { e.target.style.transform = 'scale(1)'; }}
            >
              📷
            </button>
            <input
              ref={photoRef} type="file" accept="image/*" hidden
              onChange={async (e) => {
                const f = e.target.files[0];
                if (!f) return;
                try {
                  const { data } = await uploadFile('/users/me/photo', f, 'file');
                  updateUser({ profilePhotoUrl: data.data.profilePhotoUrl });
                } catch (err) { setError(errMessage(err)); }
                e.target.value = '';
              }}
            />
          </div>

          {/* User Info */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
              {form.fullName || 'Your Name'}
            </div>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>{user.email}</div>
            {form.designation && (
              <div style={{
                fontSize: 11, background: 'rgba(255,255,255,0.2)', padding: '3px 10px',
                borderRadius: 999, display: 'inline-block', marginTop: 4, fontWeight: 600,
              }}>
                {form.designation}
              </div>
            )}
          </div>

          {/* Profile Strength */}
          <div style={{ width: '100%', marginTop: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.8, marginBottom: 6 }}>
              <span>Profile Strength</span>
              <span>{[form.fullName, form.phone, form.designation].filter(Boolean).length}/3</span>
            </div>
            <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3 }}>
              <div style={{
                width: `${([form.fullName, form.phone, form.designation].filter(Boolean).length / 3) * 100}%`,
                height: '100%', background: '#5eead4', borderRadius: 3, transition: 'width .3s',
              }} />
            </div>
          </div>
        </div>

        {/* ─── RIGHT PANEL: Form (Scrollable) ─── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            padding: '20px 28px', borderBottom: '1px solid #e5e7eb',
            background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Complete your profile</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#6b7280' }}>
                Welcome, {user.email}! Update your details before continuing.
              </p>
            </div>
          </div>

          {/* Scrollable Form */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
              Your account was created by the Administrator. Update your details to keep
              records accurate and your profile secure.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Full name" hint="shown across the system">
                  <input
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="e.g. Rajeshwar V. Rao"
                    style={{ fontSize: 14, padding: '10px 12px' }}
                  />
                </Field>
              </div>
              <Field label="Phone">
                <input
                  value={form.phone || ''}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 …"
                  style={{ fontSize: 14, padding: '10px 12px' }}
                />
              </Field>
              <Field label="Designation">
                <input
                  value={form.designation || ''}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  placeholder="e.g. Purchase Executive"
                  style={{ fontSize: 14, padding: '10px 12px' }}
                />
              </Field>
            </div>

            {error && (
              <div style={{
                marginTop: 14, padding: '10px 14px', borderRadius: 8, fontSize: 13,
                background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
              }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{
                marginTop: 14, padding: '10px 14px', borderRadius: 8, fontSize: 13,
                background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534',
              }}>
                {success}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 28px', borderTop: '1px solid #e5e7eb', background: '#f9fafb',
            display: 'flex', justifyContent: 'flex-end', gap: 10,
          }}>
            <button
              className="btn"
              onClick={logout}
              style={{ padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}
            >
              Logout
            </button>
            <button
              className="btn primary"
              disabled={busy || !form.fullName?.trim()}
              onClick={save}
              style={{
                padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 700,
                background: '#0f766e', borderColor: '#0f766e', transition: 'all .2s',
              }}
            >
              {busy ? 'Saving…' : 'Save profile & continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
