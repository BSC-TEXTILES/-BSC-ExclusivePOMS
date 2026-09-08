import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

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
            <a href="#team">Our Team</a>
            <a href="#contact">Contact</a>
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
        <div className="lp-hero-inner">
          <div className="lp-hero-content">
            <span className="lp-hero-tag">Est. 2024 · BSC Exclusive Pvt. Ltd.</span>
            <h1>We manage procurement<br/>so you can focus on<br/><em>growing the business</em></h1>
            <p className="lp-hero-desc">POMS is the internal tool our purchase teams use every day — from selecting products in the catalogue to receiving goods at the warehouse. Built for how we actually work, not how a vendor thinks we should.</p>
            <div className="lp-hero-btns">
              {user
                ? <Link className="lp-btn-primary big" to="/dashboard">Go to Dashboard →</Link>
                : <Link className="lp-btn-primary big" to="/login">Sign In to POMS →</Link>}
              <a className="lp-btn-ghost" href="#about">Learn more</a>
            </div>
          </div>
          <div className="lp-hero-visual">
            <div className="lp-hero-dash-preview">
              <div className="lp-dash-bar"><span /><span /><span /></div>
              <div className="lp-dash-body">
                <div className="lp-dash-side" />
                <div className="lp-dash-main">
                  <div className="lp-dash-kpi-row">
                    <div className="lp-dash-kpi" />
                    <div className="lp-dash-kpi" />
                    <div className="lp-dash-kpi" />
                    <div className="lp-dash-kpi" />
                  </div>
                  <div className="lp-dash-chart" />
                  <div className="lp-dash-table-rows">
                    <div /><div /><div /><div /><div />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- About ---- */}
      <section className="lp-about" id="about">
        <div className="lp-section-inner">
          <div className="lp-about-grid">
            <div className="lp-about-text">
              <span className="lp-section-tag">About POMS</span>
              <h2>Not a product we bought.<br/>A system we built.</h2>
              <p>Before POMS, our purchase teams tracked everything in spreadsheets and WhatsApp groups. Orders got lost, approvals took days, and nobody had a clear view of what was ordered, what was received, or what was spent.</p>
              <p>We built POMS to fix that — a single place where every purchase order is created, approved, and tracked with full accountability.</p>
            </div>
            <div className="lp-about-stats">
              <div className="lp-about-stat">
                <div className="lp-about-stat-num">1,130+</div>
                <div className="lp-about-stat-label">Products in the catalogue</div>
              </div>
              <div className="lp-about-stat">
                <div className="lp-about-stat-num">4</div>
                <div className="lp-about-stat-label">Division offices connected</div>
              </div>
              <div className="lp-about-stat">
                <div className="lp-about-stat-num">33</div>
                <div className="lp-about-stat-label">Active brands managed</div>
              </div>
              <div className="lp-about-stat">
                <div className="lp-about-stat-num">Zero</div>
                <div className="lp-about-stat-label">Unchecked approvals</div>
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
            <div className="lp-step">
              <div className="lp-step-num">1</div>
              <div className="lp-step-content">
                <h3>Pick from the catalogue</h3>
                <p>Our catalogue has over 1,100 products — jewellery, sarees, kurtis, menswear, footwear, home goods. Each product has its brand, manufacturer, HSN code, tax class, and approved dealer already linked.</p>
              </div>
            </div>
            <div className="lp-step">
              <div className="lp-step-num">2</div>
              <div className="lp-step-content">
                <h3>Build the purchase order</h3>
                <p>Buyers select colours and sizes, and the system calculates margins, discounts, and taxes in real time. No spreadsheets, no manual math.</p>
              </div>
            </div>
            <div className="lp-step">
              <div className="lp-step-num">3</div>
              <div className="lp-step-content">
                <h3>Approval goes to the right people</h3>
                <p>Once submitted, the PO enters the approval chain. Managers review, approve or reject with mandatory comments. Every action is recorded.</p>
              </div>
            </div>
            <div className="lp-step">
              <div className="lp-step-num">4</div>
              <div className="lp-step-content">
                <h3>Goods arrive, stock updates</h3>
                <p>When goods reach the warehouse, the receiving team logs them against the PO. Partial deliveries are supported. Over-receipt is blocked. Inventory adjusts instantly.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Team / Roles ---- */}
      <section className="lp-team" id="team">
        <div className="lp-section-inner">
          <span className="lp-section-tag">Who uses it</span>
          <h2>Every role has a purpose</h2>
          <p className="lp-section-sub">POMS shows each person exactly what they need — no more, no less.</p>
          <div className="lp-team-grid">
            <div className="lp-team-card">
              <div className="lp-team-header" style={{ borderLeftColor: '#b98a2f' }}>
                <h3>Super Admin</h3>
              </div>
              <p>Manages the entire system — users, roles, divisions, all master data. Sees everything across every office.</p>
            </div>
            <div className="lp-team-card">
              <div className="lp-team-header" style={{ borderLeftColor: '#2563eb' }}>
                <h3>Purchase Executive</h3>
              </div>
              <p>Creates and submits purchase orders for their division. Works with the catalogue, sets quantities, attaches dealer quotes.</p>
            </div>
            <div className="lp-team-card">
              <div className="lp-team-header" style={{ borderLeftColor: '#059669' }}>
                <h3>Approver</h3>
              </div>
              <p>Reviews submitted POs, checks pricing and quantities, approves or rejects with comments. Can send back for revision.</p>
            </div>
            <div className="lp-team-card">
              <div className="lp-team-header" style={{ borderLeftColor: '#7c3aed' }}>
                <h3>Receiving User</h3>
              </div>
              <p>Logs incoming goods against approved POs. Handles partial deliveries and flags discrepancies before they become problems.</p>
            </div>
          </div>
          <div className="lp-team-note">
            <strong>Access is enforced server-side.</strong> A buyer in Davanagere cannot see or touch a Shivamogga order — the API blocks it and the attempt is logged.
          </div>
        </div>
      </section>

      {/* ---- What we built ---- */}
      <section className="lp-built">
        <div className="lp-section-inner">
          <span className="lp-section-tag">Under the hood</span>
          <h2>What POMS actually does</h2>
          <div className="lp-built-grid">
            <div className="lp-built-item">
              <div className="lp-built-title">Live dashboards</div>
              <p>KPIs, order status, spend by section, supplier performance — all updated in real time.</p>
            </div>
            <div className="lp-built-item">
              <div className="lp-built-title">Purchase order versioning</div>
              <p>Draft → amend → v2 with full diff tracking. Approved POs are locked and cannot be changed.</p>
            </div>
            <div className="lp-built-item">
              <div className="lp-built-title">Approval chains</div>
              <p>Multi-level approval routing with mandatory comments on rejection. No approval can be skipped.</p>
            </div>
            <div className="lp-built-item">
              <div className="lp-built-title">Inventory tracking</div>
              <p>Goods receipts adjust stock automatically. Partial deliveries and over-receipt controls are built in.</p>
            </div>
            <div className="lp-built-item">
              <div className="lp-built-title">Full audit trail</div>
              <p>Every action — who did what, when, before and after — is logged and cannot be edited or deleted.</p>
            </div>
            <div className="lp-built-item">
              <div className="lp-built-title">Team chat</div>
              <p>Division-scoped chat built into the system. Discuss orders, share files, resolve issues in context.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- CTA ---- */}
      <section className="lp-cta-section" id="contact">
        <div className="lp-section-inner">
          <div className="lp-cta-box">
            <h2>Want to see it in action?</h2>
            <p>Sign in with a demo account and explore the full system — dashboards, orders, approvals, everything.</p>
            <div className="lp-cta-accounts">
              <div className="lp-cta-account">
                <strong>admin@bsc.local</strong>
                <span>Admin@123</span>
                <em>Super Admin</em>
              </div>
              <div className="lp-cta-account">
                <strong>buyer.dvg@bsc.local</strong>
                <span>PE@12345</span>
                <em>Purchase Executive</em>
              </div>
              <div className="lp-cta-account">
                <strong>approver.dvg@bsc.local</strong>
                <span>AP@12345</span>
                <em>Approver</em>
              </div>
              <div className="lp-cta-account">
                <strong>receiver.dvg@bsc.local</strong>
                <span>RC@12345</span>
                <em>Receiving User</em>
              </div>
            </div>
            {user
              ? <Link className="lp-btn-primary big" to="/dashboard">Open Dashboard →</Link>
              : <Link className="lp-btn-accent big" to="/login">Sign In to POMS →</Link>}
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
