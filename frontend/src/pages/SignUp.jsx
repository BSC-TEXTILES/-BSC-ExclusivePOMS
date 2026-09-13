import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import api, { errMessage } from '../api.js';

export default function SignUpPage() {
  const { isSignedIn, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', username: '', fullName: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isSignedIn) navigate('/dashboard', { replace: true });
  }, [isSignedIn, navigate]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setBusy(true);
    try {
      // Note: self-signup creates the account; admin assigns roles later.
      // The backend auth/login will work after the admin activates the account.
      await api.post('/auth/signup', {
        email: form.email.trim(),
        username: form.username.trim(),
        fullName: form.fullName.trim(),
        password: form.password,
      });
      // Auto-login after signup
      const { data } = await api.post('/auth/login', { email: form.email.trim(), password: form.password });
      login(data.token, data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

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
        <div className="login-form" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px' }}>
          <div className="login-form-header">
            <div className="login-form-logo">
              <img src="/bsc-logo.png" alt="BSC" />
            </div>
            <h2>Create your account</h2>
            <p>Sign up for BSC Purchase Order Management System</p>
          </div>

          {error && <div className="alert error" style={{ width: '100%', maxWidth: 400, marginBottom: 16 }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 400 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 14 }}>Full Name</label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => update('fullName', e.target.value)}
                required
                placeholder="John Doe"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 14 }}>Username</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => update('username', e.target.value)}
                required
                placeholder="johndoe"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 14 }}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                required
                placeholder="you@company.com"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 14 }}>Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                required
                minLength={10}
                placeholder="Min 10 chars, upper, lower, digit, special"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 14 }}>Confirm Password</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => update('confirmPassword', e.target.value)}
                required
                placeholder="Repeat your password"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="btn primary"
              style={{ width: '100%', padding: '10px 0', fontSize: 15, fontWeight: 600 }}
            >
              {busy ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p style={{ marginTop: 20, fontSize: 14, color: '#6b7280' }}>
            Already have an account? <Link to="/login" style={{ color: '#2563eb' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
