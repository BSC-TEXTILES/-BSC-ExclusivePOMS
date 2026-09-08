import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const STEPS = [
  { num: '01', title: 'Pick from the catalogue', body: 'Our catalogue has over 1,100 products — jewellery, sarees, kurtis, menswear, footwear, home goods. Each product has its brand, manufacturer, HSN code, tax class, and approved dealer already linked.', img: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=400&fit=crop' },
  { num: '02', title: 'Build the purchase order', body: 'Buyers select colours and sizes, and the system calculates margins, discounts, and taxes in real time. No spreadsheets, no manual math.', img: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop' },
  { num: '03', title: 'Approval goes to the right people', body: 'Once submitted, the PO enters the approval chain. Managers review, approve or reject with mandatory comments. Every action is recorded.', img: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&h=400&fit=crop' },
  { num: '04', title: 'Goods arrive, stock updates', body: 'When goods reach the warehouse, the receiving team logs them against the PO. Partial deliveries are supported. Over-receipt is blocked.', img: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&h=400&fit=crop' },
];

const FEATURES = [
  { title: 'Live dashboards', desc: 'KPIs, order status, spend by section, supplier performance — all updated in real time.', img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500&h=320&fit=crop' },
  { title: 'Purchase order versioning', desc: 'Draft → amend → v2 with full diff tracking. Approved POs are locked and cannot be changed.', img: 'https://images.unsplash.com/photo-1568992687947-868a62a9f521?w=500&h=320&fit=crop' },
  { title: 'Approval chains', desc: 'Multi-level approval routing with mandatory comments on rejection. No approval can be skipped.', img: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=500&h=320&fit=crop' },
  { title: 'Inventory tracking', desc: 'Goods receipts adjust stock automatically. Partial deliveries and over-receipt controls are built in.', img: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=500&h=320&fit=crop' },
  { title: 'Full audit trail', desc: 'Every action — who did what, when, before and after — is logged and cannot be edited or deleted.', img: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=500&h=320&fit=crop' },
  { title: 'Team chat', desc: 'Division-scoped chat built into the system. Discuss orders, share files, resolve issues in context.', img: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=500&h=320&fit=crop' },
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
            <a href="#about">About</a>
            <a href="#workflow">How it Works</a>
            <a href="#features">Features</a>
          </div>
          <div className="lp-nav-actions">
            {user
              ? <Link className="lp-btn-primary" to="/dashboard">Open Dashboard</Link>
              : <Link className="lp-btn-primary" to="/login">Sign In</Link>}
          </div>
        </div>
      </nav>

      {/* ---- Hero ---- */}
      <section className="lp-hero">
        <img className="lp-hero-bg" src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&h=900&fit=crop" alt="" />
        <div className="lp-hero-overlay" />
        <div className="lp-hero-inner">
          <div className="lp-hero-content">
            <span className="lp-hero-tag">Est. 2024 · BSC Exclusive Pvt. Ltd.</span>
            <h1>Purchase Order<br/>Management System</h1>
            <p className="lp-hero-desc">Streamline your entire procurement workflow — from product catalogue to goods receipt. Create, approve, track, and manage all your purchase orders in one powerful platform built exclusively for BSC Exclusive.</p>
            <div className="lp-hero-features">
              <div className="lp-hero-feature">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>1,130+ Products</span>
              </div>
              <div className="lp-hero-feature">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>33 Brands</span>
              </div>
              <div className="lp-hero-feature">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Multi-Level Approvals</span>
              </div>
              <div className="lp-hero-feature">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Real-Time Tracking</span>
              </div>
            </div>
            <div className="lp-hero-btns">
              {user
                ? <Link className="lp-btn-primary big" to="/dashboard">Go to Dashboard →</Link>
                : <Link className="lp-btn-primary big" to="/login">Sign In to POMS →</Link>}
              <a className="lp-btn-ghost-light" href="#about">Learn more</a>
            </div>
          </div>
        </div>
      </section>

      {/* ---- About ---- */}
      <section className="lp-about" id="about">
        <div className="lp-section-inner">
          <div className="lp-about-grid">
            <div className="lp-about-image">
              <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=500&fit=crop" alt="Team working together" />
            </div>
            <div className="lp-about-text">
              <span className="lp-section-tag">About POMS</span>
              <h2>Not a product we bought.<br/>A system we built.</h2>
              <p>Before POMS, our purchase teams tracked everything in spreadsheets and WhatsApp groups. Orders got lost, approvals took days, and nobody had a clear view of what was ordered, what was received, or what was spent.</p>
              <p>We built POMS to fix that — a single place where every purchase order is created, approved, and tracked with full accountability.</p>
              <div className="lp-about-stats">
                <div className="lp-about-stat">
                  <div className="lp-about-stat-num">1,130+</div>
                  <div className="lp-about-stat-label">Products</div>
                </div>
                <div className="lp-about-stat">
                  <div className="lp-about-stat-num">4</div>
                  <div className="lp-about-stat-label">Divisions</div>
                </div>
                <div className="lp-about-stat">
                  <div className="lp-about-stat-num">33</div>
                  <div className="lp-about-stat-label">Brands</div>
                </div>
                <div className="lp-about-stat">
                  <div className="lp-about-stat-num">Zero</div>
                  <div className="lp-about-stat-label">Unchecked</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Workflow ---- */}
      <section className="lp-workflow" id="workflow">
        <div className="lp-section-inner">
          <span className="lp-section-tag">Workflow</span>
          <h2>How an order moves through the system</h2>
          <p className="lp-section-sub">Every purchase goes through the same controlled path — no shortcuts, no exceptions.</p>
          <div className="lp-steps">
            {STEPS.map((s) => (
              <div className="lp-step" key={s.num}>
                <div className="lp-step-image">
                  <img src={s.img} alt={s.title} />
                  <div className="lp-step-num-badge">{s.num}</div>
                </div>
                <div className="lp-step-content">
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Features ---- */}
      <section className="lp-features" id="features">
        <div className="lp-section-inner">
          <span className="lp-section-tag">Features</span>
          <h2>What POMS actually does</h2>
          <div className="lp-features-grid">
            {FEATURES.map((f) => (
              <div className="lp-feature-card" key={f.title}>
                <div className="lp-feature-img">
                  <img src={f.img} alt={f.title} />
                </div>
                <div className="lp-feature-body">
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-left">
            <img src="/bsc-logo.png" alt="BSC" className="lp-footer-logo" />
            <div>
              <div className="lp-footer-brand">BSC Exclusive Pvt. Ltd.</div>
              <div className="lp-footer-copy">Purchase Order Management System v2.0</div>
            </div>
          </div>
          <div className="lp-footer-right">
            <span>Built internally by the BSC tech team</span>
            <span>React · Express · PostgreSQL</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
