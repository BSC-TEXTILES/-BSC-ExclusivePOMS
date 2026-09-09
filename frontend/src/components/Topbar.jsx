import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api, { errMessage, uploadFile, API_BASE, assetUrl } from '../api.js';
import { useAuth, useCart } from '../auth.jsx';
import Icon from './Icon.jsx';
import ProfileModal from './ProfileModal.jsx';

// WebSocket endpoint: same host in single-origin mode, the API origin when the
// frontend is deployed separately (Vercel → Render).
const WS_ORIGIN = API_BASE.startsWith('http')
  ? API_BASE.replace(/^http/, 'ws').replace(/\/api$/, '')
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

export function Avatar({ user, size = 34 }) {
  const src = user?.profilePhotoUrl ? assetUrl(user.profilePhotoUrl) : null;
  if (src) {
    return <img className="avatar-img" src={src} alt={user.fullName} style={{ width: size, height: size }} />;
  }
  return <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials(user?.fullName)}</div>;
}

// Top bar: hamburger → sidebar collapse · global search · live notification bell
// (WebSocket) · running date & time · dark/bright toggle · admin DevTools-block
// switch · profile menu with avatar.
export default function Topbar({ collapsed, onToggle }) {
  const { user, logout, updateUser, hasPermission } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [now, setNow] = useState(new Date());
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [openMenu, setOpenMenu] = useState(null); // 'search' | 'bell' | 'profile'
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('poms_theme') || 'light');
  const [devtoolsBlock, setDevtoolsBlock] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const boxRef = useRef(null);

  // Dark / bright mode — persisted per browser, applied on <html data-theme>.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('poms_theme', theme);
  }, [theme]);

  // Load the admin-controlled security flags (DevTools blocking).
  useEffect(() => {
    if (user.isSuperAdmin) {
      api.get('/settings').then((r) => {
        const sec = (r.data.data || []).find((s) => s.key === 'security');
        if (sec) setDevtoolsBlock(sec.value?.devtoolsBlock !== false);
      }).catch(() => {});
    }
  }, [user.isSuperAdmin]);

  async function toggleDevtoolsBlock() {
    const next = !devtoolsBlock;
    setDevtoolsBlock(next);
    try {
      await api.put('/settings/security', { value: { devtoolsBlock: next }, description: 'DevTools blocking — when on, opening browser developer tools blocks login and ends the session' });
    } catch (e) {
      setDevtoolsBlock(!next);
      alert(errMessage(e));
    }
  }

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    api.get('/notifications').then((r) => {
      setNotifications(r.data.data || []);
      setUnread(r.data.unread);
    }).catch(() => {});
  }, []);

  // Live notifications over /ws/notify — badge + toast, no polling.
  useEffect(() => {
    let sock;
    let retry;
    const connect = () => {
      sock = new WebSocket(`${WS_ORIGIN}/ws/notify?token=${localStorage.getItem('poms_token')}`);
      sock.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'notification' && String(msg.userId) === String(user.id)) {
            setNotifications((list) => [msg.notification, ...list].slice(0, 50));
            setUnread((u) => u + 1);
            setToast(msg.notification);
            setTimeout(() => setToast(null), 6000);
          }
        } catch { /* ignore malformed frame */ }
      };
      sock.onclose = () => { retry = setTimeout(connect, 4000); };
    };
    connect();
    return () => { clearTimeout(retry); sock?.close(); };
  }, [user.id]);

  useEffect(() => {
    const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpenMenu(null); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  async function onSearch(v) {
    setQ(v);
    if (v.trim().length < 2) { setResults(null); setOpenMenu(null); return; }
    try {
      const { data } = await api.get('/search', { params: { q: v.trim() } });
      setResults(data.data || { purchaseOrders: [], products: [], suppliers: [], users: [] });
      setOpenMenu('search');
    } catch { setResults(null); }
  }

  function goSearch(item, kind) {
    setOpenMenu(null); setQ(''); setResults(null);
    if (kind === 'po') navigate(`/purchase-orders/${item.id}`);
    if (kind === 'product') navigate(`/catalogue?q=${encodeURIComponent(item.sku)}`);
    if (kind === 'user' && hasPermission('users.manage')) navigate('/users');
  }

  async function markAll() {
    await api.post('/notifications/read-all').catch(() => {});
    setNotifications((list) => list.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
  }

  async function markOne(n) {
    if (!n.is_read) {
      api.post(`/notifications/${n.id}/read`).catch(() => {});
      setUnread((u) => Math.max(0, u - 1));
      setNotifications((list) => list.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
    setOpenMenu(null);
    if (n.entity_type === 'purchase_order' && n.entity_id) navigate(`/purchase-orders/${n.entity_id}`);
  }

  const canSearchUsers = user.isSuperAdmin || hasPermission('users.manage');
  const r = results;

  return (
    <header className="topbar" ref={boxRef}>
      <div className="topbar-left">
        <button className="icon-btn" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={onToggle}>
          <Icon name="menu" size={20} />
        </button>
        <div className="topbar-title">Purchase Order Management System</div>
      </div>

      <div className="topbar-search">
        <Icon name="search" size={15} className="search-icon" />
        <input
          value={q}
          placeholder="Search POs, products, suppliers…"
          onChange={(e) => onSearch(e.target.value)}
          onFocus={() => results && setOpenMenu('search')}
        />
        {openMenu === 'search' && r && (
          <div className="dropdown search-drop">
            <div className="drop-section">Purchase Orders</div>
            {(r.purchaseOrders || []).map((p) => (
              <button key={p.id} className="drop-item" onClick={() => goSearch(p, 'po')}>
                <Icon name="po" size={15} /> <span><strong>{p.po_number}</strong> · {p.supplier} · {p.division}</span>
                <span className={`right chip st-${p.status}`}>{p.status.replace(/_/g, ' ')}</span>
              </button>
            ))}
            {!(r.purchaseOrders || []).length && <div className="drop-empty">No matching POs</div>}
            <div className="drop-section">Products</div>
            {(r.products || []).map((p) => (
              <button key={p.id} className="drop-item" onClick={() => goSearch(p, 'product')}>
                <Icon name="catalogue" size={15} /> <span><strong>{p.name}</strong> · {p.brand_name}</span>
                <span className="right muted mono">{p.sku}</span>
              </button>
            ))}
            {!(r.products || []).length && <div className="drop-empty">No matching products</div>}
            {!!(r.suppliers || []).length && <div className="drop-section">Suppliers</div>}
            {(r.suppliers || []).map((s) => (
              <div key={s.id} className="drop-item static"><Icon name="building" size={15} /> <span>{s.company_name}</span></div>
            ))}
            {canSearchUsers && !!(r.users || []).length && <div className="drop-section">Users</div>}
            {canSearchUsers && (r.users || []).map((u) => (
              <button key={u.id} className="drop-item" onClick={() => goSearch(u, 'user')}>
                <Icon name="users" size={15} /> <span>{u.full_name}</span> <span className="right muted">{u.email}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="topbar-right">
        <div className="clock" title={now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}>
          <Icon name="clock" size={15} />
          <span>{now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          <strong>{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong>
        </div>

        {/* (Dark / bright mode switch removed by request — light theme fixed) */}

        {/* Administrator-only: DevTools blocking */}
        {user.isSuperAdmin && (
          <button
            className="tb-switch" title={devtoolsBlock
              ? 'DevTools blocking is ON — developer tools block login and end sessions. Click to disable.'
              : 'DevTools blocking is OFF. Click to enable (recommended).'}
            onClick={toggleDevtoolsBlock}>
            <span className={`switch-track ${devtoolsBlock ? 'on' : 'off'}`}>
              <span className="switch-thumb">{devtoolsBlock ? '🛡️' : '⚠️'}</span>
            </span>
            <span className="switch-label">DevTools {devtoolsBlock ? 'blocked' : 'allowed'}</span>
          </button>
        )}

        <div className="tb-anchor">
          <button className="icon-btn bell" title="Notifications" onClick={() => setOpenMenu(openMenu === 'bell' ? null : 'bell')}>
            <Icon name="bell" size={19} />
            {unread > 0 && <span className="badge">{unread > 99 ? '99+' : unread}</span>}
          </button>
        {openMenu === 'bell' && (
          <div className="dropdown bell-drop">
            <div className="drop-head">
              <strong>Notifications {unread > 0 && <span className="chip">{unread} new</span>}</strong>
              <button className="btn ghost sm" onClick={markAll}>Mark all read</button>
            </div>
            <div className="drop-scroll">
              {notifications.map((n) => (
                <button key={n.id} className={`drop-item notif ${n.is_read ? '' : 'unread'}`} onClick={() => markOne(n)}>
                  <span className="notif-dot" />
                  <span>
                    <strong>{n.title}</strong>
                    {n.body && <span className="notif-body">{n.body}</span>}
                    <span className="notif-time">{new Date(n.sent_at).toLocaleString('en-IN')}</span>
                  </span>
                </button>
              ))}
              {!notifications.length && <div className="drop-empty">You're all caught up 🎉</div>}
            </div>
          </div>
        )}
        </div>

        {/* Cart — always visible in the top navigation (right section).
            Any role that places an order sees it here; checkout crosschecks
            the details once more before the order is finally placed and the
            complete summary invoice is generated. */}
        <div className="tb-anchor">
          <button
            className={`icon-btn cart-indicator ${openMenu === 'cart' ? 'active' : ''}`}
            title="Order cart — review, crosscheck and checkout"
            onClick={() => setOpenMenu(openMenu === 'cart' ? null : 'cart')}
          >
            <Icon name="po" size={19} />
            {cart.count > 0 && <span className="badge cart-badge">{cart.count}</span>}
          </button>
          {openMenu === 'cart' && (
            <div className="dropdown cart-drop">
              <div className="drop-head">🛒 Pending orders in cart</div>
              <div className="drop-scroll">
                {cart.items.map((it) => (
                  <div key={it.id} className="drop-item cart-item">
                    <span>
                      <strong className="mono">{it.poNumber}</strong>
                      <span className="notif-body">{it.sectionName} · {it.supplierName}</span>
                      <span className="notif-time">Added {new Date(it.addedAt).toLocaleString('en-IN')}</span>
                    </span>
                    <span className="right row" style={{ gap: 6 }}>
                      {it.grandTotal != null && <strong>₹{Number(it.grandTotal).toLocaleString('en-IN')}</strong>}
                      <button className="btn sm danger" onClick={() => cart.removeItem(it.id)}>✕</button>
                    </span>
                  </div>
                ))}
                {!cart.items.length && <div className="drop-empty">Cart is empty — place a purchase order to add it here.</div>}
              </div>
              {!!cart.items.length && (
                <button className="btn accent" style={{ margin: 8, width: 'calc(100% - 16px)' }} onClick={() => { setOpenMenu(null); navigate('/checkout'); }}>
                  Crosscheck &amp; Checkout →
                </button>
              )}
            </div>
          )}
        </div>

        <div className="tb-anchor">
          <button className="profile-btn" onClick={() => setOpenMenu(openMenu === 'profile' ? null : 'profile')}>
            <Avatar user={user} />
            <span className="profile-meta">
              <span className="user-name">{user.fullName}</span>
              <span className="user-roles">{(user.roles || []).join(', ')}</span>
            </span>
            <Icon name="chevronDown" size={14} />
          </button>
        {openMenu === 'profile' && (
          <div className="dropdown profile-drop">
            <div className="profile-card">
              <Avatar user={user} size={44} />
              <div>
                <strong>{user.fullName}</strong>
                <div className="muted">{user.email}</div>
                <div className="chip" style={{ marginTop: 4 }}>{(user.roles || []).join(', ')}</div>
              </div>
            </div>
            <button className="drop-item" onClick={() => { setOpenMenu(null); setShowProfile(true); }}>
              <Icon name="users" size={15} /> <span>My profile</span>
            </button>
            <label className="drop-item upload-photo">
              <Icon name="upload" size={15} /> <span>Change profile photo</span>
              <input type="file" accept="image/*" hidden onChange={async (e) => {
                const f = e.target.files[0];
                if (!f) return;
                try {
                  const { data } = await uploadFile('/users/me/photo', f, 'file');
                  updateUser({ profilePhotoUrl: data.data.profilePhotoUrl });
                  setOpenMenu(null);
                } catch (err) { alert(errMessage(err)); }
              }} />
            </label>
            <a className="drop-item" href="/landing"><Icon name="shield" size={15} /> <span>About POMS (landing page)</span></a>
            <button className="drop-item danger" onClick={logout}><Icon name="logout" size={15} /> <span>Sign out</span></button>
          </div>
        )}
        </div>
      </div>

      {toast && (
        <div className="toast" onClick={() => markOne(toast)}>
          <Icon name="bell" size={16} />
          <span><strong>{toast.title}</strong>{toast.body ? ` — ${toast.body}` : ''}</span>
        </div>
      )}

      {showProfile && <ProfileModal />}
    </header>
  );
}
