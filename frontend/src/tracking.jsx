import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from './api.js';
import { useAuth } from './auth.jsx';
import { createDevToolsWatcher, getTabId } from './utils/devtools.js';

// Live tracking + security provider:
//  - heartbeat (every 20s and on route change) → server-side session row with
//    IP, device, browser, screen, current tab/route, and optional GPS location
//  - DevTools detection on every page; when the Administrator has blocking on,
//    a full-screen curtain appears, the event is recorded, and the user is
//    signed out (and login is blocked on the login page).
const TrackingContext = createContext({ devtoolsOpen: false, devtoolsBlock: true, demoMode: true });

export const useTracking = () => useContext(TrackingContext);

export function TrackingProvider({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isDev = import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);
  const [devtoolsBlock, setDevtoolsBlock] = useState(false);
  // Demo-account cards on the login page: default to the build mode, then follow
  // the server flag (DEMO_MODE env / NODE_ENV=production hides them).
  const [demoMode, setDemoMode] = useState(import.meta.env.DEV);
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [geo, setGeo] = useState(null);
  const [curtain, setCurtain] = useState(false);
  const devOpenRef = useRef(false);
  const geoRef = useRef(null);
  const kickedRef = useRef(false);

  // Public flags (login page has no token) + refresh from every heartbeat.
  useEffect(() => {
    if (isDev) {
      setDevtoolsBlock(false);
    }
    api.get('/settings/public').then((r) => {
      setDevtoolsBlock(isDev ? false : r.data.devtoolsBlock !== false);
      if (typeof r.data.demoMode === 'boolean') setDemoMode(r.data.demoMode);
      setDemoAccounts(r.data.demoAccounts || []);
    }).catch(() => {});
  }, [location.pathname, isDev]);

  // Geolocation — one permission request per tab session; silently skipped
  // if the user declines. Coordinates ride along on every heartbeat.
  useEffect(() => {
    if (!user || geoRef.current) return;
    geoRef.current = true;
    try {
      let asked = sessionStorage.getItem('poms_geo_asked');
      if (asked) return;
      sessionStorage.setItem('poms_geo_asked', '1');
      navigator.geolocation?.getCurrentPosition(
        (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => {},
        { timeout: 8000, maximumAge: 300000 },
      );
    } catch { /* geolocation unavailable */ }
  }, [user]);

  const sendHeartbeat = useCallback(async (extra = {}) => {
    if (!user) return null;
    try {
      const { data } = await api.post('/tracking/heartbeat', {
        tabId: getTabId(),
        route: window.location.pathname,
        title: document.title,
        screen: `${window.screen.width}x${window.screen.height}`,
        lat: geoRef.current && geo ? geo.lat : undefined,
        lng: geoRef.current && geo ? geo.lng : undefined,
        accuracy: geo ? geo.accuracy : undefined,
        devtools: devOpenRef.current,
        ...extra,
      });
      if (!isDev) {
        setDevtoolsBlock(data.devtoolsBlock !== false);
      }
      return data;
    } catch { return null; }
  }, [user, geo, isDev]);

  // DevTools watcher — runs on every page including login.
  useEffect(() => {
    if (isDev) return undefined;
    const stop = createDevToolsWatcher((open) => {
      devOpenRef.current = open;
      setDevtoolsOpen(open);
    });
    return stop;
  }, [isDev]);

  // Reaction to DevTools while signed in: record + curtain + sign out.
  useEffect(() => {
    if (isDev || !user || !devtoolsOpen) return;
    sendHeartbeat();
    if (devtoolsBlock && !kickedRef.current) {
      kickedRef.current = true;
      setCurtain(true);
      const t = setTimeout(async () => {
        try { await api.post('/tracking/logout', { tabId: getTabId(), reason: 'devtools' }); } catch { /* best effort */ }
        logout();
        setCurtain(false);
        kickedRef.current = false;
        navigate('/login');
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [devtoolsOpen, user, devtoolsBlock, isDev]); // eslint-disable-line react-hooks/exhaustive-deps

  // Heartbeat loop + immediate beat on route change.
  useEffect(() => {
    if (!user) return undefined;
    sendHeartbeat();
    const t = setInterval(() => sendHeartbeat(), 20000);
    return () => clearInterval(t);
  }, [user, location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TrackingContext.Provider value={{ devtoolsOpen: isDev ? false : devtoolsOpen, devtoolsBlock: isDev ? false : devtoolsBlock, demoMode, demoAccounts, sendHeartbeat }}>
      {children}
      {!isDev && curtain && (
        <div className="devtools-curtain" role="alert">
          <div className="curtain-card">
            <div className="curtain-icon">⛔</div>
            <h2>Developer tools detected</h2>
            <p>
              Inspecting this application is not permitted. Your session is being
              signed out and this event has been recorded for the Administrator.
            </p>
            <p className="muted">Close developer tools, then sign in again.</p>
          </div>
        </div>
      )}
      {!isDev && !user && devtoolsOpen && devtoolsBlock && (
        <div className="devtools-curtain" role="alert">
          <div className="curtain-card">
            <div className="curtain-icon">⛔</div>
            <h2>Developer tools detected</h2>
            <p>Sign-in is disabled while developer tools are open.</p>
            <p className="muted">Close them completely, then reload this page.</p>
          </div>
        </div>
      )}
    </TrackingContext.Provider>
  );
}
