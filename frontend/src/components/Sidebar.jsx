import { NavLink } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useAuth } from '../auth.jsx';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/products', label: 'Products', icon: 'catalogue', permission: 'masters.view' },
  { to: '/brands', label: 'Brands', icon: 'masters', permission: 'masters.view' },
  { to: '/categories', label: 'Categories', icon: 'masters', permission: 'masters.view' },
  { to: '/product-types', label: 'Product Types', icon: 'masters', permission: 'masters.view' },
  { to: '/colors', label: 'Colors', icon: 'masters', permission: 'masters.view' },
  { to: '/sizes', label: 'Sizes', icon: 'masters', permission: 'masters.view' },
  { to: '/manufacturers', label: 'Manufacturers', icon: 'building', permission: 'masters.view' },
  { to: '/locations', label: 'Locations', icon: 'building', permission: 'masters.view' },
  { to: '/purchase-orders', label: 'Purchase Orders', icon: 'po' },
  { to: '/calendar', label: 'PO Calendar', icon: 'calendar' },
  { to: '/catalogue', label: 'Catalogue', icon: 'catalogue' },
  { to: '/chat', label: 'Team Chat', icon: 'chat' },
  { to: '/approvals', label: 'Approval Queue', icon: 'approvals', permission: 'approvals.view' },
  { to: '/receipts', label: 'Receiving', icon: 'receipts', permission: 'receipt.view' },
  { to: '/masters', label: 'Masters', icon: 'masters', permission: 'masters.view' },
  { to: '/pricing', label: 'Pricing', icon: 'reports', permission: 'masters.view' },
  { to: '/export-data', label: 'Export Data', icon: 'reports', permission: 'reports.view' },
  { to: '/videos', label: 'Videos', icon: 'video', permission: 'videos.view' },
  { to: '/reports', label: 'Reports', icon: 'reports', permission: 'reports.view' },
  { to: '/users', label: 'Users & Roles', icon: 'users', permission: 'users.manage' },
  { to: '/roles', label: 'Roles', icon: 'shield', permission: 'users.manage' },
  { to: '/settings', label: 'Settings', icon: 'settings', permission: 'settings.manage' },
  { to: '/audit-logs', label: 'Audit Trail', icon: 'audit', permission: 'audit.view' },
];

// Role-filtered navigation. Collapses to an icon rail (hamburger toggles, state
// persisted in localStorage); titles become tooltips while collapsed.
export default function Sidebar({ collapsed, onToggle }) {
  const { user } = useAuth();
  const items = NAV.filter((n) => !n.permission || user.isSuperAdmin || user.permissions?.includes(n.permission));

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="brand">
        <img src="/bsc-logo.png" alt="BSC" className="brand-mark-img" />
        {!collapsed && (
          <div>
            <div className="brand-name">BSC EXCLUSIVE</div>
            <div className="brand-sub">Procurement Desk</div>
          </div>
        )}
      </div>
      <div className="sidebar-scroll">
        <nav>
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} title={n.label}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              <Icon name={n.icon} size={18} />
              {!collapsed && <span>{n.label}</span>}
            </NavLink>
          ))}
        </nav>
        <button className="btn primary create-po" title="Create Master PO"
          onClick={() => (window.location.href = '/purchase-orders/new')}>
          <Icon name="plus" size={16} />
          {!collapsed && <span>Create Master PO</span>}
        </button>
        {!collapsed && <div className="sidebar-foot">POMS v2.0 · role-scoped</div>}
      </div>
    </aside>
  );
}
