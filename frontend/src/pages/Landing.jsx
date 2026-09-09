import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const STEPS = [
  { num: '01', title: 'Pick from the catalogue', body: 'Our catalogue has over 1,130 active products — pure silk sarees, designer kurtis, menswear, footwear, kids apparel, and luxury home furnishings. Each product has its brand, manufacturer, HSN code, GST rate, and approved vendor already verified.', img: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800&h=520&fit=crop' },
  { num: '02', title: 'Build the purchase order', body: 'Buyers select verified market sizes (footwear UK 3–12, waist 28–46, apparel XS–5XL, kids sets), colourways, and rates. The system calculates margins, trade discounts, and GST breakdowns in real time.', img: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=520&fit=crop' },
  { num: '03', title: 'Approval goes to the right people', body: 'Once submitted, the PO enters the approval hierarchy. Managers review financial viability, approve or reject with mandatory audit remarks. Every timestamp and action is digitally recorded.', img: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&h=520&fit=crop' },
  { num: '04', title: 'Goods arrive, stock updates', body: 'When consignments reach the Davanagere central warehouse, the receiving team logs physical quantities against the PO. Partial deliveries are tracked and over-receipt is strictly blocked.', img: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&h=520&fit=crop' },
];

const FEATURES = [
  { title: 'Live dashboards', desc: 'Real-time KPIs, pending approval counts, spend by division, and vendor fulfilment metrics.', img: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=380&fit=crop' },
  { title: 'Purchase order versioning', desc: 'Draft → amend → v2 with full diff tracking. Approved POs are locked and digitally archived.', img: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&h=380&fit=crop' },
  { title: 'Approval chains', desc: 'Multi-level approval routing with mandatory comments on rejection. No approval can be skipped.', img: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=600&h=380&fit=crop' },
  { title: 'Inventory tracking', desc: 'Goods receipts adjust stock automatically. Partial deliveries and over-receipt controls are built in.', img: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=600&h=380&fit=crop' },
  { title: 'Full audit trail', desc: 'Every action — who did what, when, before and after — is logged immutably for compliance.', img: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&h=380&fit=crop' },
  { title: 'Division collaboration', desc: 'Procurement-scoped discussions built into the system. Clarify specifications and resolve issues in context.', img: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=380&fit=crop' },
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
            <span className="lp-hero-tag">Karnataka Textile Heritage · Estd. 1938 · Davanagere</span>
            <h1>Purchase Order<br />Management System</h1>
            <p className="lp-hero-desc">Streamline your entire retail procurement workflow — from product catalogue to goods receipt. Create, approve, track, and manage all your purchase orders in one powerful enterprise platform built exclusively for B. S. Channabasappa & Sons (BSC Exclusive).</p>
            <div className="lp-hero-features">
              <div className="lp-hero-feature">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                <span>1,130+ Products</span>
              </div>
              <div className="lp-hero-feature">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                <span>33 Brands</span>
              </div>
              <div className="lp-hero-feature">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                <span>Multi-Level Approvals</span>
              </div>
              <div className="lp-hero-feature">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
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
              <h2>Not a product we bought.<br />A system we built.</h2>
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
              <div className="lp-footer-brand">BSC Exclusive</div>
              <div className="lp-footer-copy">Enterprise Purchase Order Management System · Since 1938, Davanagere</div>
            </div>
          </div>
          <div className="lp-footer-right">
            <div className="lp-footer-links">
              <a href="/privacy">Privacy Policy</a>
              <a href="/terms">Terms &amp; Conditions</a>
              <a href="/security">Security</a>
            </div>
            <span>Built internally by the BSC tech team</span>
            <span>React · Express · PostgreSQL</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
