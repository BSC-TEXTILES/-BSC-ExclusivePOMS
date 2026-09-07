import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';

// Public landing page — explains the whole system before sign-in: what it does,
// how a PO flows, who can do what (role-based access), and the module map.
const FLOW = [
  { icon: 'catalogue', title: '1 · Pick from Catalogue', body: 'Buyers choose from 1,130+ products across Jewellery, Sarees, Kurtis, Men\'s & Kids wear, Footwear and Home — each with brand, manufacturer, dealer link, HSN and tax class.' },
  { icon: 'po', title: '2 · Create the PO', body: 'Colour × size matrix, live margin and net-value pricing per FRS §13.3, order discounts within policy, taxes and charges recomputed server-side every save.' },
  { icon: 'approvals', title: '3 · Approval Ladder', body: 'Submit → manager review → Tier-2 approval routing. Reject without a reason is blocked; every action lands in the immutable audit trail. Approved POs are snapshot-locked.' },
  { icon: 'receipts', title: '4 · Receive & Track', body: 'Partial or full goods receipts adjust inventory automatically, over-receipt is blocked, and the PO walks the §31.1 status ladder to Received / Closed.' },
];

const ROLES = [
  { icon: 'shield', name: 'Super Admin', desc: 'Everything: every division, every setting, user & role administration, masters, audit.' },
  { icon: 'building', name: 'Domain Admin', desc: 'Full control of their own division — its POs, approvals, users, sections and reports. Zero reach outside it.' },
  { icon: 'po', name: 'Purchase Executive', desc: 'Creates and edits draft POs for the assigned division, submits them for approval, chats with the team.' },
  { icon: 'approvals', name: 'Purchase Manager / Approver', desc: 'Reviews, approves, rejects or sends back submitted POs; issues approved orders; can amend into v2 drafts.' },
  { icon: 'receipts', name: 'Receiving User', desc: 'Posts goods receipts against issued POs — partial or full — feeding inventory in real time.' },
  { icon: 'reports', name: 'Auditor / Viewer', desc: 'Read-only: dashboards, reports, register exports and the complete who-did-what audit trail.' },
];

const MODULES = [
  ['dashboard', 'Live Dashboards', 'KPIs, division breakdown, status mix, section spend, top suppliers — all division-scoped.'],
  ['calendar', 'PO Calendar', 'Every purchase order on a day-wise calendar. Click any date to see that day\'s count, value and orders.'],
  ['po', 'Purchase Orders', 'Versioned drafts (v1 → v2 amendments), snapshot pricing, policy guards, department segregation.'],
  ['catalogue', 'Product Catalogue', 'Server-side pagination over 1,000+ SKUs, dynamic sections, image galleries per product.'],
  ['chat', 'Team Chat', 'Division-scoped live chat over WebSocket — persisted and auditable.'],
  ['users', 'Users & Roles', 'Admins grant access to anyone: roles, divisions, sections, activation, password resets, avatars.'],
  ['reports', 'Reports & Export', 'PO register, purchase summary, dealer ledger, margin and receiving reports — CSV export built in.'],
  ['audit', 'Audit Trail', 'Every create, edit, approval and receipt — who, when, before/after values, filterable.'],
  ['file', 'Attachments', 'Every PO and product carries files: PDF, Excel, Word, images, video — any format, up to 200 MB.'],
];

const STATS = [
  ['1,130+', 'catalogue products'],
  ['9', 'role types'],
  ['4', 'divisions'],
  ['100%', 'server-side policy enforcement'],
];

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="landing">
      <header className="land-nav">
        <div className="land-logo"><div className="brand-mark">B</div><strong>BSC Exclusive — POMS</strong></div>
        <nav>
          <a href="#how">How it works</a>
          <a href="#roles">Roles & access</a>
          <a href="#modules">Modules</a>
          {user
            ? <Link className="btn primary" to="/dashboard">Open Dashboard</Link>
            : <Link className="btn primary" to="/login">Sign in</Link>}
        </nav>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <span className="hero-tag">Purchase Order Management System</span>
          <h1>Every purchase, from <em>catalogue</em> to <em>goods receipt</em> — under one controlled roof</h1>
          <p>
            BSC Exclusive runs procurement across its divisions on POMS: a role-based system where every
            section — jewellery, sarees, menswear, kidswear, footwear, home — has its own catalogue,
            its own buyers, its own admins, and one auditable purchase-order pipeline.
          </p>
          <div className="hero-cta">
            {user
              ? <Link className="btn accent big" to="/dashboard">Go to your workspace →</Link>
              : <Link className="btn accent big" to="/login">Sign in to your workspace →</Link>}
            <a className="btn ghost-dark big" href="#how">See how it works</a>
          </div>
          <div className="hero-stats">
            {STATS.map(([v, l]) => (
              <div key={l}><div className="stat-v">{v}</div><div className="stat-l">{l}</div></div>
            ))}
          </div>
        </div>
      </section>

      <section className="land-section" id="how">
        <h2>How a purchase order flows</h2>
        <p className="land-sub">Four controlled stages — the system enforces the rules at every step, so nothing skips approval and nothing is counted twice.</p>
        <div className="flow-grid">
          {FLOW.map((f) => (
            <div className="flow-card" key={f.title}>
              <div className="flow-icon"><Icon name={f.icon} size={22} /></div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="land-section alt" id="roles">
        <h2>Role-based access — control given exactly where it belongs</h2>
        <p className="land-sub">Your role decides what you see and what you can do — the moment you sign in. Admins can grant any role, division or section to any user.</p>
        <div className="role-grid">
          {ROLES.map((role) => (
            <div className="role-card" key={role.name}>
              <div className="role-icon"><Icon name={role.icon} size={20} /></div>
              <div>
                <h3>{role.name}</h3>
                <p>{role.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="land-note">
          <Icon name="shield" size={16} />
          <span><strong>Enforced server-side, not just hidden.</strong> A buyer in Davanagere cannot see, edit or approve a Shivamogga order — the API refuses, and the attempt is audited (RB-001).</span>
        </div>
      </section>

      <section className="land-section" id="modules">
        <h2>Everything the workspace gives you</h2>
        <p className="land-sub">Sign in and the left navigation shows only the modules your roles unlock — collapsed to an icon rail or expanded, your choice.</p>
        <div className="module-grid">
          {MODULES.map(([icon, title, desc]) => (
            <div className="module-card" key={title}>
              <Icon name={icon} size={18} />
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="land-cta">
        <h2>Ready when you are</h2>
        <p>Demo accounts are pre-seeded for every role — sign in and the system adapts to you.</p>
        <div className="demo-strip">
          <span><strong>admin@bsc.local</strong> / Admin@123 — Super Admin</span>
          <span><strong>buyer.dvg@bsc.local</strong> / PE@12345 — Purchase Executive</span>
          <span><strong>approver.dvg@bsc.local</strong> / AP@12345 — Approver</span>
          <span><strong>receiver.dvg@bsc.local</strong> / RC@12345 — Receiving User</span>
        </div>
        {user
          ? <Link className="btn accent big" to="/dashboard">Open your dashboard →</Link>
          : <Link className="btn accent big" to="/login">Sign in →</Link>}
      </section>

      <footer className="land-foot">
        <span>BSC Exclusive · Purchase Order Management System v2.0</span>
        <span>React + Express + PostgreSQL · single-origin on :4040</span>
      </footer>
    </div>
  );
}
