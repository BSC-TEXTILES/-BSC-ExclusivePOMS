import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useAuth } from '../auth.jsx';
import api from '../api.js';

const SECTIONS = [
  {
    label: null,
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: 'dashboard', end: true },
    ],
  },
  {
    label: 'Collections',
    items: [
      { to: '/catalogue', label: 'Catalogue', icon: 'catalogue' },
    ],
  },
  {
    label: 'Master Data',
    items: [
      { to: '/products', label: 'Products', icon: 'catalogue', permission: 'masters.view' },
      { to: '/brands', label: 'Brands', icon: 'masters', permission: 'masters.view' },
      { to: '/categories', label: 'Categories', icon: 'masters', permission: 'masters.view' },
      { to: '/product-types', label: 'Product Types', icon: 'masters', permission: 'masters.view' },
      { to: '/colors', label: 'Colors', icon: 'masters', permission: 'masters.view' },
      { to: '/sizes', label: 'Sizes', icon: 'masters', permission: 'masters.view' },
      { to: '/manufacturers', label: 'Manufacturers', icon: 'building', permission: 'masters.view' },
      { to: '/locations', label: 'Locations', icon: 'building', permission: 'masters.view' },
    ],
  },
  {
    label: 'Orders',
    items: [
      { to: '/purchase-orders', label: 'Purchase Orders', icon: 'po' },
      { to: '/calendar', label: 'PO Calendar', icon: 'calendar' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/chat', label: 'Team Chat', icon: 'chat' },
      { to: '/approvals', label: 'Approval Queue', icon: 'approvals', permission: 'approvals.view' },
      { to: '/receipts', label: 'Receiving', icon: 'receipts', permission: 'receipt.view' },
      { to: '/masters', label: 'Masters', icon: 'masters', permission: 'masters.view' },
      { to: '/pricing', label: 'Pricing', icon: 'reports', permission: 'masters.view' },
      { to: '/export-data', label: 'Export Data', icon: 'reports', permission: 'reports.view' },
    ],
  },
  {
    label: 'Media',
    items: [
      { to: '/videos', label: 'Videos', icon: 'video', permission: 'videos.view' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { to: '/reports', label: 'Reports', icon: 'reports', permission: 'reports.view' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/users', label: 'Users & Roles', icon: 'users', permission: 'users.manage' },
      { to: '/roles', label: 'Roles', icon: 'shield', permission: 'users.manage', superAdminOnly: true },
      { to: '/settings', label: 'Settings', icon: 'settings', permission: 'settings.manage' },
      { to: '/audit-logs', label: 'Audit Trail', icon: 'audit', permission: 'audit.view' },
      { to: '/collections', label: 'Collections', icon: 'masters', permission: 'collections.view' },
      { to: '/dealers', label: 'Dealers', icon: 'building', permission: 'dealers.view' },
      { to: '/company', label: 'Company Settings', icon: 'settings', permission: 'company.view' },
      { to: '/attachments', label: 'Attachments', icon: 'catalogue', permission: 'masters.view' },
    ],
  },
];

const DEPARTMENT_GROUPS = [
  {
    key: 'men',
    title: "Men's Collection",
    icon: '👔',
    sections: [
      { code: 'MEN-SHIRTS', name: "Men's Shirts", icon: '👕' },
      { code: 'MEN-TROUSERS', name: "Men's Trousers & Jeans", icon: '👖' },
      { code: 'MEN-TSHIRTS', name: "Men's T-Shirts", icon: '👕' },
      { code: 'MEN-ETHNIC', name: "Men's Ethnic Wear", icon: '👳' },
      { code: 'MEN-INNERWEAR', name: "Men's Innerwear", icon: '🩲' },
      { code: 'FOOTWEAR-M', name: "Footwear — Men", icon: '👞' },
    ],
  },
  {
    key: 'women',
    title: "Women's Collection",
    icon: '👗',
    sections: [
      { code: 'WOM-SAREES', name: "Women's Sarees", icon: '🥻' },
      { code: 'WOM-KURTIS', name: "Women's Kurtis & Salwar", icon: '👗' },
      { code: 'WOM-WESTERN', name: "Women's Western Wear", icon: '👚' },
      { code: 'WOM-BLOUSE', name: "Ethnic / Blouse Fabric", icon: '🧵' },
      { code: 'WOM-INNERWEAR', name: "Women's Innerwear", icon: '👙' },
      { code: 'JWL-FASHION', name: "Jewellery — Artificial", icon: '💍' },
      { code: 'JWL-BANGLES', name: "Jewellery — Bangles", icon: '📿' },
      { code: 'FOOTWEAR-W', name: "Footwear — Women", icon: '👠' },
      { code: 'ACCESSORIES', name: "Accessories & Bags", icon: '👜' },
    ],
  },
  {
    key: 'kids',
    title: "Kids Collection",
    icon: '🧸',
    sections: [
      { code: 'KIDS-BOYS', name: "Kids Boys Wear", icon: '👦' },
      { code: 'KIDS-GIRLS', name: "Kids Girls Wear", icon: '👧' },
      { code: 'KIDS-INFANT', name: "Kids Infant Wear", icon: '👶' },
      { code: 'KIDS-TOYS', name: "Toys & Games", icon: '🎮' },
    ],
  },
  {
    key: 'home',
    title: "Home & Furnishing",
    icon: '🛋️',
    sections: [
      { code: 'HOME-FURN', name: "Home Furnishing & Decor", icon: '🛏️' },
      { code: 'FURNITURE', name: "Furniture & Interiors", icon: '🪑' },
    ],
  },
];

function canSee(item, user) {
  if (item.permission && !user.isSuperAdmin && !user.permissions?.includes(item.permission)) return false;
  if (item.superAdminOnly && !user.isSuperAdmin) return false;
  return true;
}

function DepartmentNavGroup({ group, collapsed, open, onToggle }) {
  return (
    <div className="nav-collection">
      <button
        type="button"
        className={`nav-link nav-coll-btn ${open ? 'open' : ''}`}
        onClick={onToggle}
      >
        <span className="nav-dept-icon">{group.icon}</span>
        {!collapsed && (
          <>
            <span className="nav-coll-name">{group.title}</span>
            <span className="nav-dept-count">{group.sections.length}</span>
            <span className={`nav-chevron ${open ? 'down' : ''}`}>›</span>
          </>
        )}
      </button>

      {open && !collapsed && (
        <div className="nav-subtree">
          <NavLink
            to={`/collection/${group.key}`}
            end
            className={({ isActive }) => (isActive ? 'nav-sublink active highlight-po' : 'nav-sublink highlight-po')}
            style={{ fontWeight: 700 }}
          >
            <span className="nav-subdot gold" />
            <span>📋 All {group.title} & PO Studio</span>
          </NavLink>

          {group.sections.map((sec) => (
            <NavLink
              key={sec.code}
              to={`/collection/${group.key}?sectionCode=${sec.code}`}
              className={({ isActive }) => (isActive ? 'nav-sublink active' : 'nav-sublink')}
              title={sec.name}
            >
              <span className="nav-sub-icon">{sec.icon}</span>
              <span className="nav-sub-text">{sec.name}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ collapsed, onToggle }) {
  const { user } = useAuth();
  const canBrowse = user.isSuperAdmin || user.permissions?.includes('masters.view');
  const [openGroup, setOpenGroup] = useState('men');

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
          {SECTIONS.map((section, si) => {
            const visible = section.items.filter((n) => canSee(n, user));
            if (!visible.length) return null;
            return (
              <div key={si} className="nav-section">
                {!collapsed && section.label && <div className="nav-section-label">{section.label}</div>}
                {visible.map((n) => (
                  <NavLink key={n.to} to={n.to} end={n.end} title={n.label}
                    className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                    <Icon name={n.icon} size={18} />
                    {!collapsed && <span>{n.label}</span>}
                  </NavLink>
                ))}

                {/* Categorized Department Bars (Men, Women, Kids, Home) */}
                {section.label === 'Collections' && canBrowse && !collapsed && (
                  <div className="nav-collections">
                    {DEPARTMENT_GROUPS.map((g) => (
                      <DepartmentNavGroup
                        key={g.key}
                        group={g}
                        collapsed={collapsed}
                        open={openGroup === g.key}
                        onToggle={() => setOpenGroup(openGroup === g.key ? null : g.key)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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
