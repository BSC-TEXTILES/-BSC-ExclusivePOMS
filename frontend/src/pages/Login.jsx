import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { errMessage } from '../api.js';

const DEMO_ACCOUNTS = [
  { email: 'admin@bsc.local', password: 'Admin@123', role: 'Super Admin' },
  { email: 'supervisor.men@bsc.local', password: 'SUP@12345', role: 'Men Section Supervisor' },
  { email: 'prod1@bsc.local', password: 'PROD@123', role: 'Men Production User' },
  { email: 'buyer.dvg@bsc.local', password: 'PE@12345', role: 'Purchase Executive' },
  { email: 'approver.dvg@bsc.local', password: 'AP@12345', role: 'Approver' },
  { email: 'viewer@bsc.local', password: 'VW@12345', role: 'Viewer' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
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

  function fillDemo(acct) {
    setIdentifier(acct.email);
    setPassword(acct.password);
    setError('');
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="brand-mark">B</div>
          <h1>BSC Exclusive — POMS</h1>
          <div className="muted">Product, Role & Order Management System</div>
        </div>
        {error && <div className="alert error">{error}</div>}
        <label className="field">
          <span className="field-label">Email or username</span>
          <input autoFocus value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="admin@bsc.local" />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </label>
        <button className="btn primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="demo-creds">
          <strong>Quick fill — click any account:</strong>
          <div className="demo-list">
            {DEMO_ACCOUNTS.map((acct) => (
              <button key={acct.email} type="button" className="demo-item" onClick={() => fillDemo(acct)}>
                <span className="demo-email">{acct.email}</span>
                <span className="demo-role">{acct.role}</span>
              </button>
            ))}
          </div>
        </div>
        <a className="back-to-landing" href="/landing">← Back to the overview page</a>
      </form>
    </div>
  );
}
