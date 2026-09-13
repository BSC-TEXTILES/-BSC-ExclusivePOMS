import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('POMS Application Error:', error, errorInfo);
  }

  handleReset = () => {
    // Clerk handles session — just redirect to login
    window.location.href = '/login';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b1a2e',
          color: '#f8fafc',
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          padding: '24px',
        }}>
          <div style={{
            background: '#132338',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            maxWidth: '520px',
            width: '100%',
            padding: '36px 30px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '42px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ fontSize: '22px', margin: '0 0 8px', color: '#fff' }}>
              Something went wrong
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px' }}>
              An unexpected error occurred while rendering the page. Click below to reload or reset your session.
            </p>
            {this.state.error?.message && (
              <div style={{
                background: 'rgba(220, 38, 38, 0.15)',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                color: '#fca5a5',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontFamily: 'monospace',
                marginBottom: '24px',
                wordBreak: 'break-word',
                textAlign: 'left',
              }}>
                {this.state.error.message}
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: '#b98a2f',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '13.5px',
                }}
              >
                Reload Page
              </button>
              <button
                onClick={this.handleReset}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255,255,255,0.15)',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontSize: '13.5px',
                }}
              >
                Sign In Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
