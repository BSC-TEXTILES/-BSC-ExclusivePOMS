import { useState, useEffect, useCallback, useRef } from 'react';

export default function BackendHealthCheck({ children }) {
  const [backendAvailable, setBackendAvailable] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);
  const attemptsRef = useRef(0);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health', { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        if (mountedRef.current) {
          setBackendAvailable(true);
          setError('');
        }
        return true;
      }
      if (mountedRef.current) {
        setBackendAvailable(false);
        setError(`Backend returned status ${res.status}`);
      }
      return false;
    } catch {
      if (mountedRef.current) {
        setBackendAvailable(false);
        setError('Backend server is not running. Start it with run.bat or cd backend && npm run dev');
      }
      return false;
    } finally {
      if (mountedRef.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    function scheduleRetry(delay) {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        if (!mountedRef.current) return;
        attemptsRef.current += 1;
        setAttempts(attemptsRef.current);
        const ok = await checkHealth();
        if (mountedRef.current && !ok) {
          const next = Math.min(30000, 2000 * 2 ** attemptsRef.current);
          scheduleRetry(next);
        }
      }, delay);
    }

    checkHealth().then((ok) => {
      if (mountedRef.current && !ok) scheduleRetry(2000);
    });

    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
    };
  }, [checkHealth]);

  if (checking && backendAvailable === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8f9fa' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, marginBottom: 12, color: '#374151' }}>Checking backend connection...</div>
          <div style={{ border: '4px solid #e5e7eb', borderTop: '4px solid #3b82f6', borderRadius: '50%', width: 36, height: 36, animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (backendAvailable) return children;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8f9fa', padding: 20 }}>
      <div style={{ background: '#fff', padding: 40, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', maxWidth: 620, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <h1 style={{ color: '#dc2626', marginBottom: 8, fontSize: 24 }}>Backend Server Not Available</h1>
        <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 15, lineHeight: 1.5 }}>
          {error || 'Cannot connect to the backend API server.'}
        </p>

        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: 16, borderRadius: 8, marginBottom: 24, textAlign: 'left' }}>
          <div style={{ fontWeight: 600, color: '#1e40af', marginBottom: 8 }}>Quick fix — run from the project root:</div>
          <code style={{ display: 'block', background: '#1e293b', color: '#e2e8f0', padding: '12px 16px', borderRadius: 6, fontSize: 14, fontFamily: 'Consolas, monospace', whiteSpace: 'pre', lineHeight: 1.6 }}>
            run.bat
          </code>
          <div style={{ marginTop: 8, color: '#6b7280', fontSize: 13 }}>
            This starts PostgreSQL, applies the schema, seeds data, launches the backend (:4040) and frontend (:5173).
          </div>
        </div>

        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', padding: 16, borderRadius: 8, marginBottom: 24, textAlign: 'left', fontSize: 13, color: '#92400e' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Manual steps:</div>
          <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
            <li>Start PostgreSQL: <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>run.bat</code> handles this automatically</li>
            <li>Start backend: <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>cd backend &amp;&amp; npm run dev</code></li>
            <li>Frontend proxy: <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>/api → http://localhost:4040</code></li>
          </ol>
        </div>

        <div style={{ marginBottom: 20, fontSize: 13, color: '#9ca3af' }}>
          Auto-retrying every {Math.min(30, 2 * 2 ** attempts)}s... (attempt {attempts + 1})
        </div>

        <button
          onClick={() => { setAttempts(0); checkHealth(); }}
          style={{ padding: '12px 32px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 500 }}
        >
          Retry Now
        </button>
      </div>
    </div>
  );
}
