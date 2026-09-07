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
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
-- Apply to all tables having updated_at, e.g.:
CREATE TRIGGER trg_divisions_upd BEFORE UPDATE ON divisions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_po_upd BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- (repeat per table)