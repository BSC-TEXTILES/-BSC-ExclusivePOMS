import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { errMessage } from '../api.js';

const DEMO_USERS = [
  { name: 'Rajeshwar V. Rao', email: 'admin@bsc.local', password: 'Admin@123', role: 'Super Admin' },
  { name: 'Arjun Mehta', email: 'buyer.dvg@bsc.local', password: 'PE@12345', role: 'Purchase Executive' },
  { name: 'Vikram Singh', email: 'approver.dvg@bsc.local', password: 'AP@12345', role: 'Approver' },
  { name: 'Priya Nair', email: 'receiver.dvg@bsc.local', password: 'RC@12345', role: 'Receiving User' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dots, setDots] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [autoUser, setAutoUser] = useState(null);

  useEffect(() => {
    if (!busy) { setDots(''); return; }
    const id = setInterval(() => setDots((d) => d.length >= 3 ? '' : d + '.'), 400);
    return () => clearInterval(id);
  }, [busy]);

  function autofill(user) {
    setAutoUser(user);
    setIdentifier(user.email);
    setPassword(user.password);
    setError('');
  }

  async function submit(e) {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setError('Please enter both email/username and password');
      return;
    }
    setError(''); setBusy(true);
    try {
      await login(identifier, password);
      navigate('/');
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="brand-mark">B</div>
          <h1>BSC Exclusive — POMS</h1>
          <div className="muted">Purchase Order Management System</div>
        </div>
        {error && <div className="alert error">{error}</div>}
        {busy && (
          <div className="login-loading">
            <div className="login-spinner" />
            <div className="login-loading-text">
              Authenticating{dots}
              <span className="login-loading-sub">Verifying credentials and loading your session</span>
            </div>
          </div>
        )}
        <label className="field">
          <span className="field-label">Email or username</span>
          <input
            autoFocus
            value={identifier}
            onChange={(e) => { setIdentifier(e.target.value); setAutoUser(null); }}
            placeholder="admin@bsc.local"
            disabled={busy}
            autoComplete="username"
          />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <div className="pwd-wrap">
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setAutoUser(null); }}
              placeholder="••••••••"
              disabled={busy}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="pwd-toggle"
              onClick={() => setShowPwd((v) => !v)}
              tabIndex={-1}
              title={showPwd ? 'Hide password' : 'Show password'}
            >
              {showPwd ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </label>
        <button className="btn primary login-btn" type="submit" disabled={busy}>
          {busy ? (
            <span className="login-btn-loading">
              <span className="login-btn-spinner" />
              Signing in{dots}
            </span>
          ) : 'Sign in'}
        </button>
        <div className="demo-users-section">
          <div className="demo-users-label">Quick login — click a user</div>
          <div className="demo-users-grid">
            {DEMO_USERS.map((u) => (
              <button
                type="button"
                key={u.email}
                className={`demo-user-chip ${autoUser?.email === u.email ? 'active' : ''}`}
                onClick={() => autofill(u)}
                disabled={busy}
              >
                <span className="demo-user-avatar">{u.name.charAt(0)}</span>
                <span className="demo-user-info">
                  <span className="demo-user-name">{u.name}</span>
                  <span className="demo-user-role">{u.role}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <a className="back-to-landing" href="/landing">← Back to the overview page</a>
      </form>
    </div>
  );
}
