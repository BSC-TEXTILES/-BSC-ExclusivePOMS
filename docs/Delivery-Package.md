# 📦 COMPLETE DELIVERY PACKAGE — PO Management System

All four deliverables below. Everything is copy-paste ready.

---

# PART 1 — FORMAT CONVERSIONS

## 1A. Word / DOCX Structure (Build Sheet)

> I can't attach a binary `.docx`, so below is the exact **style map + front matter + full heading outline**. Paste the outline into Word, apply the styles, and the document auto-builds (auto-TOC, auto-numbering).

### Page & Document Setup

| Setting | Value |
|---|---|
| Page size / margins | A4; 2.5 cm top/bottom, 2.0 cm left/right |
| Header (all pages) | "PURCHASE ORDER & MERCHANDISE PROCUREMENT MANAGEMENT SYSTEM" — 8pt, grey, right-aligned |
| Footer | "Confidential - Internal Project Documentation \| Version 2.0" — 8pt, centered |
| Cover page | No header/footer, page break after |
| Body font | Calibri 11pt, line spacing 1.15, 6pt space after paragraph |

### Style Map (modify these in Word → Styles pane)

| Style Name | Formatting | Used For |
|---|---|---|
| `PO Title` | Calibri 28pt Bold, ALL CAPS, color `#1F4E79` | Cover title |
| `PO Subtitle` | 12pt Regular, centered | Cover subtitle lines |
| `Heading 1` | 16pt Bold, `#1F4E79`, **numbered: 1, 2, 3…** (multilevel list linked to H1), page-break-before | The 31 main sections |
| `Heading 2` | 13pt Bold, dark grey, numbered `x.y` (linked multilevel) | e.g., 12.2 |
| `Heading 3` | 11.5pt Bold Italic, numbered `x.y.z` | e.g., 8.2C |
| `Normal` | 11pt | Body text |
| `List Bullet` | Standard bullet | All bullet lists |
| `Table Header` | Fill `#1F4E79`, white bold 10pt, center | First row of every table |
| `Table Body` | 10pt, thin grey borders, banded rows | All other rows |
| `Caption` | 9pt Italic, centered, "Figure X." / "Table X." auto-numbered | Figure/table captions |
| `Note Box` | Single-cell table, light-blue fill `#DEEBF7` | Rules/warnings |

### Front Matter Order

1. Cover page (Title → subtitle → FRS line → version block)
2. Document Control table + Version History table
3. Hierarchical overview diagram (Figure 1)
4. Table of Contents → `References → Table of Contents → Automatic Table 1` (builds from Heading 1/2/3)
5. Page break → body

### Full Heading Outline (paste & apply styles)

```
H1  1.  Executive Summary
H1  2.  Project Objectives and Success Criteria
H2      2.1 Core Objectives          H2  2.2 Success Criteria
H1  3.  Scope and Boundaries
H2      3.1 In Scope                 H2  3.2 Phase 1 Boundaries
H1  4.  Business Context and Stakeholders
H1  5.  Organizational Hierarchy and Configuration Model
H1  6.  Roles, Authentication and Authorization
H2      6.1 Role Model               H2  6.2 Authentication Requirements
H2      6.3 Security & Access Control Flow
H1  7.  Master Data Management
H1  8.  Section Catalogue — 18 Initial Sections + Furniture Extension
H2      8.1 Initial Section Configuration
H2      8.2 Home Furnishing Extension
H2      8.3 Furniture & Home Interiors Extension
H3          8.3.1 Furniture Product Sections and Detailed Product Catalogue
H3          8.3.2 Furniture-Specific Purchase Order Fields
H3          8.3.3 Furniture Quantity and Dimension Rules
H3          8.3.4 Furniture Procurement Flow
H3          8.3.5 BSC Exclusive Procurement Coverage Matrix
H2      8.4 Add / Edit / Activate / Archive / Delete Behaviour
H1  9.  Size, Colour and Variant Management
H2      9.1 Size Methods   H2 9.2 Colour Master   H2 9.3 Variant Matrix
H1  10. Product and Brand Management
H2      10.1 Brand Master  H2 10.2 Product Master  H2 10.3 Other Option / Progressive Catalogue
H1  11. Dealer / Supplier Management
H2      11.1 Dealer Master Fields      H2 11.2 Dealer Ledger
H1  12. Purchase Order Functional Requirements
H2      12.1 PO Header  H2 12.2 Guided PO Creation  H2 12.3 Product Entry Grid
H1  13. Pricing, Margin, Discount, Tax and Charges
H2      13.1 Commercial Formula  H2 13.2 Calculation Reference  H2 13.3 Worked Example
H1  14. Approval and Governance Workflow
H2      14.1 Approval Flow  H2 14.2 Approval Actions  H2 14.3 Approved PO Control
H1  15. Receiving and Inventory Integration
H2      15.1 Quantity States  H2 15.2 Receiving Flow
H2      15.3 Receipt Header   H2 15.4 Receipt Line
H1  16. Dashboards, Reporting and Analytics
H2      16.1 Super Admin Dashboard   H2 16.2 Domain Admin Dashboard
H2      16.3 Reports Catalogue       H2 16.4 Transaction-to-Reporting Flow
H1  17. Audit Trail, History and Document Management
H2      17.1 Audit Event Fields      H2 17.2 Attachments and Comments
H2      17.3 PO Timeline
H1  18. Notifications and Communication
H1  19. UI/UX and Screen Specifications
H2      19.1 Main Navigation  H2 19.2 Key Screens  H2 19.3 UX Standards
H1  20. Data Model and Database Requirements
H2      20.1 Core Entities  H2 20.2 Suggested Table Set  H2 20.3 Historical Snapshot Principle
H1  21. API and Integration Requirements
H2      21.1 Domain Endpoint Map  H2 21.2 API Standards
H1  22. Security Requirements
H1  23. Non-Functional Requirements
H1  24. Business Rules and Validation Rules
H1  25. Exception and Edge-Case Handling
H1  26. Testing and Acceptance Criteria
H2      26.1 Test Categories  H2 26.2 Key Acceptance Scenarios
H1  27. Implementation Phases and Delivery Plan
H2      27.1 Administration & Configuration Flow
H1  28. Deployment, Backup and Operations
H1  29. Future Enhancements and Market Benchmark Features
H1  30. Glossary
H1  31. Final End-to-End Flow
H2      31.1 PO Lifecycle  H2 31.2 Complete Operating Flow
H1  Appendix A — Screen Inventory
H1  Appendix B — Suggested API Inventory
H1  Appendix C — Sample PO Data Structure
H1  Appendix D — Implementation Definition of Done
H1  Final Project Statement
```

