# BSC Exclusive POMS — Complete Project Execution & Data Flow Guide (aidmi.md)
## End-to-End Operational Manual & Production Runbook

---

## 1. Project Purpose & Scope

The **Purchase Order Management System (POMS) — BSC Exclusive Edition** is a centralized procurement and merchandise lifecycle platform. It replaces decentralized spreadsheets and manual paper orders with an automated, role-scoped, audited system managing merchandise across **21 distinct sections** (such as Men's Apparel, Designer Sarees, Ethnic Kurtis, Fine Jewellery, Footwear, and Accessories).

---

## 2. End-to-End Project Data Flow

This section details exactly how data originates, transforms, validates, and commits across the entire system lifecycle.

```
[ User Action in Browser ] 
        │
        ▼ (HTTP REST / WebSocket)
[ Security & Scoping Middleware ] 
  - Captcha Check
  - JWT Authentication
  - Division & Section RBAC Scoping
        │
        ▼
[ Business Domain Logic Engine ]
  - Server-Side Pricing (RB-017)
  - Approval Tier Resolution
  - Over-receipt Hard Gates (RB-022)
        │
        ▼
[ Database Transaction Block ]
  - Master PO / Line Items / Variants
  - Append-Only Audit Log Entry
  - Inventory Stock Adjustments
        │
        ▼
[ Downstream Side-Effects ]
  - WebSocket Real-Time Broadcast
  - Document Compiler (Branded PDF / RFC 4180 CSV)
```

---

## 3. Detailed Data Flow by Subsystem

### 3.1 Subsystem 1: User Login & Security Token Negotiation
1. **User requests login challenge**: Browser invokes `GET /api/auth/captcha`. The backend generates a 5-character distorted SVG challenge and stores the answer in memory with a 30-second TTL.
2. **User submits credentials**: Browser sends identifier, password, and solved CAPTCHA text via `POST /api/auth/login`.
3. **Verification**:
   - Clerk handles the sign-in flow (email/password or SSO).
   - The backend verifies the Clerk JWT and loads the user's RBAC data from PostgreSQL.
   - If the user has no DB row yet, one is auto-provisioned (self-signup).
4. **Session Setup**: Clerk manages the session token automatically. The frontend receives the user's RBAC profile (roles, division scopes, permissions).
5. **Audit Logging**: An immutable record (`action_type: 'login'`) is saved in `audit_logs`.
6. **Frontend Session Setup**: Clerk handles token storage and refresh. WebSocket connection `/ws/notify` is opened.

---

### 3.2 Subsystem 2: Master Data & Catalogue Browsing
1. **Scope Filtering**: When the user requests `/api/products`, the backend automatically filters results based on the user's authorized divisions and sections (`user_divisions`, `user_sections`).
2. **Hierarchical Relationships**:
   - **Division** (e.g. Davanagere, Bangalore Hub)
   - **Department** (e.g. Retail, Warehouse)
   - **Section** (e.g. Men's Collection, Sarees, Jewellery)
   - **Category & Subcategory** (e.g. Shirts → Formal Shirts)
   - **Product Type** (e.g. Woven Shirts)
   - **Brand & Manufacturer** (e.g. Raymond, Arvind Mills)
   - **Colour & Size Matrix** (e.g. Navy Blue × [38, 40, 42, 44])
3. **Real-Time Search**: Search queries execute full-text index matching against SKU, product name, brand name, and supplier code.

---

### 3.3 Subsystem 3: Purchase Order Creation & Commercial Calculation
1. **Header Definition**: Buyer selects Division, Department, Section, and an active Supplier.
2. **Matrix Input**: For each product, the buyer selects colors and enters quantities across the size matrix.
3. **Server-Side Commercial Enforcement (RB-017)**:
   - Client sends proposed line items to `POST /api/purchase-orders`.
   - The backend retrieves active purchase policy rules (`settings` table):
     - Maximum allowed margin (e.g. 60%)
     - Maximum allowed discount (e.g. 15%)
     - Standard GST rate (e.g. 18%)
   - For every line item, the server calculates:
     $$\text{Gross Amount} = \text{Purchase Price} \times \text{Quantity}$$
     $$\text{Line Discount} = \text{Gross Amount} \times \text{Discount \%}$$
     $$\text{Taxable Base} = \text{Gross Amount} - \text{Line Discount}$$
     $$\text{CGST} = \text{Taxable Base} \times \left(\frac{\text{GST Rate}}{2}\right), \quad \text{SGST} = \text{Taxable Base} \times \left(\frac{\text{GST Rate}}{2}\right)$$
     $$\text{Line Total} = \text{Taxable Base} + \text{Taxes}$$
4. **Denormalized Snapshots**: Product name, brand name, and colour name are frozen into `product_snapshot`, `brand_snapshot`, and `colour_snapshot` so future catalogue changes never alter historical orders.
5. **Sequential Numbering**: Atomically queries `number_sequences` to assign the next formatted identifier (e.g. `PO-DVG-2026-00005`).

---

### 3.4 Subsystem 4: Approval Routing & Commercial Governance
1. **Submission**: User clicks "Submit for Approval" (`POST /api/purchase-orders/:id/submit`).
2. **Rule Matching**:
   - The engine compares `grand_total` against `approval_rules`:
     - $\le ₹25,000$: Single level (Purchase Manager).
     - $> ₹25,000$ and $\le ₹1,00,000$: Two levels (Purchase Manager $\rightarrow$ Domain Admin).
     - $> ₹1,00,000$: Multi-level escalation (Purchase Manager $\rightarrow$ Domain Admin $\rightarrow$ Super Admin).
3. **Decisions**:
   - **Approve**: If final level, PO transitions to `approved` and sends WebSocket alert.
   - **Reject**: Requires mandatory written comment; PO transitions to `rejected`.
   - **Send Back**: Reverts PO status back to `draft` for buyer corrections.
   - **Hold**: Pauses approval SLA while queries are resolved with supplier.
4. **Issuance**: Once approved, authorized users click "Issue PO" (`POST /api/purchase-orders/:id/issue`). The PO is officially locked and transitioned to `issued`.

---

### 3.5 Subsystem 5: Document Generation & Export (CSV & PDF)
1. **Detailed CSV Export (`GET /api/purchase-orders/:id/export/csv`)**:
   - Generates an RFC 4180 CSV with UTF-8 BOM (`\uFEFF`).
   - Assembles 6 comprehensive data blocks:
     - **Buyer Entity**: Legal name, address, GSTIN, PAN, CIN, contact numbers.
     - **Seller Entity**: Supplier ID, company name, address, GSTIN, mobile, email.
     - **PO Metadata**: PO number, purchase date, expected delivery date, location, terms.
     - **Itemized Breakdown**: Line #, SKU, brand, color, matrix size quantities, unit price, margin %, discounts, line total.
     - **Financial Summary**: Subtotal, CGST, SGST, IGST, freight, and grand total.
     - **Terms**: Procurement quality clauses and legal declarations.
2. **Branded PDF Export (`GET /api/purchase-orders/:id/export/pdf`)**:
   - Generates a standalone, vectorized A4 PDF using `pdfWriter.js`.
   - Embeds the official BSC Exclusive logo as a binary XObject.
   - Formats clean metadata cards for Seller and Receiving Warehouse.
   - Renders alternating row tables with right-aligned currency amounts.
   - Appends a financial summary ledger and legal signature stamp blocks.
3. **Batch CSV Export (`GET /api/purchase-orders/export/csv`)**:
   - Streams all filtered purchase orders matching active search and date parameters.

---

### 3.6 Subsystem 6: Goods Receipt & Inventory Synchronization
1. **Arrival**: Delivery arrives at warehouse dock. Receiving team opens PO in Receiving module (`/receipts`).
2. **Inspection & Quantity Entry**: Quantities received are entered per line item.
3. **Over-Receipt Blocking (RB-022)**:
   - Server calculates: $\sum \text{Accepted Qty} + \text{New Qty} \le \text{Ordered Qty}$.
   - If new quantity exceeds remaining unreceived balance, transaction is aborted.
4. **Atomic Commit**:
   - Inserts record into `receipts` and `receipt_items`.
   - Creates corresponding records in `inventory_transactions` (`tx_type: 'receipt'`).
   - Updates PO status:
     - If all lines complete $\rightarrow$ `received`.
     - If partial $\rightarrow$ `partially_received`.

---

### 3.7 Subsystem 7: Real-Time Security Tracking & DevTools Detection
1. **Heartbeat Loop**: Every 20 seconds, active frontend tabs call `POST /api/tracking/heartbeat` with route, window dimensions, and tab ID.
2. **Developer Tools Watcher**:
   - Checks window outer/inner dimension discrepancies (docked DevTools).
   - Monitors execution delays across `debugger` timing probes.
3. **Enforcement**:
   - If DevTools are detected and `devtoolsBlock` is enabled by Administrator:
     - A full-screen security curtain locks the browser view.
     - Frontend immediately terminates the session via `POST /api/tracking/logout`.
     - Tokens are purged and user is redirected to `/login`.

---

## 4. Production Deployment & Operations Runbook

### 4.1 Production Prerequisites
- **Node.js**: Version 20+ LTS.
- **PostgreSQL**: Version 15+ (PostgreSQL 18 recommended).
- **Environment Configuration**: Set in `backend/.env`:
  ```ini
  PORT=4040
  DATABASE_URL=postgresql://postgres@localhost:5432/poms
  CLERK_SECRET_KEY=sk_test_your_clerk_secret_key
  ```

### 4.2 Starting the System

#### Windows (Single-click):
1. Run `run.bat` — starts PostgreSQL, applies schema, seeds data, launches backend + frontend.

#### Linux / Production Server:
```bash
# 1. Apply database schema and migrations
cd backend
npm run check
node scripts/run-all-migrations.mjs
node scripts/ensure-seed.mjs

# 2. Build the production frontend bundle
cd ../frontend
npm install
npm run build

# 3. Start the production server (serves API + compiled frontend)
cd ../backend
NODE_ENV=production npm start
```

### 4.3 Database Maintenance & Backups
```bash
# Automated daily backup command
pg_dump -h localhost -p 5432 -U postgres -d poms -F c -b -v -f "/backup/poms_$(date +%Y%m%d).dump"
```
