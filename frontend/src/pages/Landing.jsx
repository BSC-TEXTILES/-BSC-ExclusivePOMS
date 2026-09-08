import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const FLOW = [
  { num: '01', title: 'Pick from Catalogue', body: 'Browse 1,130+ products across Jewellery, Sarees, Kurtis, Menswear, Kidswear, Footwear & Home — each with brand, manufacturer, dealer link, HSN and tax class.', icon: '📦' },
  { num: '02', title: 'Create the PO', body: 'Colour × size matrix, live margin and net-value pricing, order discounts, taxes and charges — recomputed server-side every save.', icon: '📋' },
  { num: '03', title: 'Approval Ladder', body: 'Submit → manager review → Tier-2 approval. Reject without reason is blocked; every action lands in the immutable audit trail.', icon: '✅' },
  { num: '04', title: 'Receive & Track', body: 'Partial or full goods receipts adjust inventory automatically. Over-receipt is blocked, and the PO walks the status ladder to Closed.', icon: '🚚' },
];

const ROLES = [
  { name: 'Super Admin', desc: 'Full system control: every division, every setting, user & role management, masters, audit logs.', color: '#b98a2f' },
  { name: 'Domain Admin', desc: 'Full control of their own division — POs, approvals, users, sections and reports. Zero reach outside.', color: '#2563eb' },
  { name: 'Purchase Executive', desc: 'Creates and edits draft POs for the assigned division, submits them for approval, chats with the team.', color: '#059669' },
  { name: 'Approver', desc: 'Reviews, approves, rejects or sends back submitted POs. Issues approved orders. Can amend into v2 drafts.', color: '#7c3aed' },
  { name: 'Receiving User', desc: 'Posts goods receipts against issued POs — partial or full — feeding inventory in real time.', color: '#dc2626' },
  { name: 'Auditor / Viewer', desc: 'Read-only access: dashboards, reports, register exports and the complete who-did-what audit trail.', color: '#64748b' },
];

const MODULES = [
  { icon: '📊', name: 'Live Dashboards', desc: 'KPIs, division breakdown, status mix, section spend, top suppliers — all division-scoped.' },
  { icon: '📅', name: 'PO Calendar', desc: 'Every purchase order on a day-wise calendar. Click any date to see that day\'s orders.' },
  { icon: '📝', name: 'Purchase Orders', desc: 'Versioned drafts (v1 → v2), snapshot pricing, policy guards, department segregation.' },
  { icon: '🔍', name: 'Product Catalogue', desc: 'Server-side pagination over 1,000+ SKUs, dynamic sections, image galleries.' },
  { icon: '💬', name: 'Team Chat', desc: 'Division-scoped live chat over WebSocket — persisted and auditable.' },
  { icon: '👥', name: 'Users & Roles', desc: 'Admins grant access: roles, divisions, sections, activation, password resets.' },
  { icon: '📈', name: 'Reports & Export', desc: 'PO register, purchase summary, dealer ledger, margin reports — CSV export.' },
  { icon: '🔒', name: 'Audit Trail', desc: 'Every create, edit, approval and receipt — who, when, before/after values.' },
  { icon: '📎', name: 'Attachments', desc: 'Every PO and product carries files: PDF, Excel, images, video — up to 200 MB.' },
];