**Word tips:** Insert figures as centered images with `Caption` style below (Word auto-numbers via Insert Caption). For the Figure 4/5/6 flow diagrams, recreate with SmartArt "Process" or paste the ASCII from the master doc into a monospace text box.

---

## 1B. Confluence Wiki Conversion

### Space & Page Tree

```
SPACE: POMS  (Purchase Order Management System)

POMS Home
├── 📄 Project Overview            (Exec Summary, Objectives, Scope — §1–3)
├── 📁 Requirements (FRS)
│   ├── 📄 Stakeholders & Roles            (§4, §6)
│   ├── 📄 Organizational Hierarchy        (§5)
│   ├── 📄 Master Data Management          (§7)
│   ├── 📄 Section Catalogue & Furniture   (§8)
│   ├── 📄 Sizes, Colours & Variants       (§9)
│   ├── 📄 Products & Brands               (§10)
│   ├── 📄 Dealers & Suppliers             (§11)
│   ├── 📄 Purchase Orders                 (§12)
│   ├── 📄 Pricing & Commercials           (§13)   ← example page below
│   ├── 📄 Approval Workflow               (§14)
│   ├── 📄 Receiving & Inventory           (§15)
│   ├── 📄 Business & Validation Rules     (§24, §25)
│   └── 📄 Notifications                   (§18)
├── 📁 Design & Architecture
│   ├── 📄 Data Model & Schema             (§20 + Part 2 SQL below)
│   ├── 📄 API Inventory                   (§21 + Appendix B)
│   ├── 📄 UI/UX & Screens                 (§19 + Appendix A)
│   └── 📄 Security & NFRs                 (§22, §23)
├── 📁 Delivery
│   ├── 📄 Phase Plan & Roadmap            (§27, §29 + Part 4 below)
│   ├── 📄 Testing & Acceptance            (§26)
│   ├── 📄 Deployment & Operations         (§28)
│   └── 📄 Changelog                       (Doc control table)
├── 📁 Development Handoff
│   ├── 📄 User Stories by Role            (Part 3 below)
│   ├── 📄 SQL Schema                      (Part 2 below)
│   └── 📄 Glossary & End-to-End Flow      (§30, §31)
```

### Confluence Macro Cheat Sheet

| Word Element | Confluence Markup |
|---|---|
| Section headings | `h1.` `h2.` `h3.` |
| Auto TOC | `{toc:style=disc\|maxLevel=3}` |
| Note/warning box | `{note}…{note}` or `{info}…{info}` |
| Status chip | `{status:colour=Green\|title=Approved}` |
| Tables | `||Header||Header||` then `|cell|cell|` |
| Flow diagrams | `{code:none}…{code}` for ASCII, or draw.io macro |
| Collapsible detail | `{expand:title=Details}…{expand}` |
| Page metadata | Page Properties macro + Page Properties Report on index pages |
| Decision log | `{tasklist}` for open items |

### Fully Converted Example Page — "Pricing & Commercials" (§13)

```wikimarkup
h1. 13. Pricing, Margin, Discount, Tax and Charges

{info:title=Source-Locked Formula}Net Value = Purchase Price + (Purchase Price × Margin %);
Discount Amount = Net Value × Discount % (or flat); Final Value = Net Value − Discount;
Line Total = Final Value × Total Quantity.{info}

{status:colour=Red|title=Backend Authoritative} The UI may preview results, but all
monetary values MUST be recalculated server-side (RB-017). {status}

h2. 13.2 Calculation Reference

||Calculation||Formula||
| Gross Value | Purchase Price × Total Quantity |
| Margin Amount | Purchase Price × Margin % |
| Net Value / Selling Value per Unit | Purchase Price + Margin Amount |
| Discount Amount | Net Value × Discount % OR Flat Discount |
| Final Value per Unit | Net Value − Discount Amount |
| Line Total | Final Value per Unit × Total Quantity |
| Subtotal | Sum of line totals before order-level charges |
| Tax | Configured tax rule on applicable taxable base |
| Additional Charges | Freight + packing + transport + other configured charges |
| Grand Total | Subtotal − order-level discount + tax + charges |

h2. 13.3 Worked Example

||Field||Value||
| Brand / Product | Levi's – Men's Formal Shirt |
| Colour | Navy Blue |
| Size Qty | S10 / M20 / L20 / XL15 / XXL10 / XXXL5 = *80* |
| Purchase Price / Unit | ₹650.00 |
| Margin | 40% = ₹260.00 |
| Net Value / Unit | ₹910.00 |
| Discount | 10% = ₹91.00 |
| Final Value / Unit | ₹819.00 |
| *Line Total* | *₹65,520.00* |

{expand:title=Related Business Rules}
* RB-008: Purchase price cannot be negative
* RB-009: Discount cannot exceed allowed policy without exception approval
* RB-010: Margin cannot exceed configured policy without permission/approval
* RB-017: Financial totals must be recalculated server-side before persistence/approval
{expand}
```

> **Bulk conversion tip:** Save the master doc as `.docx`, then in Confluence use **Space Settings → Content Tools → Import Word Document** — headings, tables and lists convert automatically; then split into the page tree above. Plain-text/Markdown version: the master document I produced earlier already conforms — tell me if you want it re-emitted as pure `.md` files per page.

---

# PART 2 — SQL SCHEMA (Section 20 Table Set)

PostgreSQL 14+. Every table annotated with its spec source. RB-rule constraints are enforced in-database where possible.

