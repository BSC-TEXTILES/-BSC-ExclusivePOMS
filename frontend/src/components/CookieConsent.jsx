import { useState, useEffect } from 'react';

// Strictly-necessary-only cookie notice. Shown on public pages until the
// visitor accepts; the choice is remembered in local storage.
const KEY = 'poms_cookie_consent';

export default function CookieConsent() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { setShow(!localStorage.getItem(KEY)); } catch { setShow(false); }
  }, []);
  if (!show) return null;

  const accept = () => {
    try { localStorage.setItem(KEY, new Date().toISOString()); } catch { /* ignore */ }
    setShow(false);
  };

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie notice">
      <div className="cookie-text">
        <strong>We use cookies 🍪</strong>
        <span>
          POMS stores only strictly necessary cookies and local storage: your session token,
          your display preferences (dark/bright mode) and a per-tab identifier for live session
          security. No advertising or third-party trackers. Read our{' '}
          <a href="/privacy">Privacy Policy</a> and <a href="/terms">Terms &amp; Conditions</a>.
        </span>
      </div>
      <button className="btn primary" onClick={accept}>Accept &amp; continue</button>
    </div>
  );
}
