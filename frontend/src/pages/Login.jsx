import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import api, { errMessage } from '../api.js';

const REMEMBER_KEY = 'poms_remember_email';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  domain_admin: 'Domain Admin',
  purchase_manager: 'Purchase Manager',
  purchase_executive: 'Purchase Executive',
  approver: 'Approver',
  receiving_user: 'Receiving User',
  viewer: 'Viewer',
  auditor: 'Auditor',
  division_supervisor: 'Division Supervisor',
};

function roleLabels(roles = []) {
  return roles.map((r) => ROLE_LABELS[r] || String(r).replace(/_/g, ' ')).join(', ');
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

// Demo accounts seeded in the database
const DEMO_ACCOUNTS = [
  { email: 'admin@bsc.local', password: 'Admin@123', name: 'Rajeshwar V. Rao', role: 'super_admin', divisions: 'All (DVG, SMG, BLG)' },
  { email: 'dvg.admin@bsc.local', password: 'Admin@123', name: 'Davanagere Domain Admin', role: 'domain_admin', divisions: 'DVG' },
  { email: 'pm.dvg@bsc.local', password: 'PM@12345', name: 'Davanagere Purchase Manager', role: 'purchase_manager', divisions: 'DVG' },
  { email: 'buyer.dvg@bsc.local', password: 'PE@12345', name: 'Davanagere Purchase Executive', role: 'purchase_executive', divisions: 'DVG' },
  { email: 'approver.dvg@bsc.local', password: 'AP@12345', name: 'Davanagere Approver', role: 'approver', divisions: 'DVG' },
  { email: 'receiver.dvg@bsc.local', password: 'RC@12345', name: 'Davanagere Receiving User', role: 'receiving_user', divisions: 'DVG' },
  { email: 'viewer@bsc.local', password: 'VW@12345', name: 'Enterprise Viewer', role: 'viewer', divisions: 'All (DVG, SMG, BLG)' },
  { email: 'auditor@bsc.local', password: 'AU@12345', name: 'Enterprise Auditor', role: 'auditor', divisions: 'All (DVG, SMG, BLG)' },
  { email: 'sureshmen', password: 'Buyer@12345', name: 'Suresh Men', role: 'purchase_executive', divisions: 'DVG (Men\'s Sections)' },
  { email: 'men.supervisor@bsc.local', password: 'DS@12345', name: "Men's Section Division Supervisor", role: 'division_supervisor', divisions: 'DVG (Men\'s Sections)' },
];

export default function Login() {
  const { isSignedIn, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(() => {
    try { return localStorage.getItem(REMEMBER_KEY) || ''; } catch { return ''; }
  });
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => {
    try { return !!localStorage.getItem(REMEMBER_KEY); } catch { return false; }
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);

  const [loginUser, setLoginUser] = useState(null);
  const [loginToken, setLoginToken] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const countdownRef = useRef(null);

  useEffect(() => {
    if (isSignedIn) navigate('/dashboard', { replace: true });
  }, [isSignedIn, navigate]);

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/login', { email: email.trim(), password });

      if (remember) {
        localStorage.setItem(REMEMBER_KEY, email.trim());
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }

      setLoginUser(data.user);
      setLoginToken(data.token);
      setShowDetails(true);

      let remaining = 4;
      countdownRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(countdownRef.current);
          login(data.token, data.user);
          navigate('/dashboard', { replace: true });
        }
      }, 1000);
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function fillDemo(acct) {
    setEmail(acct.email);
    setPassword(acct.password);
    setRemember(true);
    localStorage.setItem(REMEMBER_KEY, acct.email);
    setShowAccounts(false);
  }

  function skipToApp() {
    if (countdownRef.current) clearInterval(countdownRef.current);
    login(loginToken, loginUser);
    navigate('/dashboard', { replace: true });
  }

  // ─── SUCCESS SCREEN ────────────────────────────────────────────────────
  if (showDetails && loginUser) {
    return (
      <div className="login-page">
        <div className="login-left">
          <div className="login-left-content">
            <div className="login-left-brand">
              <div className="login-left-logo">B</div>
              <span>BSC Exclusive</span>
            </div>
            <div className="login-left-hero">
              <h1>Welcome<br />{loginUser.fullName}!</h1>
              <p>You are now signed in. Loading your dashboard...</p>
            </div>
            <div className="login-left-footer">&copy; 2026 BSC Exclusive Private Limited. All rights reserved.</div>
          </div>
        </div>

        <div className="login-right">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px', width: '100%', maxWidth: 460 }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #0f766e, #115e59)',
              display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800, color: '#fff',
              border: '3px solid rgba(15,118,110,0.3)', marginBottom: 16, boxShadow: '0 8px 24px rgba(15,118,110,0.25)',
            }}>
              {loginUser.profilePhotoUrl
                ? <img src={loginUser.profilePhotoUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                : initials(loginUser.fullName)}
            </div>

            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#111827' }}>{loginUser.fullName}</h2>
            <p style={{ margin: '0 0 6px', fontSize: 14, color: '#6b7280' }}>{loginUser.email}</p>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
              {loginUser.roles.map((r) => (
                <span key={r} style={{
                  background: r === 'super_admin' ? '#fef3c7' : '#e0e7ff',
                  color: r === 'super_admin' ? '#92400e' : '#3730a3',
                  padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                }}>
                  {ROLE_LABELS[r] || r.replace(/_/g, ' ')}
                </span>
              ))}
            </div>

            <div style={{
              width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb',
              borderRadius: 12, padding: '16px 20px', marginBottom: 20,
            }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Account Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', fontSize: 13 }}>
                <div>
                  <div style={{ color: '#6b7280', marginBottom: 2 }}>Username</div>
                  <div style={{ fontWeight: 500, color: '#111827' }}>{loginUser.username || '—'}</div>
                </div>
                <div>
                  <div style={{ color: '#6b7280', marginBottom: 2 }}>Email</div>
                  <div style={{ fontWeight: 500, color: '#111827', wordBreak: 'break-all' }}>{loginUser.email}</div>
                </div>
                <div>
                  <div style={{ color: '#6b7280', marginBottom: 2 }}>Full Name</div>
                  <div style={{ fontWeight: 500, color: '#111827' }}>{loginUser.fullName}</div>
                </div>
                <div>
                  <div style={{ color: '#6b7280', marginBottom: 2 }}>Designation</div>
                  <div style={{ fontWeight: 500, color: '#111827' }}>{loginUser.designation || '—'}</div>
                </div>
                <div>
                  <div style={{ color: '#6b7280', marginBottom: 2 }}>Account Status</div>
                  <div style={{ fontWeight: 500, color: '#059669' }}>Active</div>
                </div>
                <div>
                  <div style={{ color: '#6b7280', marginBottom: 2 }}>Profile Updated</div>
                  <div style={{ fontWeight: 500, color: '#111827' }}>{loginUser.profileUpdatedAt ? 'Yes' : 'Not yet'}</div>
                </div>
              </div>
            </div>

            {loginUser.permissions?.length > 0 && (
              <div style={{
                width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb',
                borderRadius: 12, padding: '16px 20px', marginBottom: 20,
              }}>
                <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Permissions ({loginUser.permissions.length})
                </h4>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {loginUser.permissions.slice(0, 12).map((p) => (
                    <span key={p} style={{
                      background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0',
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, fontFamily: 'monospace',
                    }}>{p}</span>
                  ))}
                  {loginUser.permissions.length > 12 && (
                    <span style={{ fontSize: 11, color: '#6b7280', padding: '2px 4px' }}>
                      +{loginUser.permissions.length - 12} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {(loginUser.divisionIds?.length > 0 || loginUser.sectionIds?.length > 0) && (
              <div style={{
                width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb',
                borderRadius: 12, padding: '16px 20px', marginBottom: 20,
              }}>
                <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Access Scope
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                  <div>
                    <div style={{ color: '#6b7280', marginBottom: 4 }}>Assigned Divisions</div>
                    <div style={{ fontWeight: 500, color: '#111827' }}>
                      {loginUser.isSuperAdmin ? 'All divisions (Super Admin)' : `${loginUser.divisionIds?.length || 0} division(s)`}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#6b7280', marginBottom: 4 }}>Assigned Collections</div>
                    <div style={{ fontWeight: 500, color: '#111827' }}>
                      {loginUser.isSuperAdmin ? 'All collections (Super Admin)' : `${loginUser.sectionIds?.length || 0} collection(s)`}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={skipToApp}
              className="btn primary"
              style={{ width: '100%', padding: '12px 0', fontSize: 15, fontWeight: 600, marginTop: 4 }}
            >
              Go to Dashboard →
            </button>
            <p style={{ marginTop: 12, fontSize: 12, color: '#9ca3af' }}>
              Auto-redirecting in a few seconds...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── LOGIN FORM ────────────────────────────────────────────────────────
  return (
    <div className="login-page">
      <div className="login-left">
        <button
          type="button"
          className="login-back-home-btn"
          onClick={() => navigate('/landing')}
          title="Back to Home"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Back to Home</span>
        </button>

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
        <div className="login-form" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px' }}>
          <div className="login-form-header">
            <div className="login-form-logo">
              <img src="/bsc-logo.png" alt="BSC" />
            </div>
            <h2>Welcome back</h2>
            <p>Sign in to BSC Purchase Order Management System</p>
          </div>

          {error && <div className="alert error" style={{ width: '100%', maxWidth: 400, marginBottom: 16 }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 400 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 14 }}>Email</label>
              <input
                type="email"
                name="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 14 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  style={{ width: '100%', padding: '10px 36px 10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                    color: '#6b7280', fontSize: 16, lineHeight: 1,
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#0f766e' }}
              />
              <label htmlFor="remember" style={{ fontSize: 13, color: '#6b7280', cursor: 'pointer' }}>
                Remember my email
              </label>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="btn primary"
              style={{ width: '100%', padding: '10px 0', fontSize: 15, fontWeight: 600 }}
            >
              {busy ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p style={{ marginTop: 16, fontSize: 14, color: '#6b7280' }}>
            Don't have an account? <Link to="/signup" style={{ color: '#2563eb' }}>Sign up</Link>
          </p>

          {/* ─── Demo Accounts Section ───────────────────────────────────── */}
          <div style={{ width: '100%', maxWidth: 400, marginTop: 20, borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
            <button
              type="button"
              onClick={() => setShowAccounts(!showAccounts)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8,
                padding: '10px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151',
              }}
            >
              <span>👤 Demo Accounts (click to auto-fill)</span>
              <span style={{ fontSize: 18, transition: 'transform .2s', transform: showAccounts ? 'rotate(180deg)' : 'rotate(0)' }}>▾</span>
            </button>

            {showAccounts && (
              <div style={{
                marginTop: 8, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}>
                {DEMO_ACCOUNTS.map((acct) => (
                  <button
                    key={acct.email}
                    type="button"
                    onClick={() => fillDemo(acct)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', border: 'none', borderBottom: '1px solid #f3f4f6',
                      background: '#fff', cursor: 'pointer', textAlign: 'left',
                      transition: 'background .15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f0fdf4'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: acct.role === 'super_admin' ? '#fef3c7' : acct.role === 'domain_admin' ? '#e0e7ff' : '#f0fdf4',
                      color: acct.role === 'super_admin' ? '#92400e' : acct.role === 'domain_admin' ? '#3730a3' : '#166534',
                      display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0,
                    }}>
                      {initials(acct.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {acct.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>{acct.email}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>
                        Password: <span style={{ fontFamily: 'monospace', color: '#6b7280' }}>{acct.password}</span>
                      </div>
                    </div>
                    <span style={{
                      background: acct.role === 'super_admin' ? '#fef3c7' : '#e0e7ff',
                      color: acct.role === 'super_admin' ? '#92400e' : '#3730a3',
                      padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
                    }}>
                      {ROLE_LABELS[acct.role]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