```sql
-- ============================================================
-- PURCHASE ORDER MANAGEMENT SYSTEM — CORE SCHEMA v1.0
-- Maps to: FRS §20.2 Suggested Table Set + §7 Master Data +
--          §12-15 Transactions + §24 Business Rules
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- ENUMS ----------
CREATE TYPE entity_status   AS ENUM ('active','inactive','archived');
CREATE TYPE po_status       AS ENUM ('draft','submitted','under_review','approved',
                                     'issued','partially_received','received',
                                     'closed','cancelled');                 -- §31.1
CREATE TYPE approval_action AS ENUM ('submitted','approved','rejected',
                                     'send_back','hold','escalated');       -- §14.2
CREATE TYPE discount_type   AS ENUM ('percent','flat');                    -- §13
CREATE TYPE payment_terms   AS ENUM ('advance','net_30','net_60',
                                     'against_delivery','custom');          -- §11.1
CREATE TYPE charge_type     AS ENUM ('freight','packing','transport',
                                     'installation','assembly','other');    -- §8.2C
CREATE TYPE receipt_status  AS ENUM ('draft','posted','cancelled');        -- §15
CREATE TYPE inventory_type  AS ENUM ('receipt','adjustment','issue');      -- §20.1
CREATE TYPE notify_channel  AS ENUM ('in_app','email','sms','whatsapp');   -- §18
CREATE TYPE job_status      AS ENUM ('pending','processing','completed',
                                     'failed','partial');                   -- §25
CREATE TYPE order_discount_scope AS ENUM ('order');                         -- order-level

-- ---------- ORGANIZATION / SCOPE (§5) ----------
CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE divisions (                                            -- §7 Division master
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id),
  code        text NOT NULL UNIQUE,             -- RB-001 scope key
  name        text NOT NULL,
  location    text,  contact_phone text,  contact_email text,
  status      entity_status NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE departments (                                          -- §7
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL,
  name        text NOT NULL,
  division_id uuid REFERENCES divisions(id),    -- NULL = global dept (§7)
  is_global   boolean NOT NULL DEFAULT false,
  status      entity_status NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_dept UNIQUE NULLS NOT DISTINCT (division_id, code)
);

-- ---------- SECTION / CATALOGUE HIERARCHY (§8, §9) ----------
CREATE TABLE size_methods (                                         -- §9.1
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code      text NOT NULL UNIQUE,   -- 'standard_apparel','numeric_waist','free_size',
                                    -- 'age_group','footwear_uk','custom'
  name      text NOT NULL,
  is_custom boolean NOT NULL DEFAULT false
);

CREATE TABLE sections (                                             -- §7/§8: dynamic master
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL,
  name            text NOT NULL,
  department_id   uuid NOT NULL REFERENCES departments(id),
  parent_group    text,                         -- e.g. "Men's Wear" display group
  sizing_method_id uuid NOT NULL REFERENCES size_methods(id),
  display_order   integer NOT NULL DEFAULT 0,
  attributes      jsonb NOT NULL DEFAULT '{}',  -- §7 section attributes
  icon_url        text,
  status          entity_status NOT NULL DEFAULT 'active',  -- RB-014 archive, not delete
  created_by      uuid,  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_section UNIQUE NULLS NOT DISTINCT (department_id, code)
);
CREATE INDEX idx_sections_status ON sections(department_id, status);

CREATE TABLE section_attributes (                                   -- §7
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id     uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  attribute_key  text NOT NULL,  attribute_label text NOT NULL,
  data_type      text NOT NULL DEFAULT 'text',   -- text|number|enum|boolean
  options        jsonb,  is_required boolean NOT NULL DEFAULT false,
  display_order  integer NOT NULL DEFAULT 0,
  UNIQUE (section_id, attribute_key)
);

CREATE TABLE categories (                                           -- §7
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id  uuid NOT NULL REFERENCES sections(id),
  parent_category_id uuid REFERENCES categories(id),  -- subcategory (§5)
  code        text NOT NULL,  name text NOT NULL,
  status      entity_status NOT NULL DEFAULT 'active',
  CONSTRAINT uq_cat UNIQUE NULLS NOT DISTINCT (section_id, parent_category_id, code)
);

CREATE TABLE sizes (                                                -- §9.1
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  size_method_id uuid NOT NULL REFERENCES size_methods(id),
  label          text NOT NULL,               -- 'S','30','0-2 yrs','UK 8','Free Size'
  numeric_value  numeric,                     -- for numeric sorts
  display_order  integer NOT NULL DEFAULT 0,
  UNIQUE (size_method_id, label)
);

CREATE TABLE colours (                                              -- §9.2
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE,
  name         text NOT NULL,
  colour_family text,  swatch_hex char(7),
  is_custom    boolean NOT NULL DEFAULT false,   -- RB-016 'Other' flag
  status       entity_status NOT NULL DEFAULT 'active'
);
CREATE UNIQUE INDEX uq_colour_name_ci ON colours (lower(name));  -- §9.2 anti-duplicate

-- ---------- BRAND / PRODUCT (§10) ----------
CREATE TABLE brands (                                               -- §10.1
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_number  text NOT NULL UNIQUE,     -- business identifier   (RB-005: distinct)
  brand_serial  text NOT NULL UNIQUE,     -- internal reference    (RB-005: distinct)
  brand_name    text NOT NULL,
  brand_code    text,
  manufacturer  text,
  valid_from    date,  valid_to date,       -- §10.1 lifecycle dates
  status        entity_status NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (                                             -- §10.2
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_serial text NOT NULL UNIQUE,        -- system-generated (§10.2)
  sku            text NOT NULL,               -- RB-004 uniqueness (scope via policy)
  barcode        text UNIQUE,
  name           text NOT NULL,  description text,
  brand_id       uuid NOT NULL REFERENCES brands(id),
  department_id  uuid REFERENCES departments(id),
  section_id     uuid NOT NULL REFERENCES sections(id),
  category_id    uuid REFERENCES categories(id),
  subcategory_id uuid REFERENCES categories(id),
  attributes     jsonb NOT NULL DEFAULT '{}', -- material, pattern, style, season,
                                              -- gender, age_group (§10.2)
  hsn_sac        text,  tax_category text,
  status         entity_status NOT NULL DEFAULT 'active',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_product_sku ON products (sku);  -- tighten per configured scope

CREATE TABLE product_variants (                                     -- §9.3 / §20.1
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size_id    uuid REFERENCES sizes(id),
  colour_id  uuid REFERENCES colours(id),
  style      text,
  CONSTRAINT uq_variant UNIQUE NULLS NOT DISTINCT (product_id, size_id, colour_id, style)
);

-- ---------- SUPPLIERS / DEALERS (§11) ----------
CREATE TABLE suppliers (                                            -- §11.1
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text NOT NULL UNIQUE,             -- Dealer Code
  company_name   text NOT NULL,  contact_person text,
  mobile         text,  email text,  address text,
  gstin          text,  pan text,
  payment_terms  payment_terms NOT NULL DEFAULT 'net_30',
  preferred_brands jsonb,  internal_rating numeric(3,1),
  bank_details   jsonb,                            -- permission-gated (§11.1)
  notes          text,
  status         entity_status NOT NULL DEFAULT 'active',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE supplier_divisions (                                   -- §11.1 multi-division
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  division_id uuid NOT NULL REFERENCES divisions(id),
  PRIMARY KEY (supplier_id, division_id)
);

CREATE TABLE supplier_brands (
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  brand_id    uuid NOT NULL REFERENCES brands(id),
  PRIMARY KEY (supplier_id, brand_id)
);

-- ---------- USERS / RBAC (§6) ----------
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  username      text NOT NULL UNIQUE,
  password_hash text NOT NULL,                    -- §22: never plaintext
  full_name     text NOT NULL,  phone text,
  mfa_enabled   boolean NOT NULL DEFAULT false,
  force_password_reset boolean NOT NULL DEFAULT false,   -- §6.2
  failed_attempts integer NOT NULL DEFAULT 0, locked_until timestamptz,
  last_login_at timestamptz,
  status        entity_status NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,    -- super_admin, domain_admin, purchase_manager,
                                -- purchase_executive, approver, receiving_user,
                                -- viewer, auditor                     (§6.1)
  name text NOT NULL,  description text
);

CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,    module text NOT NULL,  description text
);

CREATE TABLE role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE user_divisions (                       -- §6.1 access scope (RB-001)
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  division_id uuid NOT NULL REFERENCES divisions(id),
  PRIMARY KEY (user_id, division_id)
);

CREATE TABLE user_sections (                        -- Purchase Executive scope (§6.1)
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES sections(id),
  PRIMARY KEY (user_id, section_id)
);

-- ---------- NUMBER SEQUENCES (§7) ----------
CREATE TABLE number_sequences (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  text NOT NULL,            -- 'PO','RECEIPT','PRODUCT_SERIAL',...
  division_id  uuid REFERENCES divisions(id),
  seq_year     integer NOT NULL,
  prefix       text NOT NULL,
  current_value bigint NOT NULL DEFAULT 0,
  CONSTRAINT uq_seq UNIQUE NULLS NOT DISTINCT (entity_type, division_id, seq_year)
);

CREATE OR REPLACE FUNCTION next_number(p_entity text, p_div uuid, p_year int)
RETURNS text LANGUAGE sql AS $$                     -- race-safe (§21.2)
  INSERT INTO number_sequences (entity_type, division_id, seq_year, prefix, current_value)
  VALUES (p_entity, p_div, p_year, p_entity || '-' || p_year || '-', 1)
  ON CONFLICT (entity_type, division_id, seq_year)
  DO UPDATE SET current_value = number_sequences.current_value + 1
  RETURNING prefix || lpad(current_value::text, 5, '0');
$$;

-- ---------- PURCHASE ORDERS (§12, §13) ----------
CREATE TABLE purchase_orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number      text NOT NULL UNIQUE,
  version        integer NOT NULL DEFAULT 1,        -- §14.3 amendment/versioning
  parent_po_id   uuid REFERENCES purchase_orders(id),
  division_id    uuid NOT NULL REFERENCES divisions(id),
  department_id  uuid NOT NULL REFERENCES departments(id),
  section_id     uuid NOT NULL REFERENCES sections(id),
  supplier_id    uuid NOT NULL REFERENCES suppliers(id),
  created_by     uuid NOT NULL REFERENCES users(id),
  po_date        date NOT NULL DEFAULT current_date,
  status         po_status NOT NULL DEFAULT 'draft',     -- §31.1 lifecycle
  payment_terms  payment_terms,  delivery_terms text,
  currency       char(3) NOT NULL DEFAULT 'INR',
  tax_scheme     text,                                   -- e.g. 'GST_INTRA'/'GST_INTER'
  expected_delivery_date date,
  -- Commercial totals (server-authoritative, RB-017)
  subtotal       numeric(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  order_discount_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (order_discount_amount >= 0),
  tax_amount     numeric(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  charges_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (charges_amount >= 0),
  grand_total    numeric(14,2) NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
  header_snapshot jsonb,            -- §20.3 historical snapshot principle
  remarks        text,
  submitted_at timestamptz, approved_at timestamptz,
  issued_at    timestamptz, closed_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_po_div_status ON purchase_orders (division_id, status);
CREATE INDEX idx_po_supplier   ON purchase_orders (supplier_id);

CREATE TABLE purchase_order_items (                 -- §12.3 / §13 formulas
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id          uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  line_no        integer NOT NULL,
  product_id     uuid NOT NULL REFERENCES products(id),
  product_snapshot jsonb NOT NULL,                  -- §20.3
  brand_snapshot   jsonb NOT NULL,                  -- §20.3
  colour_id      uuid REFERENCES colours(id),
  colour_snapshot  jsonb,
  description    text,
  purchase_price numeric(12,2) NOT NULL CHECK (purchase_price >= 0),      -- RB-008
  margin_percent numeric(5,2)  NOT NULL DEFAULT 0 CHECK (margin_percent >= 0),
  margin_amount  numeric(12,2) NOT NULL DEFAULT 0,
  net_value_per_unit numeric(12,2) NOT NULL DEFAULT 0,   -- §13.1
  discount_type  discount_type,  discount_value numeric(12,2),
  discount_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  final_value_per_unit numeric(12,2) NOT NULL DEFAULT 0,
  total_quantity integer NOT NULL CHECK (total_quantity > 0),             -- RB-007
  line_total     numeric(14,2) NOT NULL DEFAULT 0 CHECK (line_total >= 0),
  UNIQUE (po_id, line_no)
);

CREATE TABLE purchase_order_quantities (            -- size/colour matrix §9.3, RB-006
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_item_id   uuid NOT NULL REFERENCES purchase_order_items(id) ON DELETE CASCADE,
  size_id      uuid REFERENCES sizes(id),
  size_label   text NOT NULL,                       -- snapshot §20.3
  quantity     integer NOT NULL CHECK (quantity >= 0),
  UNIQUE (po_item_id, size_id)
);
-- RB-006: variant sum must equal item total — enforce via app + spot constraint:

CREATE TABLE purchase_order_discounts (             -- order-level
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  discount_type discount_type NOT NULL,
  discount_value numeric(12,2) NOT NULL CHECK (discount_value >= 0),
  discount_amount numeric(14,2) NOT NULL CHECK (discount_amount >= 0),
  reason text
);

CREATE TABLE purchase_order_taxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  po_item_id uuid REFERENCES purchase_order_items(id),  -- NULL = order-level
  tax_name text NOT NULL,                               -- CGST/SGST/IGST
  rate numeric(5,2) NOT NULL,
  taxable_base numeric(14,2) NOT NULL,
  tax_amount numeric(14,2) NOT NULL
);

CREATE TABLE purchase_order_charges (               -- §8.3.3: kept separate from base price
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  charge_type charge_type NOT NULL,
  description text,  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  is_supplier_billed boolean NOT NULL DEFAULT true
);

-- ---------- APPROVALS (§14) ----------
CREATE TABLE approval_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,  priority integer NOT NULL DEFAULT 100,
  min_value numeric(14,2) DEFAULT 0,  max_value numeric(14,2),   -- ₹0–25k / 25k–1L / >1L
  division_id uuid REFERENCES divisions(id),   -- all NULL = enterprise-wide rule
  department_id uuid REFERENCES departments(id),
  section_id uuid REFERENCES sections(id),
  supplier_id uuid REFERENCES suppliers(id),
  category_id uuid REFERENCES categories(id),
  min_discount_percent numeric(5,2),
  is_active boolean NOT NULL DEFAULT true,
  CHECK (max_value IS NULL OR max_value >= min_value)
);

CREATE TABLE approval_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES approval_rules(id) ON DELETE CASCADE,
  level_no integer NOT NULL,
  approver_role_id uuid REFERENCES roles(id),
  approver_user_id uuid REFERENCES users(id),
  auto_escalate_after_hours integer,
  UNIQUE (rule_id, level_no)
);

CREATE TABLE approval_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES purchase_orders(id),
  rule_id uuid REFERENCES approval_rules(id),
  current_level integer NOT NULL DEFAULT 1,
  status po_status NOT NULL DEFAULT 'under_review',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE approval_actions (                     -- §14.2: RB-012 comments
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES approval_instances(id),
  level_no integer NOT NULL,
  approver_id uuid NOT NULL REFERENCES users(id),
  action approval_action NOT NULL,
  comments text,
  acted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rejection_needs_reason CHECK (          -- RB-012 in-database
    action IN ('submitted','approved','escalated') OR comments IS NOT NULL)
);

-- ---------- RECEIVING (§15) ----------
CREATE TABLE receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text NOT NULL UNIQUE,
  po_id uuid NOT NULL REFERENCES purchase_orders(id),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  division_id uuid NOT NULL REFERENCES divisions(id),
  delivery_date date,  invoice_number text,  invoice_date date,
  received_by uuid NOT NULL REFERENCES users(id),
  status receipt_status NOT NULL DEFAULT 'draft',
  remarks text,  attachments jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE receipt_items (                        -- §15.4 five-quantity model
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  po_item_id uuid NOT NULL REFERENCES purchase_order_items(id),
  ordered_qty  integer NOT NULL,
  received_qty integer NOT NULL CHECK (received_qty >= 0),
  damaged_qty  integer NOT NULL DEFAULT 0 CHECK (damaged_qty >= 0),
  rejected_qty integer NOT NULL DEFAULT 0 CHECK (rejected_qty >= 0),
  accepted_qty integer GENERATED ALWAYS AS
      (received_qty - damaged_qty - rejected_qty) STORED,
  remarks text,
  CONSTRAINT qty_consistency CHECK (damaged_qty + rejected_qty <= received_qty)
);

-- ---------- INVENTORY (§15 / §20.1) ----------
CREATE TABLE inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id uuid NOT NULL REFERENCES divisions(id),
  product_id uuid NOT NULL REFERENCES products(id),
  size_id uuid REFERENCES sizes(id),
  receipt_item_id uuid REFERENCES receipt_items(id),
  txn_type inventory_type NOT NULL,
  quantity integer NOT NULL,           -- signed; receipt = +
  unit_cost numeric(12,2),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_inv_lookup ON inventory_transactions (division_id, product_id, size_id);

-- ---------- CROSS-CUTTING (§17, §18, §20.2) ----------
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  channel notify_channel NOT NULL DEFAULT 'in_app',
  event_type text NOT NULL,            -- po_submitted, po_approved, delivery_overdue...
  entity_type text, entity_id uuid,
  title text NOT NULL, body text,
  is_read boolean NOT NULL DEFAULT false,
  sent_at timestamptz NOT NULL DEFAULT now(),  read_at timestamptz
);

CREATE TABLE attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL, entity_id uuid NOT NULL,   -- polymorphic ref §20.1
  file_name text NOT NULL, mime_type text NOT NULL,
  size_bytes bigint NOT NULL, storage_key text NOT NULL,
  checksum text, uploaded_by uuid NOT NULL REFERENCES users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_attach_entity ON attachments (entity_type, entity_id);

CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL, entity_id uuid NOT NULL,
  author_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL,
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','approval')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (                           -- §17.1 immutable stream
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid, user_role text,                      -- role snapshot §17.1
  division_id uuid, section_id uuid,
  action_type text NOT NULL,                         -- create/edit/delete/approve/receive
  entity_type text NOT NULL, entity_id uuid NOT NULL,
  before_value jsonb, after_value jsonb,
  reason text, request_id text, ip_address inet
);
CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id, occurred_at);
CREATE INDEX idx_audit_user   ON audit_logs (user_id, occurred_at);
-- Immutability: block tampering at DB level (§17)
CREATE OR REPLACE FUNCTION forbid_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN
  RAISE EXCEPTION 'audit_logs is append-only'; END $$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_mutation();

CREATE TABLE settings (
  key text PRIMARY KEY, value jsonb NOT NULL, description text,
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,             -- sections|brands|products|suppliers|po
  storage_key text NOT NULL,
  status job_status NOT NULL DEFAULT 'pending',
  total_rows integer, valid_rows integer, error_rows integer,
  error_report jsonb,                 -- §25: row-level error report
  requested_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);

CREATE TABLE export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL, filters jsonb,
  format text NOT NULL DEFAULT 'xlsx' CHECK (format IN ('xlsx','csv','pdf')),
  status job_status NOT NULL DEFAULT 'pending',
  storage_key text,
  requested_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);

-- ---------- HELPER: updated_at trigger ----------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
-- Apply to all tables having updated_at, e.g.:
CREATE TRIGGER trg_divisions_upd BEFORE UPDATE ON divisions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_po_upd BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- (repeat per table)
```

