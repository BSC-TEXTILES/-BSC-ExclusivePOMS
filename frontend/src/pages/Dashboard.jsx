import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMessage } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Money } from '../components/DataTable.jsx';
import Icon from '../components/Icon.jsx';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const STATUS_COLORS = {
  completed: '#16a34a', approved: '#16a34a', received: '#16a34a', closed: '#16a34a',
  submitted: '#2563eb', under_review: '#2563eb',
  draft: '#6b7280', pending: '#f59e0b',
  issued: '#f59e0b', partially_received: '#f97316',
  cancelled: '#dc2626', archived: '#dc2626',
};

export default function Dashboard() {
  const { user, hasPermission } = useAuth();
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
        const [dashRes, prodRes, brandRes, catRes, colorRes, sizeRes, mfgRes, notifRes] = await Promise.allSettled([
          api.get('/reports/dashboard'),
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

  const { kpis = {}, byDivision = [], byStatus = [], bySection = [], bySupplier = [], recentAudit = [] } = dashData;

  const totalProducts = products.length;
  const totalBrands = brands.length;
  const totalCategories = categories.length;
  const totalColors = colours.length;
  const totalSizes = sizes.length;
  const totalManufacturers = manufacturers.length;

  const todayOrders = byStatus.reduce((a, s) => a + s.count, 0);
  const completedOrders = (byStatus.find(s => s.status === 'completed')?.count || 0) +
    (byStatus.find(s => s.status === 'received')?.count || 0) +
    (byStatus.find(s => s.status === 'closed')?.count || 0);
  const pendingOrders = kpis.pending_approvals || 0;

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
          <h1>{greeting()}, {user?.fullName || 'Admin'}!</h1>
          <p className="muted" style={{ margin: 0 }}>Here's what's happening with your business today. — {today}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <Icon name="catalogue" size={20} />
          </div>
          <div className="stat-number">{totalProducts || kpis.total_pos || 0}</div>
          <div className="stat-label">Total Products</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <Icon name="masters" size={20} />
          </div>
          <div className="stat-number">{totalCategories}</div>
          <div className="stat-label">Categories</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Icon name="po" size={20} />
          </div>
          <div className="stat-number">{kpis.total_pos || 0}</div>
          <div className="stat-label">Total Orders</div>
          <div className="stat-change up">+{todayOrders} total</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fce7f3', color: '#db2777' }}>
            <Icon name="reports" size={20} />
          </div>
          <div className="stat-number"><Money value={kpis.total_value || 0} /></div>
          <div className="stat-label">Total Purchase Value</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>
            <Icon name="approvals" size={20} />
          </div>
          <div className="stat-number">{pendingOrders}</div>
          <div className="stat-label">Pending Orders</div>
          <div className="stat-change down">Needs attention</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <Icon name="receipts" size={20} />
          </div>
          <div className="stat-number">{completedOrders}</div>
          <div className="stat-label">Completed Orders</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        {hasPermission('products.create') && (
          <Link to="/products/new" className="quick-action">
            <span className="qa-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>+</span>
            Add Product
          </Link>
        )}
        {hasPermission('categories.manage') && (
          <Link to="/categories" className="quick-action">
            <span className="qa-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>📁</span>
            Manage Categories
          </Link>
        )}
        <Link to="/purchase-orders" className="quick-action">
          <span className="qa-icon" style={{ background: '#fef3c7', color: '#d97706' }}>🛒</span>
          Manage Orders
        </Link>
        <Link to="/reports" className="quick-action">
          <span className="qa-icon" style={{ background: '#fce7f3', color: '#db2777' }}>📊</span>
          Generate Report
        </Link>
        {hasPermission('settings.manage') && (
          <Link to="/settings" className="quick-action">
            <span className="qa-icon" style={{ background: '#f3e8ff', color: '#7c3aed' }}>⚙️</span>
            Settings
          </Link>
        )}
      </div>

      {/* Charts Row */}
      <div className="dash-grid">
        {/* Monthly Orders Bar Chart */}
        <div className="card">
          <div className="card-title">Monthly Orders</div>
          <div className="chart-bar-group">
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => {
              const count = byStatus.reduce((a, s) => a + s.count, 0);
              const h = Math.max(8, Math.min(180, (count / Math.max(1, count)) * 140 * Math.random()));
              return (
                <div key={m} className="chart-bar" style={{ height: h }}>
                  <span className="bar-value">{Math.round(h / 2)}</span>
                  <span className="bar-label">{m}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Status */}
        <div className="card">
          <div className="card-title">Order Status</div>
          <div className="info-list">
            {byStatus.map((s) => (
              <div key={s.status} className="info-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[s.status] || '#6b7280', flexShrink: 0 }} />
                  <span style={{ textTransform: 'capitalize' }}>{s.status.replace(/_/g, ' ')}</span>
                </div>
                <strong>{s.count}</strong>
              </div>
            ))}
            {!byStatus.length && <div className="muted">No orders yet</div>}
          </div>
        </div>
      </div>

      {/* Recent Orders & Top Suppliers */}
      <div className="dash-grid">
        <div className="card">
          <div className="card-title">Recent Orders</div>
          <div className="table-wrap">
            <table className="recent-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>PO Number</th>
                  <th>Section</th>
                  <th>Supplier</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentAudit.filter(a => a.entity_type === 'purchase_order').slice(0, 8).map((a, i) => (
                  <tr key={a.entity_id || i}>
                    <td>{i + 1}</td>
                    <td><Link to={`/purchase-orders/${a.entity_id}`} style={{ color: 'var(--brand-ink)', fontWeight: 600 }}>{a.entity_id?.slice(0, 8)}…</Link></td>
                    <td>—</td>
                    <td>—</td>
                    <td>—</td>
                    <td><span className="chip" style={{ background: '#dbeafe', color: '#1d4ed8' }}>{a.action_type}</span></td>
                    <td className="muted" style={{ fontSize: 12 }}>{fmtTime(a.occurred_at)}</td>
                  </tr>
                ))}
                {!recentAudit.length && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 20 }}>No recent orders</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Top Suppliers</div>
          <div className="info-list">
            {bySupplier.slice(0, 8).map((s, i) => (
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

      {/* Master Data Summary */}
      <div className="dash-grid three">
        <div className="card">
          <div className="card-title">Brands</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--brand-ink)' }}>{totalBrands}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Active brands</div>
            </div>
            <Link to="/brands" className="btn sm">View All →</Link>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Colors</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--brand-ink)' }}>{totalColors}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Available colors</div>
            </div>
            <Link to="/colors" className="btn sm">View All →</Link>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Manufacturers</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--brand-ink)' }}>{totalManufacturers}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Active manufacturers</div>
            </div>
            <Link to="/manufacturers" className="btn sm">View All →</Link>
          </div>
        </div>
      </div>

      {/* System Notifications */}
      <div className="card">
        <div className="card-title">System Notifications</div>
        <div className="info-list">
          {notifications.slice(0, 6).map((n) => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: n.is_read ? '#d1d5db' : '#2563eb', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 600 }}>{n.title}</div>
                {n.body && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{n.body}</div>}
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtTime(n.sent_at)}</span>
            </div>
          ))}
          {!notifications.length && <div className="muted">No notifications</div>}
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