const STATS = [
  { value: '1,130+', label: 'Products in Catalogue' },
  { value: '33', label: 'Brands' },
  { value: '4', label: 'Divisions' },
  { value: '100%', label: 'Policy Enforcement' },
];

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="lp">
      {/* ---- Nav ---- */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-nav-brand">
            <img src="/bsc-logo.png" alt="BSC" className="lp-nav-logo-img" />
            <span>BSC Exclusive</span>
          </div>
          <div className="lp-nav-links">
            <a href="#features">Features</a>
            <a href="#how">How it Works</a>
            <a href="#roles">Roles</a>
            <a href="#modules">Modules</a>
          </div>
          <div className="lp-nav-actions">
            {user
              ? <Link className="lp-btn-primary" to="/dashboard">Dashboard</Link>
              : <Link className="lp-btn-primary" to="/login">Sign In</Link>}
          </div>
        </div>
      </nav>

      {/* ---- Hero ---- */}
      <section className="lp-hero">
        <div className="lp-hero-inner">
          <span className="lp-hero-tag">Purchase Order Management System</span>
          <h1>Every purchase,<br/>from catalogue to <span className="lp-gold">goods receipt</span>—<br/>under one roof</h1>
          <p className="lp-hero-desc">BSC Exclusive runs procurement across its divisions on POMS: a role-based system where every section has its own catalogue, buyers, admins, and one auditable purchase-order pipeline.</p>
          <div className="lp-hero-btns">
            {user
              ? <Link className="lp-btn-primary big" to="/dashboard">Go to Workspace →</Link>
              : <Link className="lp-btn-primary big" to="/login">Sign In to Workspace →</Link>}
            <a className="lp-btn-outline big" href="#features">Explore Features</a>
          </div>
          <div className="lp-hero-stats">
            {STATS.map((s) => (
              <div className="lp-stat" key={s.label}>
                <div className="lp-stat-value">{s.value}</div>
                <div className="lp-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="lp-hero-glow" />
      </section>

      {/* ---- Features ribbon ---- */}
      <section className="lp-features" id="features">
        <div className="lp-section-inner">
          <span className="lp-section-tag">Why POMS</span>
          <h2>Built for controlled procurement</h2>
          <p className="lp-section-sub">Every feature is designed to enforce policy, prevent leakage, and give management a clear view of every rupee spent.</p>
          <div className="lp-feature-grid">
            <div className="lp-feature-card wide">
              <div className="lp-feature-icon">🛡️</div>
              <h3>Policy Enforcement</h3>
              <p>Server-side guardrails at every step — discounts within bounds, over-receipt blocked, approval routing enforced. No client-side tricks.</p>
            </div>
            <div className="lp-feature-card">
              <div className="lp-feature-icon">⚡</div>
              <h3>Real-time Pricing</h3>
              <p>Live margin, net value and tax computation per FRS §13.3 — recomputed on every save.</p>
            </div>
            <div className="lp-feature-card">
              <div className="lp-feature-icon">📋</div>
              <h3>Versioned POs</h3>
              <p>Draft → amend → v2 with full diff tracking. Every version is snapshot-locked after approval.</p>
            </div>
            <div className="lp-feature-card">
              <div className="lp-feature-icon">🔍</div>
              <h3>Full Audit Trail</h3>
              <p>Every create, edit, approval and receipt — who, when, before/after values — filterable and exportable.</p>
            </div>
            <div className="lp-feature-card">
              <div className="lp-feature-icon">📦</div>
              <h3>Inventory Control</h3>
              <p>Goods receipts adjust stock in real time. Partial receipts supported, over-receipt blocked.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- How it works ---- */}
      <section className="lp-how" id="how">
        <div className="lp-section-inner">
          <span className="lp-section-tag">Workflow</span>
          <h2>How a purchase order flows</h2>
          <p className="lp-section-sub">Four controlled stages — the system enforces the rules at every step.</p>
          <div className="lp-flow-grid">
            {FLOW.map((f) => (
              <div className="lp-flow-card" key={f.num}>
                <div className="lp-flow-num">{f.num}</div>
                <div className="lp-flow-body">
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Roles ---- */}
      <section className="lp-roles" id="roles">
        <div className="lp-section-inner">
          <span className="lp-section-tag">Access Control</span>
          <h2>Role-based access — exactly where it belongs</h2>
          <p className="lp-section-sub">Your role decides what you see and what you can do. Admins can grant any role, division or section to any user.</p>
          <div className="lp-role-grid">
            {ROLES.map((r) => (
              <div className="lp-role-card" key={r.name}>
                <div className="lp-role-bar" style={{ background: r.color }} />
                <div className="lp-role-content">
                  <h3>{r.name}</h3>
                  <p>{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="lp-note">
            <span className="lp-note-icon">🔒</span>
            <span><strong>Enforced server-side, not just hidden.</strong> A buyer in one division cannot see, edit or approve another division's order — the API refuses, and the attempt is audited.</span>
          </div>
        </div>
      </section>

      {/* ---- Modules ---- */}
      <section className="lp-modules" id="modules">
        <div className="lp-section-inner">
          <span className="lp-section-tag">Workspace</span>
          <h2>Everything the workspace gives you</h2>
          <p className="lp-section-sub">Sign in and the left navigation shows only the modules your roles unlock.</p>
          <div className="lp-module-grid">
            {MODULES.map((m) => (
              <div className="lp-module-card" key={m.name}>
                <span className="lp-module-icon">{m.icon}</span>
                <h3>{m.name}</h3>
                <p>{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- CTA ---- */}
      <section className="lp-cta">
        <div className="lp-section-inner">
          <h2>Ready when you are</h2>
          <p>Demo accounts are pre-seeded for every role — sign in and the system adapts to you.</p>
          <div className="lp-demo-table">
            <table>
              <thead>
                <tr><th>Email</th><th>Password</th><th>Role</th></tr>
              </thead>
              <tbody>
                <tr><td><code>admin@bsc.local</code></td><td><code>Admin@123</code></td><td>Super Admin</td></tr>
                <tr><td><code>buyer.dvg@bsc.local</code></td><td><code>PE@12345</code></td><td>Purchase Executive</td></tr>
                <tr><td><code>approver.dvg@bsc.local</code></td><td><code>AP@12345</code></td><td>Approver</td></tr>
                <tr><td><code>receiver.dvg@bsc.local</code></td><td><code>RC@12345</code></td><td>Receiving User</td></tr>
              </tbody>
            </table>
          </div>
          <div className="lp-cta-btns">
            {user
              ? <Link className="lp-btn-primary big" to="/dashboard">Open Dashboard →</Link>
              : <Link className="lp-btn-accent big" to="/login">Sign In →</Link>}
          </div>
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <img src="/bsc-logo.png" alt="BSC" className="lp-nav-logo-img" />
            <span>BSC Exclusive</span>
          </div>
          <div className="lp-footer-links">
            <a href="#features">Features</a>
            <a href="#how">How it Works</a>
            <a href="#roles">Roles</a>
            <a href="#modules">Modules</a>
          </div>
          <div className="lp-footer-copy">© 2026 BSC Exclusive. Purchase Order Management System v2.0</div>
        </div>
      </footer>
    </div>
  );
}