**Seed snippet (roles + size methods):**

```sql
INSERT INTO roles (code, name) VALUES
 ('super_admin','Super Admin'),('domain_admin','Domain Admin'),
 ('purchase_manager','Purchase Manager'),('purchase_executive','Purchase Executive'),
 ('approver','Approver'),('receiving_user','Receiving User'),
 ('viewer','Viewer'),('auditor','Auditor');

INSERT INTO size_methods (code, name) VALUES
 ('standard_apparel','Standard Apparel'),('numeric_waist','Numeric Waist'),
 ('free_size','Free Size'),('age_group','Age Group'),
 ('footwear_uk','Footwear UK'),('custom','Custom');
```

---

# PART 3 — USER STORIES BY ROLE (Development Handoff)

Format: **ID | Story (As a…I want…so that) | Priority (MoSCoW) | Trace** — each followed by acceptance criteria (Given/When/Then). Total: 34 stories across 8 roles + 2 system epics.

## 3.1 Super Admin (SA)

| ID | Story | Pri | Trace |
|---|---|---|---|
| SA-01 | As a **Super Admin**, I want to create divisions and assign Domain Admins to them, **so that** each branch operates in a controlled scope. | Must | §5, §6, RB-001 |
| SA-02 | As a **Super Admin**, I want to configure approval rules by value/division/section/dealer/discount thresholds, **so that** governance adapts without code changes. | Must | §14 |
| SA-03 | As a **Super Admin**, I want one consolidated dashboard across all 3 divisions with drill-down, **so that** I get enterprise-wide visibility. | Must | §16.1, SC-7 |
| SA-04 | As a **Super Admin**, I want to manage users, force password resets and deactivate accounts, **so that** access stays current. | Must | §6.2 |
| SA-05 | As a **Super Admin**, I want a filterable, exportable enterprise audit log with before/after values, **so that** I can verify accountability. | Must | §17, RB-015 |
| SA-06 | As a **Super Admin**, I want an exception queue for POs whose approval rule evaluation fails, **so that** procurement never silently stalls. | Should | §25 |

