import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMessage } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Money } from '../components/DataTable.jsx';
import Icon from '../components/Icon.jsx';

function fmtTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Compact INR for chart labels: ₹2.65L / ₹1.2Cr / ₹45,200
function inrCompact(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
  if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
  return `₹${Math.round(v).toLocaleString('en-IN')}`;
}

const STATUS_COLORS = {
  completed: '#16a34a', approved: '#16a34a', received: '#16a34a', closed: '#16a34a',
  submitted: '#2563eb', under_review: '#2563eb',
  draft: '#6b7280', pending: '#f59e0b',
  issued: '#f59e0b', partially_received: '#f97316',
  cancelled: '#dc2626', archived: '#dc2626',
};

const ROUTE_NAMES = [
  [/^\/purchase-orders\/new/, 'Create Purchase Order'],
  [/^\/purchase-orders\/.+/, 'Purchase Order Details'],
  [/^\/purchase-orders/, 'Purchase Orders'],
  [/^\/products\/new/, 'New Product'],
  [/^\/products\/.+\/edit/, 'Edit Product'],
  [/^\/products\/.+/, 'Product Details'],
  [/^\/products/, 'Products'],
  [/^\/categories/, 'Categories'],
  [/^\/product-types/, 'Product Types'],
  [/^\/brands/, 'Brands'],
  [/^\/colors/, 'Colors'],
  [/^\/sizes/, 'Sizes'],
  [/^\/manufacturers/, 'Manufacturers'],
  [/^\/locations/, 'Locations'],
  [/^\/masters/, 'Masters'],
  [/^\/users/, 'Users & Roles'],
  [/^\/roles/, 'Roles & Permissions'],
  [/^\/reports/, 'Reports'],
  [/^\/export-data/, 'Export Data'],
  [/^\/approvals/, 'Approval Queue'],
  [/^\/receipts/, 'Receiving'],
  [/^\/calendar/, 'PO Calendar'],
  [/^\/catalogue/, 'Catalogue'],
  [/^\/chat/, 'Team Chat'],
  [/^\/videos/, 'Videos'],
  [/^\/settings/, 'Settings'],
  [/^\/pricing/, 'Pricing'],
  [/^\/attachments/, 'Attachments'],
  [/^\/collections/, 'Collections'],
  [/^\/dealers/, 'Dealers'],
  [/^\/company/, 'Company Settings'],
  [/^\/dashboard/, 'Dashboard'],
];

function routeLabel(path = '') {
  for (const [re, name] of ROUTE_NAMES) if (re.test(path)) return name;
  return path || '—';
}

/* ---------- charts (custom SVG/CSS — real data only) ---------- */

// Horizontal bar chart: months run left → right in rows, bar grows rightwards.
function MonthlyHBar({ data }) {
  const rows = data || [];
  const max = Math.max(1, ...rows.map((d) => d.orders));
  return (
    <div className="hbar-chart">
      {rows.map((m) => (
        <div key={m.key} className="hbar-row" title={`${m.label}: ${m.orders} orders · ${inrCompact(m.value)}`}>
          <span className="hbar-label">{m.label}</span>
          <span className="hbar-track">
            <span className="hbar-fill" style={{ width: `${(m.orders / max) * 100}%` }} />
          </span>
          <span className="hbar-value">{m.orders}</span>
        </div>
      ))}
      {!rows.length && <div className="muted">No order data yet</div>}
    </div>
  );
}

// Vertical bar chart for division-wise counts.
function DivisionVBar({ data }) {
  const rows = data || [];
  const max = Math.max(1, ...rows.map((d) => d.pos));
  const palette = ['#17324d', '#b98a2f', '#2563eb', '#16a34a', '#db2777', '#7c3aed'];
  return (
    <div className="vbar-chart">
      {rows.map((d, i) => (
        <div key={d.code || d.name} className="vbar-col" title={`${d.name}: ${d.pos} orders · ${inrCompact(d.value)}`}>
          <span className="vbar-value">{d.pos}</span>
          <span className="vbar-track">
            <span className="vbar-fill" style={{ height: `${Math.max(4, (d.pos / max) * 100)}%`, background: palette[i % palette.length] }} />
          </span>
          <span className="vbar-label">{d.code || d.name}</span>
        </div>
      ))}
      {!rows.length && <div className="muted">No order data yet</div>}
    </div>
  );
}

