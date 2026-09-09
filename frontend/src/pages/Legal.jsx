// Public legal pages — Privacy Policy, Terms & Conditions, Security.
// Rendered inside a shared public shell reachable from the landing footer.

function LegalShell({ title, updated, children }) {
  return (
    <div className="legal-page">
      <nav className="legal-nav">
        <a href="/landing">← BSC Exclusive · POMS</a>
      </nav>
      <article className="legal-article">
        <h1>{title}</h1>
        <p className="legal-updated">Last updated: 9 September 2026 · Applies to the POMS platform and all its users</p>
        {children}
        <div className="legal-links">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms &amp; Conditions</a>
          <a href="/security">Security</a>
          <a href="/landing">Home</a>
        </div>
      </article>
    </div>
  );
}

function H({ children }) { return <h2>{children}</h2>; }

export function PrivacyPolicy() {
  return (
    <LegalShell title="Privacy Policy">
      <H>1. Who we are</H>
      <p>POMS (Purchase Order Management System) is operated by <strong>BSC Exclusive Pvt. Ltd.</strong> for its internal purchase teams, approvers, receiving staff and administrators. For any privacy question contact <strong>admin@bsc.local</strong> or the system administrator at your division office.</p>

      <H>2. Data we collect</H>
      <ul>
        <li><strong>Account data:</strong> your login ID, email, display name, phone, designation, profile photo and role. Accounts are created by the Administrator — we never ask for public registration.</li>
        <li><strong>Business data:</strong> the purchase orders, products, brands, categories, colours, sizes, dealers, receipts and reports you work with.</li>
        <li><strong>Security &amp; technical data:</strong> for every session we log the IP address, browser, operating system, device type, screen size and the pages you open, along with sign-in and sign-out times. If you grant permission, we also record the GPS coordinates reported by your browser.</li>
        <li><strong>Developer-tools events:</strong> attempts to open browser developer tools or automation tooling while using POMS are recorded, because the platform carries commercially sensitive pricing and margins.</li>
        <li><strong>Files:</strong> attachments you upload (PDF, Excel, Word, images, video or any other format) are stored and versioned, and can be replaced or deleted by you or the Administrator.</li>
      </ul>

      <H>3. Why we collect it</H>
      <p>We use this data only to run the procurement workflow: creating and approving purchase orders, receiving goods, keeping an immutable audit trail, restricting each user to their assigned collections and divisions, and protecting the platform against unauthorised access. We do not sell your data and we do not use it for advertising.</p>

      <H>4. Tracking — what is kept and where</H>
      <p>Session tracking is stored on our own servers (or our hosting provider's managed database) and is visible only to Administrators. GPS location is captured only after you explicitly allow location access in your browser; declining only means your sessions show no coordinates. Audit records are append-only and cannot be edited or deleted by any user, including Administrators.</p>

      <H>5. Cookies &amp; local storage</H>
      <p>POMS uses only <strong>strictly necessary</strong> browser storage: a session token so you stay signed in, your display preferences (for example the dark/bright theme and cookie consent), and a per-tab identifier used for live session monitoring. We use no advertising or third-party tracking cookies. See the cookie notice shown on your first visit.</p>

      <H>6. Retention</H>
      <p>Business and audit records are retained for as long as the company requires them for operations, accounting and legal purposes. Session tracking rows are retained for security review. You can request removal of personal details (name, photo, phone) via the Administrator; audit history itself is immutable by design.</p>

      <H>7. Your responsibilities</H>
      <p>Keep your password confidential, do not share logins, do not attempt to inspect or tamper with the platform (developer-tools blocking is enforced), and complete your profile on first login. Violations are logged and reported to the Administrator.</p>
    </LegalShell>
  );
}

export function Terms() {
  return (
    <LegalShell title="Terms &amp; Conditions">
      <H>1. Acceptance</H>
      <p>By signing in to POMS you agree to these terms. If you do not agree, stop using the platform and contact the Administrator to deactivate your account.</p>

      <H>2. Accounts and access</H>
      <ul>
        <li>Access is granted only by the Administrator. There is no public sign-up.</li>
        <li>Roles, collection scope (for example: Men's Shirts only) and division scope are decided exclusively by the Administrator and may change at any time.</li>
        <li>Accounts created for you must be completed with your real name and designation before use.</li>
        <li>Accounts may be disabled or have passwords reset by the Administrator at any time.</li>
      </ul>

      <H>3. Acceptable use</H>
      <p>You agree to use POMS only for legitimate company procurement work. You must not: share your credentials; attempt to access data of collections, divisions or users outside your assigned scope; probe, scan or test the security of the platform without written authorisation; attempt to bypass the developer-tools protections; or export data except through features provided for that purpose (PDF/CSV export, email/WhatsApp sharing).</p>

      <H>4. Purchase orders</H>
      <p>Orders you create are business records. Drafts may be edited until submitted; approved and issued orders are locked and change only through a formal amendment. Quantities must be non-negative; pricing, margins and taxes are calculated by the system's pricing engine and recalculated server-side before anything is saved.</p>

      <H>5. Availability</H>
      <p>We aim for continuous availability but do not guarantee an uninterrupted service. Scheduled maintenance will be announced where practical.</p>

      <H>6. Liability</H>
      <p>POMS is an internal business tool provided as-is to employees and authorised partners. To the maximum extent permitted by law, BSC Exclusive Pvt. Ltd. is not liable for indirect or consequential losses arising from use of the platform.</p>

      <H>7. Changes</H>
      <p>These terms may be updated as the platform evolves. Continued use after an update constitutes acceptance. Material changes will be announced by the Administrator.</p>
    </LegalShell>
  );
}

export function Security() {
  return (
    <LegalShell title="Security">
      <H>How POMS protects your data</H>
      <ul>
        <li><strong>Authentication:</strong> passwords are stored only as bcrypt hashes — never in plain text. Every login requires a fresh, single-use CAPTCHA that expires after 30 seconds.</li>
        <li><strong>Brute-force protection:</strong> five wrong passwords lock an account for 15 minutes; per-IP and per-account rate limits throttle repeated attempts; browser developer tools and automation are detected and blocked.</li>
        <li><strong>Authorisation:</strong> every API request is checked against role permissions, division scope and collection scope on the server — the interface only mirrors what the server already enforces. JWTs expire and are re-issued through a refresh flow.</li>
        <li><strong>Data integrity:</strong> the audit trail is append-only and protected at the database level; approved purchase orders are locked and versioned.</li>
        <li><strong>Transport:</strong> the API sends hardened security headers (nosniff, frame protection, strict referrer policy) and HSTS when served over HTTPS. Cross-origin browser access is restricted to the configured frontend origin.</li>
        <li><strong>Files:</strong> uploads are size-capped, stored under generated names, and served from read-only locations. Every file type is validated against the configured policy before acceptance.</li>
        <li><strong>Monitoring:</strong> sessions are tracked live (IP, device, pages, optional location) and every security-relevant event lands in the Administrator's dashboard and the immutable audit trail.</li>
      </ul>
      <p>Found a weakness? Report it privately to <strong>admin@bsc.local</strong> — do not test it against production yourself. Responsible reports are genuinely appreciated.</p>
    </LegalShell>
  );
}