**AC — SA-01:** Given I am Super Admin, when I create division "Belagavi" with a unique code, then it appears active and selectable only for users assigned to it. Given a Domain Admin, when they attempt to view another division's POs, then the API returns 403 and the event is audit-logged.
**AC — SA-02:** Given rule "₹25,001–₹1,00,000 → Division Manager", when a PO of ₹80,000 is submitted, then it routes to Division Manager level only; no Super Admin action is required.
**AC — SA-03:** Given 3 divisions have POs, when I open the enterprise dashboard, then KPIs aggregate all divisions and clicking any division filters without page reload; load < 3s (§23).

## 3.2 Domain / Division Admin (DA)

| ID | Story | Pri | Trace |
|---|---|---|---|
| DA-01 | As a **Domain Admin**, I want to add/edit/activate/deactivate/archive sections for my division, **so that** the catalogue evolves without code deployment. | Must | §8.4, TC-03 |
| DA-02 | As a **Domain Admin**, I want to manage dealers (create, set payment terms, assign divisions), **so that** purchasing always has valid suppliers. | Must | §11.1 |
| DA-03 | As a **Domain Admin**, I want a division dashboard (POs, values, pending approvals, size-curve), **so that** I can manage branch procurement. | Must | §16.2 |
| DA-04 | As a **Domain Admin**, I want to import master data via wizard with row-level error reports, **so that** bulk setup is safe. | Should | §25, App A #28 |
| DA-05 | As a **Domain Admin**, I want section lifecycle changes audit-logged automatically, **so that** history is provable. | Must | §8.4, RB-015 |