// Horizontal share bars — collection-wise share of total order value.
function CollectionShareBars({ data }) {
  const rows = data || [];
  const total = rows.reduce((a, r) => a + Number(r.value || 0), 0);
  const max = Math.max(1, ...rows.map((r) => Number(r.value || 0)));
  return (
    <div className="hbar-chart">
      {rows.map((r) => {
        const pct = total > 0 ? ((Number(r.value) / total) * 100) : 0;
        return (
          <div key={r.section} className="hbar-row" title={`${r.section}: ${r.pos} orders · ${inrCompact(r.value)}`}>
            <span className="hbar-label wide">{r.section}</span>
            <span className="hbar-track">
              <span className="hbar-fill gold" style={{ width: `${Math.max(2, (Number(r.value) / max) * 100)}%` }} />
            </span>
            <span className="hbar-value">{pct.toFixed(0)}%</span>
          </div>
        );
      })}
      {!rows.length && <div className="muted">No order data yet</div>}
    </div>
  );
}

// Work-done progress ring (SVG, real completed/total ratio).
function ProgressRing({ pct, size = 132 }) {
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const done = Math.max(0, Math.min(100, pct));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="progress-ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth="12" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#16a34a" strokeWidth="12"
        strokeLinecap="round" strokeDasharray={`${(done / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray .8s ease' }}
      />
      <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" className="ring-num">{done.toFixed(0)}%</text>
      <text x="50%" y="62%" textAnchor="middle" dominantBaseline="middle" className="ring-sub">work done</text>
    </svg>
  );
}

// Live team monitor — polls the tracking feed every 15s (admin / audit.view).
function LivePanel() {
  const [live, setLive] = useState(null);
  const [expanded, setExpanded] = useState(true);
  useEffect(() => {
    const load = () => api.get('/tracking/live').then((r) => setLive(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);
  if (!live) return <div className="card"><div className="card-title">Team Activity — Live</div><div className="muted">Connecting…</div></div>;

  const { online = [], counts = {}, recent = [] } = live;
  return (
    <div className="card">
      <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Team Activity — Live</span>
        <span className="live-dot" title="Refreshes every 15 seconds" />
      </div>
      <div className="live-counts">
        <span className="chip live-chip">● {counts.online ?? online.length} online now</span>
        <span className="chip">{counts.logins_today ?? 0} logins today</span>
        <span className="chip">{counts.logouts_today ?? 0} signed out</span>
        {!!counts.devtools_alerts_24h && <span className="chip" style={{ background: '#fef2f2', color: '#b91c1c' }}>⛔ {counts.devtools_alerts_24h} DevTools alerts (24h)</span>}
      </div>
      <button className="btn sm" style={{ margin: '8px 0' }} onClick={() => setExpanded(!expanded)}>{expanded ? 'Hide members' : 'Show members'}</button>
      {expanded && (
        <div className="live-list">
          {online.map((s) => (
            <div key={s.id} className="live-row">
              <span className="live-pulse" />
              <div className="live-main">
                <strong>{s.full_name}</strong>
                <span className="muted">{s.roles || '—'} · {s.browser} on {s.os} ({s.device_type})</span>
                <span className="muted mono" style={{ fontSize: 11 }}>
                  IP {s.ip_address || '—'}
                  {s.latitude != null && ` · 📍 ${Number(s.latitude).toFixed(4)}, ${Number(s.longitude).toFixed(4)}`}
                  {s.devtools_seen && ' · ⛔ DevTools seen'}
                </span>
              </div>
              <div className="live-right">
                <span className="chip">{routeLabel(s.current_route)}</span>
                <span className="muted" style={{ fontSize: 11 }}>since {fmtTime(s.login_at)}</span>
              </div>
            </div>
          ))}
          {!online.length && <div className="muted">No members online right now</div>}
        </div>
      )}
      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table className="recent-table">
          <thead><tr><th>Member</th><th>Login</th><th>Logout</th><th>IP</th><th>Device</th><th>Reason</th></tr></thead>
          <tbody>
            {recent.slice(0, 8).map((s) => (
              <tr key={s.id}>
                <td><strong>{s.full_name}</strong></td>
                <td className="muted">{fmtTime(s.login_at)}</td>
                <td className="muted">{s.logout_at ? fmtTime(s.logout_at) : <span className="chip live-chip">online</span>}</td>
                <td className="mono">{s.ip_address || '—'}</td>
                <td className="muted">{s.browser} · {s.device_type}</td>
                <td>{s.devtools_seen ? <span className="chip" style={{ background: '#fef2f2', color: '#b91c1c' }}>DevTools</span> : (s.ended_reason || '—')}</td>
              </tr>
            ))}
            {!recent.length && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 14 }}>No sessions recorded yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Brand logo strip — real uploaded logos in fixed, aligned tiles; a clean
// monogram tile when a brand has no logo (never a fake generated image).
function BrandStrip({ brands }) {
  const list = (brands || []).slice(0, 24);
  if (!list.length) return null;
  return (
    <div className="card">
      <div className="card-title">Brand Line-up</div>
      <div className="brand-grid">
        {list.map((b) => (
          <div key={b.id} className="brand-tile" title={`${b.brand_name}${b.brand_code ? ` · ${b.brand_code}` : ''}`}>
            {b.logo_url
              ? <img src={b.logo_url} alt={b.brand_name} className="brand-logo-img" />
              : <span className="brand-monogram">{(b.brand_name || '?').slice(0, 2).toUpperCase()}</span>}
            <span className="brand-tile-name">{b.brand_name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Restricted Division Supervisor dashboard — Men's section purchase details
// ONLY: net purchase margin, total quantity purchased, discount and the
// individual selling price of each item. Everything else is hidden (RB-018).
function SupervisorDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/reports/men-summary')
      .then((r) => setData(r.data))
      .catch((e) => setError(errMessage(e)));
  }, []);
  const t = data?.totals;
  const fmt = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Men's Section — Purchase Summary</h1>
          <p className="page-sub">Restricted view (Division Supervisor) — only your section's purchase details are visible.</p>
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-label">Total Quantity Purchased</div><div className="stat-value">{t ? Number(t.total_quantity).toLocaleString('en-IN') : '…'}</div></div>
        <div className="stat-card"><div className="stat-label">Net Purchase Margin</div><div className="stat-value">{t ? fmt(t.net_purchase_margin) : '…'}</div></div>
        <div className="stat-card"><div className="stat-label">Discount</div><div className="stat-value">{t ? fmt(t.total_discount) : '…'}</div></div>
        <div className="stat-card"><div className="stat-label">Purchase Value</div><div className="stat-value">{t ? fmt(t.purchase_value) : '…'}</div></div>
      </div>
      <div className="panel mt">
        <h3>Individual Selling Price</h3>
        <table className="grid">
          <thead><tr><th>Product</th><th>Brand</th><th>Colour</th><th className="num">Qty</th><th className="num">Purchase price</th><th className="num">Margin %</th><th className="num">Net/unit</th><th className="num">Discount</th><th className="num">Selling price</th></tr></thead>
          <tbody>
            {(data?.sellingPrices || []).map((s, i) => (
              <tr key={i}>
                <td>{s.product_name}<div className="mono muted">{s.sku}</div></td>
                <td>{s.brand_name}</td>
                <td>{s.colour_name || '—'}</td>
                <td className="num">{s.total_quantity}</td>
                <td className="num">{fmt(s.purchase_price)}</td>
                <td className="num">{s.margin_percent}%</td>
                <td className="num">{fmt(s.net_value_per_unit)}</td>
                <td className="num">{Number(s.discount_amount) ? fmt(s.discount_amount) : '—'}</td>
                <td className="num"><strong>{fmt(s.final_value_per_unit)}</strong></td>
              </tr>
            ))}
            {!data?.sellingPrices?.length && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>No purchase details in your section yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, hasRole } = useAuth();
  // Division Supervisors get the restricted Men's-section summary only.
  if (hasRole?.('division_supervisor') && !user.isSuperAdmin) return <SupervisorDashboard />;
  return <MainDashboard />;
}

function MainDashboard() {
  const { user, hasPermission, selectedSectionId, clearSection } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashData, setDashData] = useState(null);
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [colours, setColours] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const params = selectedSectionId ? { params: { sectionId: selectedSectionId } } : {};
        const [dashRes, prodRes, brandRes, catRes, colorRes, sizeRes, mfgRes, notifRes] = await Promise.allSettled([
          api.get('/reports/dashboard', params),
          api.get('/products?limit=5&sort=created_at&order=desc'),
          api.get('/brands'),
          api.get('/categories'),
          api.get('/colours'),
          api.get('/sizes'),
          api.get('/manufacturers?limit=100'),
          api.get('/notifications'),
        ]);

        if (dashRes.status === 'fulfilled') setDashData(dashRes.value.data);
        if (prodRes.status === 'fulfilled') setProducts(prodRes.value.data?.data || []);
        if (brandRes.status === 'fulfilled') setBrands(brandRes.value.data?.data || []);
        if (catRes.status === 'fulfilled') setCategories(catRes.value.data?.data || []);
        if (colorRes.status === 'fulfilled') setColours(colorRes.value.data?.data || []);
        if (sizeRes.status === 'fulfilled') setSizes(sizeRes.value.data?.data || []);
        if (mfgRes.status === 'fulfilled') setManufacturers(mfgRes.value.data?.data || []);
        if (notifRes.status === 'fulfilled') setNotifications(notifRes.value.data?.data || []);
      } catch (e) {
        setError(errMessage(e));
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  if (loading) return <div className="loading"><div className="loading-spinner" /></div>;
  if (error) return <div className="alert error">{error}</div>;
  if (!dashData) return <div className="muted">No data available</div>;

  const {
    kpis = {}, byDivision = [], byStatus = [], bySection = [], bySupplier = [], recentAudit = [],
    monthly = [], recentPOs = [], workProgress = {}, mySections = [],
  } = dashData;

  const totalBrands = brands.length;
  const totalColors = colours.length;
  const totalSizes = sizes.length;
  const totalManufacturers = manufacturers.length;

  const completedOrders = workProgress.completed ?? 0;
  const workPct = workProgress.total ? (completedOrders / workProgress.total) * 100 : 0;
  const canMonitor = user.isSuperAdmin || hasPermission('audit.view');

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-sub">Plan, prioritize, and accomplish your tasks with ease.</p>
          {!user.isSuperAdmin && !!mySections.length && (
            <div className="row" style={{ marginTop: 4, gap: 6, alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: 12 }}>Your collections:</span>
              {mySections.map((s) => <span key={s.id} className="chip section-chip">{s.name}</span>)}
            </div>
          )}
          {selectedSectionId && (
            <div className="row" style={{ marginTop: 8, gap: 8, alignItems: 'center' }}>
              <span className="chip" style={{ background: '#dbeafe', color: '#1e40af' }}>
                Filtered by selected section
              </span>
              <button className="btn ghost sm" onClick={clearSection} title="Clear section filter">
                <Icon name="x" size={14} /> Clear
              </button>
            </div>
          )}
        </div>
        <div className="page-actions">
          {hasPermission('products.create') && (
            <Link to="/products/new" className="btn primary">
              <Icon name="plus" size={15} /> Add Product
            </Link>
          )}
          <Link to="/import-data" className="btn">
            Import Data
          </Link>
        </div>
      </div>

      {/* KPI Cards — Image 2 style: first card green, rest white, icon top-right */}
      <div className="kpis">
        <div className="stat-card kpi-hero">
          <div className="kpi-icon-wrap">
            <Icon name="catalogue" size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-title">Total Orders</div>
            <div className="kpi-value">{kpis.total_pos || 0}</div>
            <div className="kpi-status">
              <span className="kpi-status-dot up" />
              Purchase orders raised across your collections
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="kpi-icon-wrap muted-icon">
            <Icon name="reports" size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-title">Total Purchase Value</div>
            <div className="kpi-value"><Money value={kpis.total_value || 0} /></div>
            <div className="kpi-status">
              <span className="kpi-status-dot up" />
              Order value including taxes and freight
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="kpi-icon-wrap muted-icon">
            <Icon name="po" size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-title">Pending Approvals</div>
            <div className="kpi-value">{kpis.pending_approvals || 0}</div>
            <div className="kpi-status">
              <span className={`kpi-status-dot ${kpis.pending_approvals ? 'warn' : 'up'}`} />
              {kpis.pending_approvals ? 'Needs your attention' : 'All clear — nothing waiting'}
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="kpi-icon-wrap muted-icon">
            <Icon name="receipts" size={20} />
          </div>
          <div className="kpi-body">
            <div className="kpi-title">Completed Orders</div>
            <div className="kpi-value">{completedOrders}</div>
            <div className="kpi-status">
              <span className="kpi-status-dot up" />
              Fully received and closed orders
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions — permission-aware shortcut tiles */}
      <div className="quick-actions-panel">
        <div className="qap-header">
          <h2 className="qap-title">Quick Actions</h2>
          <span className="qap-sub">Frequent tasks, one click away</span>
        </div>
        <div className="qa-grid">
          {hasPermission('products.create') && (
            <Link to="/products/new" className="qa-tile">
              <span className="qa-tile-icon blue"><Icon name="plus" size={17} /></span>
              <span className="qa-tile-body">
                <span className="qa-tile-title">Add Product</span>
                <span className="qa-tile-desc">Create a new SKU in any collection</span>
              </span>
              <Icon name="arrowRight" size={14} className="qa-tile-arrow" />
            </Link>
          )}
          {hasPermission('categories.manage') && (
            <Link to="/categories" className="qa-tile">
              <span className="qa-tile-icon green"><Icon name="masters" size={17} /></span>
              <span className="qa-tile-body">
                <span className="qa-tile-title">Manage Categories</span>
                <span className="qa-tile-desc">Organise the product catalogue</span>
              </span>
              <Icon name="arrowRight" size={14} className="qa-tile-arrow" />
            </Link>
          )}
          <Link to="/purchase-orders" className="qa-tile">
            <span className="qa-tile-icon amber"><Icon name="po" size={17} /></span>
            <span className="qa-tile-body">
              <span className="qa-tile-title">Purchase Orders</span>
              <span className="qa-tile-desc">Track, draft and issue orders</span>
            </span>
            <Icon name="arrowRight" size={14} className="qa-tile-arrow" />
          </Link>
          {(user.isSuperAdmin || hasPermission('reports.view')) && (
            <Link to="/reports" className="qa-tile">
              <span className="qa-tile-icon violet"><Icon name="reports" size={17} /></span>
              <span className="qa-tile-body">
                <span className="qa-tile-title">Reports</span>
                <span className="qa-tile-desc">Export data as CSV or PDF</span>
              </span>
              <Icon name="arrowRight" size={14} className="qa-tile-arrow" />
            </Link>
          )}
          {hasPermission('settings.manage') && (
            <Link to="/settings" className="qa-tile">
              <span className="qa-tile-icon slate"><Icon name="settings" size={17} /></span>
              <span className="qa-tile-body">
                <span className="qa-tile-title">Settings</span>
                <span className="qa-tile-desc">System preferences and access</span>
              </span>
              <Icon name="arrowRight" size={14} className="qa-tile-arrow" />
            </Link>
          )}
        </div>
      </div>

      {/* Main content grid: 3-column layout matching Image 2 */}
      <div className="dash-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 18 }}>
        {/* Analytics Chart — Monthly Orders */}
        <div className="card">
          <div className="card-title">Monthly Orders — Last 12 Months</div>
          <MonthlyHBar data={monthly} />
        </div>

        {/* Reminders / Notifications */}
        <div className="card">
          <div className="card-title">Notifications</div>
          <div className="info-list">
            {notifications.slice(0, 5).map((n) => (
              <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: n.is_read ? '#d1d5db' : '#2563eb', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 600 }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{n.body}</div>}
                </div>
              </div>
            ))}
            {!notifications.length && <div className="muted">No notifications</div>}
          </div>
        </div>

        {/* Project / Order List */}
        <div className="card">
          <div className="card-title">Recent Orders</div>
          <div className="info-list">
            {recentPOs.slice(0, 5).map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'inline-grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}><Link to={`/purchase-orders/${p.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{p.po_number}</Link></div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.section_name} · {p.supplier_name}</div>
                </div>
                <strong style={{ fontSize: 13 }}><Money value={p.grand_total} /></strong>
              </div>
            ))}
            {!recentPOs.length && <div className="muted">No recent orders</div>}
          </div>
        </div>
      </div>

      {/* 2-column section: Team Activity + Work Progress */}
      <div className="dash-grid two" style={{ marginBottom: 18 }}>
        {/* Team Activity */}
        <div className="card">
          <div className="card-title">Division-wise Orders</div>
          <DivisionVBar data={byDivision} />
        </div>

        {/* Work Progress Ring */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="card-title" style={{ alignSelf: 'flex-start' }}>Work Progress</div>
          <ProgressRing pct={workPct} />
          <div className="funnel">
            <div className="funnel-row"><span>Drafts</span><strong>{workProgress.drafts ?? 0}</strong></div>
            <div className="funnel-row"><span>In approval</span><strong>{workProgress.in_approval ?? 0}</strong></div>
            <div className="funnel-row"><span>Approved / issued</span><strong>{workProgress.approved_issued ?? 0}</strong></div>
            <div className="funnel-row"><span>Partially received</span><strong>{workProgress.partially_received ?? 0}</strong></div>
            <div className="funnel-row done"><span>Completed</span><strong>{completedOrders}</strong></div>
          </div>
        </div>
      </div>

      {/* Collection Share + Top Suppliers */}
      <div className="dash-grid two">
        <div className="card">
          <div className="card-title">Collection-wise Share of Order Value</div>
          <CollectionShareBars data={bySection} />
        </div>
        <div className="card">
          <div className="card-title">Top Suppliers</div>
          <div className="info-list">
            {bySupplier.slice(0, 6).map((s, i) => (
              <div key={s.company_name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand-ink)', color: '#fff', display: 'inline-grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{s.company_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.pos} orders</div>
                </div>
                <strong style={{ fontSize: 13 }}><Money value={s.value} /></strong>
              </div>
            ))}
            {!bySupplier.length && <div className="muted">No supplier data yet</div>}
          </div>
        </div>
      </div>

      {/* Live team monitor (admin only) */}
      {canMonitor && <LivePanel />}

      {/* Brand line-up — real uploaded logos, aligned tiles */}
      <BrandStrip brands={brands} />

      {/* Master Data Summary */}
      <div className="dash-grid three">
        <div className="card">
          <div className="card-title">Brands</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--ink)' }}>{totalBrands}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Active brands</div>
            </div>
            <Link to="/brands" className="btn sm">View All →</Link>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Colors</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--ink)' }}>{totalColors}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Available colors</div>
            </div>
            <Link to="/colors" className="btn sm">View All →</Link>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Manufacturers</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--ink)' }}>{totalManufacturers}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Active manufacturers</div>
            </div>
            <Link to="/manufacturers" className="btn sm">View All →</Link>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="card-title">Recent Activity</div>
        <ul className="timeline">
          {recentAudit.slice(0, 8).map((a, i) => (
            <li key={i}>
              <div className="t-time">{fmtTime(a.occurred_at)}</div>
              <strong>{a.action_type}</strong> on {a.entity_type.replace(/_/g, ' ')} — {a.actor}
              {a.entity_type === 'purchase_order' && <Link className="right" to={`/purchase-orders/${a.entity_id}`}>view</Link>}
            </li>
          ))}
          {!recentAudit.length && <li className="muted">No activity yet.</li>}
        </ul>
      </div>
    </div>
  );
}
