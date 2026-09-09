import { useState, useEffect } from 'react';
import api from '../api.js';

export default function BackendHealthCheck({ children }) {
  const [backendAvailable, setBackendAvailable] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health', { 
          method: 'GET',
          cache: 'no-store'
        });
        if (response.ok) {
          setBackendAvailable(true);
        } else {
          setBackendAvailable(false);
          setError('Backend server responded with an error');
        }
      } catch (err) {
        setBackendAvailable(false);
        if (err.name === 'TypeError' || err.message.includes('Failed to fetch')) {
          setError('Backend server is not running. Please start the backend server on port 4040.');
        } else {
          setError(`Backend connection error: ${err.message}`);
        }
      } finally {
        setChecking(false);
      }
    };

    checkHealth();

    // Optional: periodically check
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (checking) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f8f9fa'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 16 }}>Checking backend connection...</div>
          <div className="spinner" style={{
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #3498db',
            borderRadius: '50%',
            width: 40,
            height: 40,
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }}></div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (!backendAvailable) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#fff5f5',
        padding: 20
      }}>
        <div style={{
          background: '#fff',
          padding: 40,
          borderRadius: 12,
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          maxWidth: 600,
          textAlign: 'center'
        }}>
          <h1 style={{ color: '#dc2626', marginBottom: 16 }}>⚠️ Backend Server Not Available</h1>
          <p style={{ color: '#7f1d1d', marginBottom: 24, fontSize: 16 }}>
            {error || 'Cannot connect to the backend API server.'}
          </p>
          <div style={{
            background: '#fef2f2',
            padding: 16,
            borderRadius: 8,
            marginBottom: 24,
            textAlign: 'left',
            fontFamily: 'monospace',
            fontSize: 14
          }}>
            <div><strong>To fix this issue:</strong></div>
            <div style={{ marginTop: 8 }}>
              <ol style={{ textAlign: 'left', paddingLeft: 20 }}>
                <li>Make sure PostgreSQL is running (start-database.bat)</li>
                <li>Start the backend server:
                  <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
                    cd backend &amp;&amp; npm run dev
                  </code>
                </li>
                <li>Or use: <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
                  start-dev.bat
                </code> (starts both servers)</li>
              </ol>
            </div>
          </div>
          <div style={{ color: '#7f1d1d', fontSize: 14 }}>
            Expected backend: http://localhost:4040<br />
            Frontend proxy: /api → http://localhost:4040
          </div>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              marginTop: 24,
              padding: '12px 24px',
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 16
            }}
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return children;
}