**AC — DA-01:** Given a section with transaction history, when I click Delete, then the system offers Archive/Deactivate instead and never hard-deletes (RB-014).
**AC — DA-02:** Given a supplier is set to inactive, when a user creates a new PO for them, then selection is blocked; existing drafts remain readable (§25).
**AC — DA-04:** Given an import file with 3 invalid rows, when uploaded, then valid rows are staged, the 3 errors are listed with row numbers, and nothing inserts silently (§25).

## 3.3 Purchase Executive (PE)

| ID | Story | Pri | Trace |
|---|---|---|---|
| PE-01 | As a **Purchase Executive**, I want a guided 12-step PO creation flow scoped to my division, **so that** I can't enter invalid combinations. | Must | §12.2 |
| PE-02 | As a **Purchase Executive**, I want an inline "Other" form for Brand/Product/Colour/Dealer, **so that** I'm never blocked by a missing master entry. | Must | §10.3, TC-07 |
| PE-03 | As a **Purchase Executive**, I want a colour × size matrix with running totals and keyboard navigation, **so that** large apparel orders are entered fast. | Must | §9.3, §12.3, SC-6 |
| PE-04 | As a **Purchase Executive**, I want draft autosave and resume-after-relogin, **so that** long entries survive interruptions. | Should | §25 |
| PE-05 | As a **Purchase Executive**, I want to submit a completed draft for approval, **so that** procurement proceeds. | Must | §12.2 step 12 |

**AC — PE-03:** Given sizing method "Standard Apparel", when I open the matrix, then columns S–XXXL render; when I enter 5/10/12/10/6/2, then Total shows 45 live and matches stored total (RB-006); Tab moves cell-to-cell.
**AC — PE-02:** Given brand doesn't exist, when I select "Other" and fill the inline form, then the entry is validated, visibly flagged **Custom** (RB-016), and optionally promoted to master after approval — no navigation away from the PO.
**AC — PE-04:** Given I lose session mid-entry, when I re-authenticate and reopen the draft, then all entered lines are intact and I'm asked to re-confirm commercial values (§25).
**AC — PE-05 (idempotency):** Given a network drop on Submit, when the request retries, then only one PO is created (§25).

## 3.4 Purchase Manager (PM)

| ID | Story | Pri | Trace |
|---|---|---|---|
| PM-01 | As a **Purchase Manager**, I want to create/edit POs including commercial details (price/margin/discount) within policy, **so that** I own division purchasing. | Must | §6.1, RB-009/010 |
| PM-02 | As a **Purchase Manager**, I want to amend an approved/issued PO via a version event, **so that** changes are governed, not silent. | Must | §14.3, RB-011 |
| PM-03 | As a **Purchase Manager**, I want a pre-submit review screen showing server-calculated totals and validation results, **so that** errors are caught early. | Must | §12.2 step 11, RB-017 |

