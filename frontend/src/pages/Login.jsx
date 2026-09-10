import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useTracking } from '../tracking.jsx';
import api, { errMessage } from '../api.js';

// Login page — fully restricted to exactly three role-based logins:
//   1. Admin (Super Admin) — full control
//   2. Division Supervisor (Men's Section) — read-only restricted view
//   3. Purchase Order Executive — places purchase orders
const DEMO_ACCOUNTS = [
  {
    id: 'admin',
    name: 'Rajeshwar V. Rao',
    role: 'Super Admin',
    email: 'admin@bsc.local',
    password: 'Admin@123',
    badge: 'Super Admin',
    category: 'Admin',
    icon: '👑',
    color: '#b98a2f',
    bg: '#fef3c7',
    desc: 'Full system control — brands, colours, colour codes, users & approvals',
  },
  {
    id: 'supervisor',
    name: "Men's Section Supervisor",
    role: 'Division Supervisor',
    email: 'men.supervisor@bsc.local',
    password: 'DS@12345',
    badge: "Men's Section",
    category: 'Supervisors',
    icon: '👔',
    color: '#0d9488',
    bg: '#f0fdfa',
    desc: "Restricted: Men's section PO details only — net purchase margin, total quantity, discount & selling price",
  },
  {
    id: 'buyer',
    name: 'Davanagere Executive',
    role: 'Purchase Executive',
    email: 'buyer.dvg@bsc.local',
    password: 'PE@12345',
    badge: 'Purchase Executive',
    category: 'Procurement',
    icon: '📝',
    color: '#2563eb',
    bg: '#eff6ff',
    desc: 'Place purchase orders — draft POs, item size matrix & costing',
  },
];

