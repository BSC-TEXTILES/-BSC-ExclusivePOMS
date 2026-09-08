import { useState } from 'react';
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

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="brand-mark">B</div>
          <h1>BSC Exclusive — POMS</h1>
          <div className="muted">Purchase Order Management System</div>
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
          <strong>Demo accounts (after seed):</strong><br />
          admin@bsc.local / Admin@123 — Super Admin<br />
          buyer.dvg@bsc.local / PE@12345 — Purchase Executive<br />
          approver.dvg@bsc.local / AP@12345 — Approver<br />
          receiver.dvg@bsc.local / RC@12345 — Receiving User
        </div>
        <a className="back-to-landing" href="/landing">← Back to the overview page</a>
      </form>
    </div>
  );
}