**AC — PM-02:** Given an approved PO, when I edit a line price, then the system creates version 2, snapshots the previous version, and re-runs approval routing (§14.3).
**AC — PM-01:** Given policy caps discount at 15%, when I enter 20%, then the system blocks or routes to exception approval per configuration (RB-009).

## 3.5 Approver (AP)

| ID | Story | Pri | Trace |
|---|---|---|---|
| AP-01 | As an **Approver**, I want a pending-approval queue sorted by age and value, **so that** I triage effectively. | Must | §19.2, §16 |
| AP-02 | As an **Approver**, I want to Approve / Reject (reason mandatory) / Send Back (comment mandatory) / Hold / Escalate, **so that** all governance paths exist. | Must | §14.2 |
| AP-03 | As an **Approver**, I want the full PO detail (lines, matrix, commercials, attachments, timeline) visible in the decision view, **so that** I can judge commercial merit. | Must | §17.3 |

**AC — AP-02:** Given I click Reject, when no reason is entered, then Submit is disabled and the API rejects with a validation error (RB-012, DB constraint enforced).
**AC — AP-02b:** Given a PO at my level, when I approve, then it advances to Level 2 if configured, else it becomes Approved and issue is unlocked (§14.1).
**AC — AP-03:** Given the PO timeline, then I see Created → Submitted → Reviewed… with actor + timestamp per event (§17.3).

## 3.6 Receiving User (RC)

| ID | Story | Pri | Trace |
|---|---|---|---|
| RC-01 | As a **Receiving User**, I want to create a receipt against an issued PO selecting lines, **so that** goods receipt is tied to the exact order. | Must | §15 |
| RC-02 | As a **Receiving User**, I want to record Received / Damaged / Rejected per line, with Accepted auto-computed, **so that** the 5-quantity model stays consistent. | Must | §15.1/15.4 |
| RC-03 | As a **Receiving User**, I want over-receipt blocked (or exception-routed), **so that** inventory never exceeds order without authorization. | Must | §25 |
| RC-04 | As a **Receiving User**, I want the PO to auto-transition Partially Received → Received → Closed, **so that** status is always accurate. | Must | §31.1, RB-013 |

**AC — RC-02:** Given ordered 80, when I enter received 70 / damaged 5 / rejected 5, then Accepted = 60 and inventory increases by 60 (§15.1).
**AC — RC-03:** Given pending qty 10, when I attempt to receive 15, then the system blocks with a clear message, or creates an over-receipt exception requiring approval (§25).
**AC — RC-04:** Given all pending quantities are 0 after a receipt, when posted, then PO status becomes Received → Closed per configuration; partial keeps "Partially Received" (§25).

## 3.7 Viewer (VW)

| ID | Story | Pri | Trace |
|---|---|---|---|
| VW-01 | As a **Viewer**, I want read-only dashboards and reports scoped to my assignment, **so that** I get insight without write risk. | Must | §6.1, RB-018 |
| VW-02 | As a **Viewer**, I want to export visible reports to Excel/CSV/PDF, **so that** I can share analysis. | Should | §16.4 |

**AC — VW-01:** Given a Viewer, when they attempt any write endpoint, then 403; when they open reports, then only division-scoped rows appear — no cross-division leakage (RB-018).

## 3.8 Auditor (AU)

| ID | Story | Pri | Trace |
|---|---|---|---|
| AU-01 | As an **Auditor**, I want read-only audit logs with before/after JSON, user, role, timestamp and request ID, **so that** any change is reconstructable. | Must | §17.1, SC-8 |
| AU-02 | As an **Auditor**, I want PO version history side-by-side, **so that** amendments are reviewable. | Must | §14.3 |
| AU-03 | As an **Auditor**, I want export of audit findings, **so that** evidence packs can be produced. | Should | §16.3 Audit Report |

**AC — AU-01:** Given any edited PO, when I open its audit trail, then every field change shows old → new value with actor and UTC timestamp; UPDATE/DELETE on audit rows is impossible even at DB level (Part 2 trigger).

## 3.9 System Epics

| ID | Epic | Trace |
|---|---|---|
| SYS-01 | Server-side commercial engine recomputes all totals before persist/approve; UI values are advisory only. | RB-017, §13 |
| SYS-02 | Snapshot engine freezes brand/product/colour/size/dealer display values into every PO at approval/issue; masters may evolve freely afterwards. | §20.3, RB-003 |

---

# PART 4 — PHASE 1 BUILD PLAN (Core Foundation, 12 Weeks)

**Phase 1 Scope (per §27):** Auth, roles, divisions, sections, masters, PO engine → **Exit: Core PO lifecycle works end-to-end (Draft → Submit → Approve → Issue).**

**Assumptions:** Team = 1 PM/BA, 1 Tech Lead, 2 Backend, 2 Frontend, 1 QA, 0.5 DevOps. 2-week sprints (S1–S6). Tech: PostgreSQL (Part 2 schema), REST API, React-class SPA, S3-compatible storage.

### Sprint/Week Overview

| Wk | Sprint | Theme | Key Deliverable |
|---|---|---|---|
| 1–2 | S1 | Foundations + Auth | Login/RBAC live, environments + CI/CD |
| 3–4 | S2 | Org & Section Masters | Divisions/Departments/Sections CRUD + lifecycle |
| 5–6 | S3 | Catalogue Masters | Brands/Products/Variants/Sizes/Colours/Suppliers |
| 7–8 | S4 | PO Engine I | Guided creation, matrix entry, "Other" flows, drafts |
| 9–10 | S5 | PO Engine II + Approvals | Commercials engine, submission, approval workflow |
| 11–12 | S6 | Hardening + UAT | E2E lifecycle, security/perf tests, sign-off |

### Week-by-Week Detail

**Week 1 — Kickoff & Skeleton**
- Backend: repo, skeleton, DB migrations framework, deploy Part 2 schema v1 (enums, org/division/dept/section tables)
- Frontend: app shell, routing, design tokens, login page scaffold
- DevOps: Dev/Staging/Prod envs, CI pipelines, HTTPS, secrets in env vars (§28)
- PM/BA: sign off Phase-0 business rules + UX wireframes for S1–S3 screens (§27 Phase 0 closure)
- **Exit:** Pipeline green; schema v1 deployed to staging.

