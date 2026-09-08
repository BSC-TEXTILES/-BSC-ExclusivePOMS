import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { errMessage } from '../api.js';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dots, setDots] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    if (!busy) { setDots(''); return; }
    const id = setInterval(() => setDots((d) => d.length >= 3 ? '' : d + '.'), 400);
    return () => clearInterval(id);
  }, [busy]);

  function autofill() {
    setIdentifier('admin@bsc.local');
    setPassword('Admin@123');
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
    <div className="login-page">
      <div className="login-left">
        <div className="login-left-content">
          <div className="login-left-brand">
            <div className="login-left-logo">B</div>
            <span>BSC Exclusive</span>
          </div>
          <div className="login-left-hero">
            <h1>Purchase Order<br/>Management System</h1>
            <p>Streamline your procurement workflow with real-time tracking, approvals, and inventory management.</p>
          </div>
          <div className="login-left-features">
            <div className="login-feature">
              <div className="login-feature-icon">✓</div>
              <div>
                <div className="login-feature-title">Order Tracking</div>
                <div className="login-feature-desc">End-to-end purchase order lifecycle</div>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">✓</div>
              <div>
                <div className="login-feature-title">Smart Approvals</div>
                <div className="login-feature-desc">Multi-level approval workflows</div>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">✓</div>
              <div>
                <div className="login-feature-title">Inventory Control</div>
                <div className="login-feature-desc">Real-time stock balances & receipts</div>
              </div>
            </div>
          </div>
          <div className="login-left-footer">&copy; 2026 BSC Exclusive. All rights reserved.</div>
        </div>
      </div>
      <div className="login-right">
        <form className="login-form" onSubmit={submit}>
          <div className="login-form-header">
            <div className="login-form-logo">
            <img src="/bsc-logo.png" alt="BSC" />
          </div>
            <h2>Welcome back</h2>
            <p>Sign in to your account</p>
          </div>
          {error && <div className="login-alert"><span className="login-alert-icon">!</span>{error}</div>}
          {busy && (
            <div className="login-loading">
              <div className="login-spinner" />
              <div className="login-loading-text">
                Authenticating{dots}
                <span className="login-loading-sub">Verifying credentials and loading your session</span>
              </div>
            </div>
          )}
          <div className="login-field-group">
            <label className="login-field">
              <span className="login-field-label">Email or username</span>
              <div className="login-input-wrap">
                <svg className="login-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <input
                  autoFocus
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin@bsc.local"
                  disabled={busy}
                  autoComplete="username"
                />
              </div>
            </label>
            <label className="login-field">
              <span className="login-field-label">Password</span>
              <div className="login-input-wrap">
                <svg className="login-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={busy}
                  autoComplete="current-password"
                />
                <button type="button" className="login-pwd-toggle" onClick={() => setShowPwd((v) => !v)} tabIndex={-1}>
                  {showPwd ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </label>
          </div>
          <button className="login-submit" type="submit" disabled={busy}>
            {busy ? (
              <span className="login-btn-loading">
                <span className="login-btn-spinner" />
                Signing in{dots}
              </span>
            ) : 'Sign in'}
          </button>
          <div className="login-divider"><span>Quick login</span></div>
          <button type="button" className="login-admin-chip" onClick={autofill} disabled={busy}>
            <div className="login-admin-chip-avatar">A</div>
            <div className="login-admin-chip-info">
              <div className="login-admin-chip-name">Rajeshwar V. Rao</div>
              <div className="login-admin-chip-email">admin@bsc.local</div>
            </div>
            <div className="login-admin-chip-badge">Super Admin</div>
          </button>
          <a className="login-back" href="/landing">← Back to overview</a>
        </form>
      </div>
    </div>
  );
}