export default function Login() {
  const { login } = useAuth();
  const { devtoolsOpen, devtoolsBlock } = useTracking();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('admin@bsc.local');
  const [password, setPassword] = useState('Admin@123');
  const [selectedRole, setSelectedRole] = useState('admin');
  const [roleFilter, setRoleFilter] = useState('All');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dots, setDots] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [captcha, setCaptcha] = useState({ svg: '', id: '', answer: '' });
  const [captchaText, setCaptchaText] = useState('');
  const isDev = import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const devBlocked = !isDev && devtoolsOpen && devtoolsBlock;

  // Fetch CAPTCHA on mount
  useEffect(() => {
    fetchCaptcha();
  }, []);

  const fetchCaptcha = async () => {
    try {
      const res = await fetch('/api/auth/captcha?reveal=1');
      const data = await res.json();
      setCaptcha({ svg: data.svg, id: data.id, answer: data.answer || '' });
    } catch (e) {
      // In demo mode, CAPTCHA might fail but that's ok
      console.warn('Could not fetch CAPTCHA:', e.message);
    }
  };

  useEffect(() => {
    if (!busy) { setDots(''); return; }
    const id = setInterval(() => setDots((d) => d.length >= 3 ? '' : d + '.'), 400);
    return () => clearInterval(id);
  }, [busy]);

  function selectAccount(acc) {
    setIdentifier(acc.email);
    setPassword(acc.password);
    setSelectedRole(acc.id);
    setError('');
    // no-op
  }

  async function submit(e) {
    e.preventDefault();
    if (devBlocked) {
      setError('Developer tools are open — close them completely and reload this page to sign in');
      return;
    }
    if (!identifier.trim() || !password.trim()) {
      setError('Please enter both email/username and password');
      return;
    }
    setError(''); setBusy(true);
    try {
      // Pass CAPTCHA if available
      const extra = {};
      if (captcha.id && captchaText) {
        extra.captchaId = captcha.id;
        extra.captchaText = captchaText;
      }
      await login(identifier, password, extra);
      navigate('/');
    } catch (err) {
      const msg = errMessage(err);
      setError(msg);
      // Fetch a fresh challenge when the server rejected the CAPTCHA
      // (errMessage carries the API text; axios's err.message does not)
      if (/captcha/i.test(msg)) {
        setCaptchaText('');
        fetchCaptcha();
      }
      // login failed
    } finally {
      setBusy(false);
    }
  }

  const filteredAccounts = roleFilter === 'All'
    ? DEMO_ACCOUNTS
    : DEMO_ACCOUNTS.filter((a) => a.category === roleFilter);

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-left-content">
          <div className="login-left-brand">
            <div className="login-left-logo">B</div>
            <span>BSC Exclusive</span>
          </div>
          <div className="login-left-top-actions">
            <button type="button" className="login-back-home" onClick={() => navigate('/')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              Back to Home
            </button>
          </div>
          <div className="login-left-hero">
            <h1>Purchase Order<br />Management System</h1>
            <p>Next-generation enterprise procurement platform with matrix size quantities, multi-tier approvals, branded PDF/CSV exports, and goods receipt tracking.</p>
          </div>

          <div className="login-left-features">
            <div className="login-feature">
              <div className="login-feature-icon">1</div>
              <div>
                <div className="login-feature-title">PO Drafting & Size Matrix</div>
                <div className="login-feature-desc">Purchase Executives configure item sizing grids, costs, margins & discounts.</div>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">2</div>
              <div>
                <div className="login-feature-title">Tiered Approval Governance</div>
                <div className="login-feature-desc">Purchase Managers & Approvers enforce budgets, margin limits & threshold rules.</div>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">3</div>
              <div>
                <div className="login-feature-title">Branded PDF & Detailed CSV Export</div>
                <div className="login-feature-desc">Vectorized A4 purchase orders with BSC branding, GSTIN breakdown & signature blocks.</div>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">4</div>
              <div>
                <div className="login-feature-title">Warehouse GRN & Inventory</div>
                <div className="login-feature-desc">Receiving bay records deliveries, inspects defects, and updates live warehouse stock.</div>
              </div>
            </div>
          </div>

          <div className="login-left-footer">&copy; 2026 BSC Exclusive Private Limited. All rights reserved.</div>
        </div>
      </div>

      <div className="login-right">
        <form className="login-form" onSubmit={submit}>
          <div className="login-form-header">
            <div className="login-form-logo">
              <img src="/bsc-logo.png" alt="BSC" />
            </div>
            <h2>Welcome back</h2>
            <p>Sign in to BSC Purchase Order Management System</p>
          </div>

          {error && <div className="login-alert"><span className="login-alert-icon">!</span>{error}</div>}
          {devBlocked && (
            <div className="login-alert" style={{ background: '#fef2f2', borderColor: '#dc2626', color: '#b91c1c' }}>
              <span className="login-alert-icon">⛔</span>
              Developer tools detected — sign-in is disabled. Close them and reload.
            </div>
          )}
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
                <svg className="login-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                <input
                  autoFocus
                  value={identifier}
                  name="username"
                  autoComplete="username"
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin@bsc.local"
                  disabled={busy}
                />
              </div>
            </label>

            <label className="login-field">
              <span className="login-field-label">Password</span>
              <div className="login-input-wrap">
                <svg className="login-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  name="password"
                  autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={busy}
                />
                <button type="button" className="login-pwd-toggle" onClick={() => setShowPwd((v) => !v)} tabIndex={-1}>
                  {showPwd ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
            </label>
            
            {/* CAPTCHA Field - Only shown when CAPTCHA is loaded */}
            {captcha.id && (
              <label className="login-field">
                <span className="login-field-label">
                  Enter CAPTCHA
                  <button type="button" className="login-captcha-refresh" onClick={fetchCaptcha} tabIndex={-1} title="Refresh CAPTCHA">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                  </button>
                </span>
                <div className="login-input-wrap">
                  <div className="login-captcha-svg" dangerouslySetInnerHTML={{ __html: captcha.svg }} />
                  <input
                    type="text"
                    value={captchaText}
                    name="captcha"
                    autoComplete="off"
                    onChange={(e) => setCaptchaText(e.target.value)}
                    placeholder="Enter the CAPTCHA text"
                    disabled={busy}
                    style={{ flex: 1 }}
                  />
                </div>
              </label>
            )}
          </div>

          <button className="login-submit" type="submit" disabled={busy || devBlocked}>
            {busy ? (
              <span className="login-btn-loading">
                <span className="login-btn-spinner" />
                Signing in{dots}
              </span>
            ) : devBlocked ? 'Sign-in blocked' : 'Sign in'}
          </button>

          <div className="login-divider"><span>Role-Based Logins & PO Access</span></div>

          <div className="login-role-tabs">
            {['All', 'Admin', 'Supervisors', 'Procurement'].map((tab) => (
              <button
                key={tab}
                type="button"
                className={`login-role-tab ${roleFilter === tab ? 'active' : ''}`}
                onClick={() => setRoleFilter(tab)}
              >
                {tab} {tab === 'All' ? `(${DEMO_ACCOUNTS.length})` : `(${DEMO_ACCOUNTS.filter((a) => a.category === tab).length})`}
              </button>
            ))}
          </div>

          <div className="login-users-grid">
            {filteredAccounts.map((acc) => {
              const active = selectedRole === acc.id;
              return (
                <button
                  key={acc.id}
                  type="button"
                  className={`login-user-card ${active ? 'active' : ''}`}
                  onClick={() => selectAccount(acc)}
                  disabled={busy}
                  title={`Click to fill login for ${acc.name} (${acc.email})`}
                >
                  <div className="login-user-avatar" style={{ background: acc.color }}>
                    {acc.icon}
                  </div>
                  <div className="login-user-details">
                    <div className="login-user-header">
                      <span className="login-user-name">{acc.name}</span>
                      <span className="login-user-badge" style={{ background: acc.bg, color: acc.color }}>
                        {acc.badge}
                      </span>
                    </div>
                    <div className="login-user-role">{acc.desc}</div>
                    <div className="login-user-creds">
                      {acc.email} · <strong>{acc.password}</strong>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </form>
      </div>
    </div>
  );
}