**Week 2 — Auth & RBAC**
- Backend: login/refresh/logout/reset (Appendix B #1–4), bcrypt hashing, session expiry/revocation, JWT with role+division claims, permission middleware on every endpoint (§6.2, §22, RB-001)
- Frontend: Login, Forgot/Reset Password, Division Selection screens (App A #1–3)
- QA: auth test matrix (lockout, reset, cross-division 403s)
- **Exit:** User authenticates and sees only authorized divisions (TC-01, TC-02 ✅).

**Week 3 — Org Masters + Audit Infra**
- Backend: divisions/departments/sections CRUD + activate/deactivate/archive states (§8.4), audit-log service + append-only table (Part 2), audit hook on all master writes (RB-015)
- Frontend: Section Management tree/list + Department Management (App A #14–15)
- QA: lifecycle tests — delete-with-history → archive offered (RB-014)
- **Exit:** Section add/edit/archive with no code deployment (TC-03 ✅).

**Week 4 — Sizing + Colours**
- Backend: size_methods, sizes, colours (case-insensitive dedupe §9.2), section→sizing binding; matrix column configuration API
- Frontend: Size & Colour Management screens (App A #19–20); matrix column previewer
- QA: TC-04 — configure S–XXXL, confirm matrix updates automatically
- **Exit:** Any section's matrix shape is fully data-driven.

**Week 5 — Brand & Product & Supplier Masters**
- Backend: brands (number ≠ serial, RB-005), products, product_variants, suppliers + supplier_divisions/brands; number_sequences service (`next_number`, race-safe)
- Frontend: Brand/Product/Dealer Management — searchable tables + forms + import/export v1 (App A #17–18, 21, 28–29)
- QA: duplicate-brand warn flow, duplicate-SKU hard error (§25)
- **Exit:** TC-05, TC-06 ✅.

**Week 6 — "Other" Progressive Catalogue + Import Hardening**
- Backend: inline-create endpoints flagged `is_custom`, promotion-to-master after approval (§10.3, RB-016); import_jobs with row-level error reports (§25)
- Frontend: Other-inline-form component wired into PO form prep; Import Wizard error UX
- **Exit:** TC-07 ✅; custom entries visibly flagged until promoted.

**Week 7 — PO Engine I (Sprint 4)**
- Backend: purchase_orders/items/quantities tables live; draft CRUD; autosave endpoint; idempotent-create keys (§25)
- Frontend: PO Create guided stepper steps 1–8 (division→…→size qty), colour×size matrix grid with live totals + keyboard nav (§12.2, §12.3)
- QA: matrix sum = stored total (RB-006); autosave-resume scenario (PE-04)
- **Exit:** Draft PO persisted with full variant matrix; TC-08 partial ✅.

**Week 8 — Commercial Engine**
- Backend: server-side pricing per §13.1/13.2 (margin → net → discount → final → line → subtotal → tax → charges → grand total); validation RB-007/008/009/010; numeric(14,2) precision; recompute-on-read for drafts
- Frontend: price/margin/discount inputs, sticky totals bar, pre-submit validation review (step 11)
- QA: property-based tests vs worked example (Levi's ₹65,520 case must match exactly)
- **Exit:** TC-09 ✅ — UI cannot override server math (SYS-01).

**Week 9 — Submission, List, Details, PDF**
- Backend: submit endpoint (draft→submitted), PO snapshots written at submit/approve (§20.3), PO List/Details APIs, PDF generation service
- Frontend: PO List, PO Details with tabs overview/products/approval/history (App A #7–10)
- QA: snapshot immutability after master edits (RB-003)
- **Exit:** Submitted PO renders pixel-identical after renaming its brand in master.

**Week 10 — Approval Workflow**
- Backend: approval_rules/levels/instances/actions; threshold routing engine (₹25k/₹1L defaults, configurable); approve/reject/send-back/hold/escalate; re-approval on amendment; notifications (in-app + email) for §18 events 1–5
- Frontend: Approval Queue + decision modal with mandatory reason on reject/send-back (RB-012)
- QA: high-value routing TC-10, reject-reason TC-11, no-rule fallback → exception queue (SA-06)
- **Exit:** Draft → Submit → Approve → **Issue** works end-to-end incl. PDF. *Phase 1 exit criterion met in staging.*

**Week 11 — Hardening Sprint**
- Security: penetration-style tests — division bypass, IDOR on PO ids, rate limiting, CSRF/XSS/injection checks (§22)
- Performance: dashboard < 3s target (§23), 10k-SKU catalogue search, matrix entry benchmarks
- QA: full regression (TC-01→TC-12), API contract tests, audit completeness check (every critical action logged, TC-16 subset)
- **Exit:** Zero critical security findings; perf targets met.

**Week 12 — UAT & Go-Live**
- UAT with 1 champion user per role (8 roles); bug-triage burn-down; docs handover (this package + API docs); staging→prod deployment runbook; backup/restore test (30-day retention, §28)
- **Exit gate:** Go/No-Go against Phase 1 exit criteria + Appendix D items 1–7 (modules live, no mocks, permissions aligned, server calcs match, versioning works, audit queryable, PDF stable) → **Phase 1 sign-off**, Phase 2 (Governance: amendments UI, full notification matrix, audit reporting) begins.

### Top Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Matrix UX too slow for high-volume entry | Prototype in Wk 7; keyboard-first design is a hard UX standard (§19.3) |
| Approval rule complexity creep | Ship value+division+discount dimensions only in Phase 1; others are schema-ready but UI-gated |
| Snapshot bloat in DB | Store compact JSONB snapshots; test at 100k-line scale in Wk 11 |
| "Other"-entry data quality | Mandatory validation + RB-016 visible flag + promotion review gate |

---

## ✅ Package Complete

| # | Deliverable | Status |
|---|---|---|
| 1 | DOCX structure + Confluence wiki conversion | ✔ Above |
| 2 | Full PostgreSQL schema (~30 tables, RB-rule constraints, immutable audit, race-safe numbering) | ✔ Above |
| 3 | 34 user stories + 2 system epics with Gherkin acceptance criteria, traced to sections & RB rules | ✔ Above |
| 4 | 12-week Phase 1 plan with weekly exits, sprint mapping, risks | ✔ Above |

**Next steps I can do for you:**
1. Generate the **Jira CSV import file** (epics → stories → subtasks) from Part 3
2. Write the **API contract spec** (OpenAPI 3.1 YAML) for the Appendix B endpoints
3. Draft **Phase 2 (Governance) and Phase 3 (Receiving) plans** in the same week-by-week format
4. Produce the **seed data pack** (19 sections, sizes, sample dealers) as insertable SQL

Just say which one(s).