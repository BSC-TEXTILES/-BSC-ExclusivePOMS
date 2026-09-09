import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useTracking } from '../tracking.jsx';
import api, { errMessage } from '../api.js';

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
    desc: 'Full system control, company profile, security & PDF/CSV export',
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
    desc: 'Draft new POs, item size matrix & costing',
  },
  {
    id: 'pm',
    name: 'Davanagere Manager',
    role: 'Purchase Manager',
    email: 'pm.dvg@bsc.local',
    password: 'PM@12345',
    badge: 'Purchase Manager',
    category: 'Procurement',
    icon: '👔',
    color: '#4f46e5',
    bg: '#eef2ff',
    desc: 'Review draft POs, validate margins & submit for approvals',
  },
  {
    id: 'approver',
    name: 'Davanagere Approver',
    role: 'Approver',
    email: 'approver.dvg@bsc.local',
    password: 'AP@12345',
    badge: 'PO Approver',
    category: 'Procurement',
    icon: '✅',
    color: '#059669',
    bg: '#ecfdf5',
    desc: 'Review approval queue, authorize or reject POs',
  },
  {
    id: 'receiver',
    name: 'Davanagere Receiver',
    role: 'Receiving User',
    email: 'receiver.dvg@bsc.local',
    password: 'RC@12345',
    badge: 'GRN / Warehouse',
    category: 'Operations',
    icon: '📦',
    color: '#0d9488',
    bg: '#f0fdfa',
    desc: 'Goods receipt notes (GRN), inward scan & stock reconciliation',
  },
  {
    id: 'dvg_admin',
    name: 'Davanagere Admin',
    role: 'Domain Admin',
    email: 'dvg.admin@bsc.local',
    password: 'Admin@123',
    badge: 'Domain Admin',
    category: 'Admin',
    icon: '🏢',
    color: '#7c3aed',
    bg: '#f5f3ff',
    desc: 'Hub division masters, local users & supplier setup',
  },
  {
    id: 'auditor',
    name: 'Enterprise Auditor',
    role: 'Auditor',
    email: 'auditor@bsc.local',
    password: 'AU@12345',
    badge: 'Auditor',
    category: 'Operations',
    icon: '🔍',
    color: '#e11d48',
    bg: '#fff1f2',
    desc: 'Immutable audit logs, security tracking & compliance reports',
  },
  {
    id: 'viewer',
    name: 'Enterprise Viewer',
    role: 'Viewer',
    email: 'viewer@bsc.local',
    password: 'VW@12345',
    badge: 'Viewer',
    category: 'Operations',
    icon: '👁️',
    color: '#64748b',
    bg: '#f8fafc',
    desc: 'Read-only PO registers, calendar & analytics reports',
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
  const [captcha, setCaptcha] = useState({ id: '', svg: '', secondsLeft: 0 });
  const [captchaText, setCaptchaText] = useState('');
  const isDev = import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const devBlocked = !isDev && devtoolsOpen && devtoolsBlock;

  useEffect(() => {
    if (!busy) { setDots(''); return; }
    const id = setInterval(() => setDots((d) => d.length >= 3 ? '' : d + '.'), 400);
    return () => clearInterval(id);
  }, [busy]);

  // Fetch a fresh CAPTCHA challenge and start its 30-second countdown.
  function loadCaptcha() {
    setCaptchaText('');
    api.get('/auth/captcha?reveal=1').then((r) => {
      setCaptcha({ id: r.data.id, svg: r.data.svg, secondsLeft: r.data.ttlSeconds || 30 });
      if (r.data.answer) {
        window.__pomsCaptchaAnswer = r.data.answer;
        if (isDev) setCaptchaText(r.data.answer);
      }
    }).catch(() => {
      setTimeout(loadCaptcha, 2500);
    });
  }

  useEffect(() => { loadCaptcha(); }, []);

  useEffect(() => {
    if (captcha.secondsLeft <= 0) return undefined;
    const t = setInterval(() => {
      setCaptcha((c) => {
        if (c.secondsLeft <= 1) {
          loadCaptcha();
          return { ...c, secondsLeft: 0 };
        }
        return { ...c, secondsLeft: c.secondsLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [captcha.secondsLeft > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  function selectAccount(acc) {
    setIdentifier(acc.email);
    setPassword(acc.password);
    setSelectedRole(acc.id);
    setError('');
    if (isDev && window.__pomsCaptchaAnswer) {
      setCaptchaText(window.__pomsCaptchaAnswer);
    }
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
    if (!captchaText.trim()) {
      setError('Enter the security code shown below');
      return;
    }
    setError(''); setBusy(true);
    try {
      await login(identifier, password, { captchaId: captcha.id, captchaText });
      navigate('/');
    } catch (err) {
      setError(errMessage(err));
      loadCaptcha();
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
          </div>

          <div className="login-field-group">
            <label className="login-field">
              <span className="login-field-label">Security code</span>
              <div className="login-captcha-row">
                {captcha.svg
                  ? <img className="login-captcha-img" src={`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(captcha.svg)))}`} alt="CAPTCHA security code" title="Enter these characters" />
                  : <div className="login-captcha-img login-captcha-loading">…</div>}
                <span className={`login-captcha-timer ${captcha.secondsLeft <= 5 ? 'low' : ''}`}>
                  {captcha.secondsLeft > 0 ? `${captcha.secondsLeft}s` : 'new…'}
                </span>
                <button type="button" className="btn sm" onClick={loadCaptcha} tabIndex={-1} title="Get a new code">↻</button>
              </div>
              <div className="login-input-wrap">
                <svg className="login-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                <input
                  value={captchaText}
                  name="captcha"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck="false"
                  maxLength={5}
                  onChange={(e) => setCaptchaText(e.target.value.toUpperCase())}
                  placeholder="Enter the 5-character code"
                  disabled={busy}
                />
              </div>
              <span className="login-field-label" style={{ fontSize: 11, marginTop: 4 }}>
                Valid for 30 seconds · letters and numbers, case-insensitive
              </span>
            </label>
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
            {['All', 'Procurement', 'Operations', 'Admin'].map((tab) => (
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

          <div className="login-po-info-box">
            <div className="login-po-info-header">
              <span>📋 Purchase Order Lifecycle</span>
              <span style={{ fontSize: 10, color: '#b98a2f', fontWeight: 600 }}>Sample: PO-2026-0001</span>
            </div>
            <div className="login-po-flow-steps">
              <span className="login-po-step">1. Executive Draft</span>
              <span>➔</span>
              <span className="login-po-step">2. Manager Submit</span>
              <span>➔</span>
              <span className="login-po-step">3. Approval</span>
              <span>➔</span>
              <span className="login-po-step">4. Issued & PDF</span>
              <span>➔</span>
              <span className="login-po-step">5. GRN Receipt</span>
            </div>
          </div>

          <a className="login-back" href="/landing">← Back to overview</a>
        </form>
      </div>
    </div>
  );
}
