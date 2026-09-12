import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import CollectionIcon from './CollectionIcon.jsx';
import { useAuth } from '../auth.jsx';
import api from '../api.js';

const SECTIONS = [
  {
    label: null,
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: 'dashboard', end: true, permission: 'dashboard.view' },
    ],
  },
  {
    label: 'Collections',
    items: [
      { to: '/catalogue', label: 'Catalogue', icon: 'catalogue', permission: 'catalogue.view' },
    ],
  },
  {
    label: 'Master Data',
    items: [
      { to: '/products', label: 'Products', icon: 'catalogue', permission: 'products.view' },
      { to: '/brands', label: 'Brands', icon: 'masters', permission: 'brands.view' },
      { to: '/categories', label: 'Categories', icon: 'masters', permission: 'categories.view' },
      { to: '/product-types', label: 'Product Types', icon: 'masters', permission: 'product_types.view' },
      { to: '/colors', label: 'Colors', icon: 'masters', permission: 'colors.view' },
      { to: '/sizes', label: 'Sizes', icon: 'masters', permission: 'sizes.view' },
      { to: '/manufacturers', label: 'Manufacturers', icon: 'building', permission: 'manufacturers.view' },
      { to: '/locations', label: 'Locations', icon: 'building', permission: 'locations.view' },
    ],
  },
  {
    label: 'Orders',
    items: [
      { to: '/purchase-orders', label: 'Purchase Orders', icon: 'po', permission: 'po.view' },
      { to: '/calendar', label: 'PO Calendar', icon: 'calendar', permission: 'calendar.view' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/chat', label: 'Team Chat', icon: 'chat', permission: 'chat.view' },
      { to: '/approvals', label: 'Approval Queue', icon: 'approvals', permission: 'approvals.view' },
      { to: '/receipts', label: 'Receiving', icon: 'receipts', permission: 'receipt.view' },
      { to: '/auctions', label: 'Auctions', icon: 'trophy', permission: 'auctions.view' },
      { to: '/masters', label: 'Masters', icon: 'masters', permission: 'masters.view', hiddenRoles: ['purchase_executive'] },
      { to: '/pricing', label: 'Pricing', icon: 'reports', permission: 'pricing.view', hiddenRoles: ['purchase_executive'] },
      { to: '/export-data', label: 'Export Data', icon: 'reports', permission: 'reports.export', hiddenRoles: ['purchase_executive'] },
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
      { to: '/reports', label: 'Reports', icon: 'reports', permission: 'reports.view', hiddenRoles: ['purchase_executive'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/users', label: 'Users & Roles', icon: 'users', permission: 'users.manage' },
      { to: '/roles', label: 'Roles', icon: 'shield', permission: 'users.manage', superAdminOnly: true },
      { to: '/settings', label: 'Settings', icon: 'settings', permission: 'settings.manage' },
      { to: '/audit-logs', label: 'Audit Trail', icon: 'audit', permission: 'audit.view' },
      { to: '/import-data', label: 'Import Data', icon: 'reports', permission: 'import.manage' },
      { to: '/collections', label: 'Collections', icon: 'masters', permission: 'collections.view' },
      { to: '/dealers', label: 'Dealers', icon: 'building', permission: 'dealers.view' },
      { to: '/company', label: 'Company Settings', icon: 'settings', permission: 'company.view' },
      { to: '/attachments', label: 'Attachments', icon: 'catalogue', permission: 'attachments.view', hiddenRoles: ['purchase_executive'] },
    ],
  },
];

const FOOTWEAR_BRANDS = [
  { name: 'Bata', manufacturer: 'Bata India' },
  { name: 'Woodland', manufacturer: 'Aero Club / Woodland' },
  { name: 'Liberty', manufacturer: 'Liberty Shoes Ltd.' },
  { name: 'Relaxo', manufacturer: 'Relaxo Footwears Limited' },
  { name: 'Sparx', manufacturer: 'Relaxo Footwears Limited' },
  { name: 'Campus', manufacturer: 'Campus Activewear Limited' },
  { name: 'Red Tape', manufacturer: 'Mirza International Limited' },
  { name: 'Puma', manufacturer: 'PUMA' },
  { name: 'Adidas', manufacturer: 'adidas India' },
  { name: 'Nike', manufacturer: 'Nike India' },
  { name: 'Skechers', manufacturer: 'Skechers India' },
  { name: 'Reebok', manufacturer: 'Reebok India' },
  { name: 'Asics', manufacturer: 'ASICS India' },
  { name: 'Under Armour', manufacturer: 'Under Armour India' },
  { name: 'Metro', manufacturer: 'Metro Brands Limited' },
  { name: "Khadim's", manufacturer: 'Khadim India Limited' },
  { name: 'Paragon', manufacturer: 'Paragon Polymer Products Pvt. Ltd.' },
  { name: 'Walkaroo', manufacturer: 'Walkaroo International Pvt. Ltd.' },
];

const DEPARTMENT_GROUPS = [
  {
    key: 'men',
    title: "Men's Collection",
    icon: 'men',
    sections: [
      { code: 'MEN-SHIRTS', name: "Men's Shirts", icon: 'shirts' },
      { code: 'MEN-TROUSERS', name: "Men's Trousers & Jeans", icon: 'trousers' },
      { code: 'MEN-TSHIRTS', name: "Men's T-Shirts", icon: 'tshirts' },
      { code: 'MEN-ETHNIC', name: "Men's Ethnic Wear", icon: 'ethnic' },
      { code: 'MEN-INNERWEAR', name: "Men's Innerwear", icon: 'innerwear' },
      { code: 'FOOTWEAR-M', name: "Footwear — Men", icon: 'footwear', brands: FOOTWEAR_BRANDS },
    ],
  },
  {
    key: 'women',
    title: "Women's Collection",
    icon: 'women',
    sections: [
      { code: 'WOM-SAREES', name: "Women's Sarees", icon: 'sarees' },
      { code: 'WOM-KURTIS', name: "Women's Kurtis & Salwar", icon: 'kurtis' },
      { code: 'WOM-WESTERN', name: "Women's Western Wear", icon: 'western' },
      { code: 'WOM-BLOUSE', name: "Ethnic / Blouse Fabric", icon: 'fabric' },
      { code: 'WOM-INNERWEAR', name: "Women's Innerwear", icon: 'innerwear' },
      { code: 'JWL-FASHION', name: "Jewellery — Artificial", icon: 'gem' },
      { code: 'JWL-BANGLES', name: "Jewellery — Bangles", icon: 'bangles' },
      { code: 'FOOTWEAR-W', name: "Footwear — Women", icon: 'heels' },
      { code: 'ACCESSORIES', name: "Accessories & Bags", icon: 'bag' },
    ],
  },
  {
    key: 'kids',
    title: "Kids Collection",
    icon: 'kids',
    sections: [
      { code: 'KIDS-BOYS', name: "Kids Boys Wear", icon: 'boys' },
      { code: 'KIDS-GIRLS', name: "Kids Girls Wear", icon: 'girls' },
      { code: 'KIDS-INFANT', name: "Kids Infant Wear", icon: 'infant' },
      { code: 'KIDS-TOYS', name: "Toys & Games", icon: 'ball' },
    ],
  },
  {
    key: 'home',
    title: "Home & Furnishing",
    icon: 'home',
    sections: [
      { code: 'HOME-FURN', name: "Home Furnishing & Decor", icon: 'bed' },
      { code: 'FURNITURE', name: "Furniture & Interiors", icon: 'chair' },
    ],
  },
];

function canSee(item, user) {
  if (item.permission && !user.isSuperAdmin && !user.permissions?.includes(item.permission)) return false;
  if (item.superAdminOnly && !user.isSuperAdmin) return false;
  // Role-level trimming: Purchase Executives (e.g. Sachin — DVG) get a focused
  // workspace — catalogue + orders + chat. Back-office/admin areas are hidden.
  if (item.hiddenRoles && !user.isSuperAdmin && user.roles?.some((r) => item.hiddenRoles.includes(r))) return false;
  return true;
}

function DepartmentNavGroup({ group, collapsed, open, onToggle, expandedSection, onToggleSection }) {
  return (
    <div className="nav-collection">
      <button
        type="button"
        className={`nav-link nav-coll-btn ${open ? 'open' : ''}`}
        onClick={onToggle}
      >
        <span className="nav-dept-icon"><CollectionIcon name={group.icon} size={15} /></span>
        {!collapsed && (
          <>
            <span className="nav-coll-name">{group.title}</span>
            <span className="nav-dept-count">{group.sections.length}</span>
            <span className={`nav-chevron ${open ? 'down' : ''}`}><Icon name="chevronRight" size={14} /></span>
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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="po" size={13} /> All {group.title} & PO Studio</span>
          </NavLink>

          {group.sections.map((sec) => (
            <div key={sec.code} className="nav-section-wrap">
              <NavLink
                to={`/collection/${group.key}?sectionCode=${sec.code}`}
                className={({ isActive }) => (isActive ? 'nav-sublink active' : 'nav-sublink')}
                title={sec.name}
                onClick={sec.brands ? (e) => { e.preventDefault(); onToggleSection(sec.code); } : undefined}
              >
                <span className="nav-sub-icon"><CollectionIcon name={sec.icon} size={13} /></span>
                <span className="nav-sub-text">{sec.name}</span>
                {sec.brands && <span className={`nav-chevron small ${expandedSection === sec.code ? 'down' : ''}`}><Icon name="chevronRight" size={12} /></span>}
              </NavLink>
              {sec.brands && expandedSection === sec.code && (
                <div className="nav-brands-list">
                  {sec.brands.map((brand) => (
                    <NavLink
                      key={brand.name}
                      to={`/catalogue?brand=${encodeURIComponent(brand.name)}&sectionCode=FOOTWEAR-M`}
                      className="nav-brand-link"
                      title={brand.manufacturer}
                    >
                      <span className="nav-brand-dot" />
                      <span className="nav-brand-name">{brand.name}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ collapsed, onToggle }) {
  const { user } = useAuth();
  const canBrowse = user.isSuperAdmin || user.permissions?.includes('masters.view');
  // Division Supervisor: strictly restricted — Men's collection and PO viewing
  // only. All other collections, masters and admin areas stay hidden.
  const isSupervisor = user.roles?.includes('division_supervisor') && !user.isSuperAdmin;

  // Dynamic collection navigation: known groups come from the hardcoded
  // DEPARTMENT_GROUPS; any NEW department/section created by the Admin in
  // Master Data (e.g. Lycra Men's, Women's Ethnic, Cricket, Furniture) is
  // fetched from the API and merged in — the nav grows automatically.
  const [dynamicGroups, setDynamicGroups] = useState(DEPARTMENT_GROUPS);
  useEffect(() => {
    if (!canBrowse) return;
    Promise.all([api.get('/departments'), api.get('/sections', { params: { status: 'active' } })])
      .then(([depRes, secRes]) => {
        const deps = depRes.data.data || [];
        const secs = secRes.data.data || [];
        const depById = new Map(deps.map((d) => [d.id, d]));
        const defaultsByKey = new Map(DEPARTMENT_GROUPS.map((g) => [g.key, g]));
        const knownIcons = new Map(DEPARTMENT_GROUPS.flatMap((g) => g.sections.map((s) => [s.code, s.icon])));
        const groups = new Map();
        secs.forEach((sec) => {
          const dept = depById.get(sec.department_id);
          if (!dept) return;
          const key = (dept.code || dept.name || '').toLowerCase();
          if (!groups.has(key)) {
            const base = defaultsByKey.get(key);
            groups.set(key, {
              key,
              title: base ? base.title : dept.name,
              icon: base ? base.icon : 'masters',
              sections: base ? base.sections.map((s) => ({ ...s })) : [],
            });
          }
          const grp = groups.get(key);
          if (!grp.sections.some((x) => x.code === sec.code)) {
            grp.sections.push({ code: sec.code, name: sec.name, icon: knownIcons.get(sec.code) || 'masters' });
          }
        });
        if (groups.size) setDynamicGroups([...groups.values()]);
      })
      .catch(() => {});
  }, [canBrowse]);

  const departmentGroups = isSupervisor
    ? dynamicGroups.filter((g) => g.key === 'men')
    : dynamicGroups;
  const navSections = isSupervisor
    ? SECTIONS.filter((s) => !s.label || ['Collections', 'Orders'].includes(s.label))
    : SECTIONS;
  const canCreatePO = user.isSuperAdmin || user.permissions?.includes('po.create');
  const [openGroup, setOpenGroup] = useState('men');
  const [expandedSection, setExpandedSection] = useState(null);
  const navigate = useNavigate();

  const handleToggleSection = (code) => {
    setExpandedSection(expandedSection === code ? null : code);
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="brand donezo-brand">
        <img src="/bsc-logo.png" alt="BSC Exclusive" className="brand-mark-img" style={{ width: 40, height: 40, borderRadius: 10 }} />
        {!collapsed && (
          <div className="brand-name">BSC Exclusive</div>
        )}
      </div>
      <div className="sidebar-scroll">
        <nav>
          {navSections.map((section, si) => {
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
                    {departmentGroups.map((g) => (
                      <DepartmentNavGroup
                        key={g.key}
                        group={g}
                        collapsed={collapsed}
                        open={openGroup === g.key}
                        onToggle={() => setOpenGroup(openGroup === g.key ? null : g.key)}
                        expandedSection={expandedSection}
                        onToggleSection={handleToggleSection}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: 20 }}>
          {!collapsed && (
            <div className="donezo-mobile-promo">
              <div className="promo-icon"><Icon name="po" size={24} /></div>
              <strong>BSC Exclusive Mobile App</strong>
              <span>Manage orders on the go</span>
              <button className="btn">Download</button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
