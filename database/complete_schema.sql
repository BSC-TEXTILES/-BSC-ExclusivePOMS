-- ============================================================
-- POMS — COMPLETE SQL SCRIPT (fresh install, one shot)
-- Contains: schema.sql (v1.0 core) + migrations 001-013
-- Compatible with: Supabase (PostgreSQL 15+), local PostgreSQL
-- Usage: Supabase SQL Editor or:
--   psql -h localhost -p 5432 -U postgres -d poms -f complete_schema.sql
--   (then: cd backend && npm run seed)
-- Fully idempotent — safe to re-run on existing databases.
-- ============================================================

-- ============================================================
-- PURCHASE ORDER MANAGEMENT SYSTEM — CORE SCHEMA v1.0
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- ENUMS (wrapped in DO blocks for idempotency) ----------
DO $$ BEGIN
  CREATE TYPE entity_status AS ENUM ('active','inactive','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE po_status AS ENUM ('draft','submitted','under_review','approved',
                                   'issued','partially_received','received',
                                   'closed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE approval_action AS ENUM ('submitted','approved','rejected',
                                        'send_back','hold','escalated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE discount_type AS ENUM ('percent','flat');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_terms AS ENUM ('advance','net_30','net_60',
                                      'against_delivery','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE charge_type AS ENUM ('freight','packing','transport',
                                    'installation','assembly','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE receipt_status AS ENUM ('draft','posted','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE inventory_type AS ENUM ('receipt','adjustment','issue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notify_channel AS ENUM ('in_app','email','sms','whatsapp');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM ('pending','processing','completed',
                                   'failed','partial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_discount_scope AS ENUM ('order');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- ORGANIZATION / SCOPE ----------
CREATE TABLE IF NOT EXISTS organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS divisions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id),
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  location    text,  contact_phone text,  contact_email text,
  status      entity_status NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS departments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL,
  name        text NOT NULL,
  division_id uuid REFERENCES divisions(id),
  is_global   boolean NOT NULL DEFAULT false,
  status      entity_status NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_dept UNIQUE NULLS NOT DISTINCT (division_id, code)
);

-- ---------- SECTION / CATALOGUE HIERARCHY ----------
CREATE TABLE IF NOT EXISTS size_methods (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code      text NOT NULL UNIQUE,
  name      text NOT NULL,
  is_custom boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS sections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL,
  name            text NOT NULL,
  department_id   uuid NOT NULL REFERENCES departments(id),
  parent_group    text,
  sizing_method_id uuid NOT NULL REFERENCES size_methods(id),
  display_order   integer NOT NULL DEFAULT 0,
  attributes      jsonb NOT NULL DEFAULT '{}',
  icon_url        text,
  status          entity_status NOT NULL DEFAULT 'active',
  created_by      uuid,  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_section UNIQUE NULLS NOT DISTINCT (department_id, code)
);
CREATE INDEX IF NOT EXISTS idx_sections_status ON sections(department_id, status);

CREATE TABLE IF NOT EXISTS section_attributes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id     uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  attribute_key  text NOT NULL,  attribute_label text NOT NULL,
  data_type      text NOT NULL DEFAULT 'text',
  options        jsonb,  is_required boolean NOT NULL DEFAULT false,
  display_order  integer NOT NULL DEFAULT 0,
  UNIQUE (section_id, attribute_key)
);

CREATE TABLE IF NOT EXISTS categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id  uuid NOT NULL REFERENCES sections(id),
  parent_category_id uuid REFERENCES categories(id),
  code        text NOT NULL,  name text NOT NULL,
  status      entity_status NOT NULL DEFAULT 'active',
  CONSTRAINT uq_cat UNIQUE NULLS NOT DISTINCT (section_id, parent_category_id, code)
);

CREATE TABLE IF NOT EXISTS sizes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  size_method_id uuid NOT NULL REFERENCES size_methods(id),
  label          text NOT NULL,
  numeric_value  numeric,
  display_order  integer NOT NULL DEFAULT 0,
  UNIQUE (size_method_id, label)
);

CREATE TABLE IF NOT EXISTS colours (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE,
  name         text NOT NULL,
  colour_family text,  swatch_hex char(7),
  is_custom    boolean NOT NULL DEFAULT false,
  status       entity_status NOT NULL DEFAULT 'active'
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_colour_name_ci ON colours (lower(name));

-- ---------- BRAND / PRODUCT ----------
CREATE TABLE IF NOT EXISTS brands (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_number  text NOT NULL UNIQUE,
  brand_serial  text NOT NULL UNIQUE,
  brand_name    text NOT NULL,
  brand_code    text,
  manufacturer  text,
  valid_from    date,  valid_to date,
  status        entity_status NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_serial text NOT NULL UNIQUE,
  sku            text NOT NULL,
  barcode        text UNIQUE,
  name           text NOT NULL,  description text,
  brand_id       uuid NOT NULL REFERENCES brands(id),
  department_id  uuid REFERENCES departments(id),
  section_id     uuid NOT NULL REFERENCES sections(id),
  category_id    uuid REFERENCES categories(id),
  subcategory_id uuid REFERENCES categories(id),
  attributes     jsonb NOT NULL DEFAULT '{}',
  hsn_sac        text,  tax_category text,
  status         entity_status NOT NULL DEFAULT 'active',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_sku ON products (sku);

CREATE TABLE IF NOT EXISTS product_variants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size_id    uuid REFERENCES sizes(id),
  colour_id  uuid REFERENCES colours(id),
  style      text,
  CONSTRAINT uq_variant UNIQUE NULLS NOT DISTINCT (product_id, size_id, colour_id, style)
);

-- ---------- SUPPLIERS / DEALERS ----------
CREATE TABLE IF NOT EXISTS suppliers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text NOT NULL UNIQUE,
  company_name   text NOT NULL,  contact_person text,
  mobile         text,  email text,  address text,
  gstin          text,  pan text,
  payment_terms  payment_terms NOT NULL DEFAULT 'net_30',
  preferred_brands jsonb,  internal_rating numeric(3,1),
  bank_details   jsonb,
  notes          text,
  status         entity_status NOT NULL DEFAULT 'active',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_divisions (
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  division_id uuid NOT NULL REFERENCES divisions(id),
  PRIMARY KEY (supplier_id, division_id)
);

CREATE TABLE IF NOT EXISTS supplier_brands (
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  brand_id    uuid NOT NULL REFERENCES brands(id),
  PRIMARY KEY (supplier_id, brand_id)
);

-- ---------- USERS / RBAC ----------
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  username      text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name     text NOT NULL,  phone text,
  mfa_enabled   boolean NOT NULL DEFAULT false,
  force_password_reset boolean NOT NULL DEFAULT false,
  failed_attempts integer NOT NULL DEFAULT 0, locked_until timestamptz,
  last_login_at timestamptz,
  status        entity_status NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,  description text
);

CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,    module text NOT NULL,  description text
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS user_divisions (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  division_id uuid NOT NULL REFERENCES divisions(id),
  PRIMARY KEY (user_id, division_id)
);

CREATE TABLE IF NOT EXISTS user_sections (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES sections(id),
  PRIMARY KEY (user_id, section_id)
);

-- ---------- NUMBER SEQUENCES ----------
CREATE TABLE IF NOT EXISTS number_sequences (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  text NOT NULL,
  division_id  uuid REFERENCES divisions(id),
  seq_year     integer NOT NULL,
  prefix       text NOT NULL,
  current_value bigint NOT NULL DEFAULT 0,
  CONSTRAINT uq_seq UNIQUE NULLS NOT DISTINCT (entity_type, division_id, seq_year)
);

CREATE OR REPLACE FUNCTION next_number(p_entity text, p_div uuid, p_year int)
RETURNS text LANGUAGE sql AS $$
  INSERT INTO number_sequences (entity_type, division_id, seq_year, prefix, current_value)
  VALUES (p_entity, p_div, p_year, p_entity || '-' || p_year || '-', 1)
  ON CONFLICT (entity_type, division_id, seq_year)
  DO UPDATE SET current_value = number_sequences.current_value + 1
  RETURNING prefix || lpad(current_value::text, 5, '0');
 $$;

-- ---------- PURCHASE ORDERS ----------
CREATE TABLE IF NOT EXISTS purchase_orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number      text NOT NULL UNIQUE,
  version        integer NOT NULL DEFAULT 1,
  parent_po_id   uuid REFERENCES purchase_orders(id),
  division_id    uuid NOT NULL REFERENCES divisions(id),
  department_id  uuid NOT NULL REFERENCES departments(id),
  section_id     uuid NOT NULL REFERENCES sections(id),
  supplier_id    uuid NOT NULL REFERENCES suppliers(id),
  created_by     uuid NOT NULL REFERENCES users(id),
  po_date        date NOT NULL DEFAULT current_date,
  status         po_status NOT NULL DEFAULT 'draft',
  payment_terms  payment_terms,  delivery_terms text,
  currency       char(3) NOT NULL DEFAULT 'INR',
  tax_scheme     text,
  expected_delivery_date date,
  subtotal       numeric(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  order_discount_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (order_discount_amount >= 0),
  tax_amount     numeric(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  charges_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (charges_amount >= 0),
  grand_total    numeric(14,2) NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
  header_snapshot jsonb,
  remarks        text,
  qr_code        text,
  idempotency_key uuid,
  submitted_at timestamptz, approved_at timestamptz,
  issued_at    timestamptz, closed_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_po_div_status ON purchase_orders (division_id, status);
CREATE INDEX IF NOT EXISTS idx_po_supplier   ON purchase_orders (supplier_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_po_idempotency_key
  ON purchase_orders (idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id          uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  line_no        integer NOT NULL,
  product_id     uuid NOT NULL REFERENCES products(id),
  product_snapshot jsonb NOT NULL,
  brand_snapshot   jsonb NOT NULL,
  colour_id      uuid REFERENCES colours(id),
  colour_snapshot  jsonb,
  description    text,
  purchase_price numeric(12,2) NOT NULL CHECK (purchase_price >= 0),
  margin_percent numeric(5,2)  NOT NULL DEFAULT 0 CHECK (margin_percent >= 0),
  margin_amount  numeric(12,2) NOT NULL DEFAULT 0,
  net_value_per_unit numeric(12,2) NOT NULL DEFAULT 0,
  discount_type  discount_type,  discount_value numeric(12,2),
  discount_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  final_value_per_unit numeric(12,2) NOT NULL DEFAULT 0,
  total_quantity integer NOT NULL CHECK (total_quantity > 0),
  line_total     numeric(14,2) NOT NULL DEFAULT 0 CHECK (line_total >= 0),
  UNIQUE (po_id, line_no)
);

CREATE TABLE IF NOT EXISTS purchase_order_quantities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_item_id   uuid NOT NULL REFERENCES purchase_order_items(id) ON DELETE CASCADE,
  size_id      uuid REFERENCES sizes(id),
  size_label   text NOT NULL,
  quantity     integer NOT NULL CHECK (quantity >= 0),
  UNIQUE (po_item_id, size_id)
);

CREATE TABLE IF NOT EXISTS purchase_order_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  discount_type discount_type NOT NULL,
  discount_value numeric(12,2) NOT NULL CHECK (discount_value >= 0),
  discount_amount numeric(14,2) NOT NULL CHECK (discount_amount >= 0),
  reason text
);

CREATE TABLE IF NOT EXISTS purchase_order_taxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  po_item_id uuid REFERENCES purchase_order_items(id),
  tax_name text NOT NULL,
  rate numeric(5,2) NOT NULL,
  taxable_base numeric(14,2) NOT NULL,
  tax_amount numeric(14,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_order_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  charge_type charge_type NOT NULL,
  description text,  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  is_supplier_billed boolean NOT NULL DEFAULT true
);

-- ---------- APPROVALS ----------
CREATE TABLE IF NOT EXISTS approval_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,  priority integer NOT NULL DEFAULT 100,
  min_value numeric(14,2) DEFAULT 0,  max_value numeric(14,2),
  division_id uuid REFERENCES divisions(id),
  department_id uuid REFERENCES departments(id),
  section_id uuid REFERENCES sections(id),
  supplier_id uuid REFERENCES suppliers(id),
  category_id uuid REFERENCES categories(id),
  min_discount_percent numeric(5,2),
  is_active boolean NOT NULL DEFAULT true,
  CHECK (max_value IS NULL OR max_value >= min_value)
);

CREATE TABLE IF NOT EXISTS approval_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES approval_rules(id) ON DELETE CASCADE,
  level_no integer NOT NULL,
  approver_role_id uuid REFERENCES roles(id),
  approver_user_id uuid REFERENCES users(id),
  auto_escalate_after_hours integer,
  UNIQUE (rule_id, level_no)
);

CREATE TABLE IF NOT EXISTS approval_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES purchase_orders(id),
  rule_id uuid REFERENCES approval_rules(id),
  current_level integer NOT NULL DEFAULT 1,
  status po_status NOT NULL DEFAULT 'under_review',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS approval_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES approval_instances(id),
  level_no integer NOT NULL,
  approver_id uuid NOT NULL REFERENCES users(id),
  action approval_action NOT NULL,
  comments text,
  acted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rejection_needs_reason CHECK (
    action IN ('submitted','approved','escalated') OR comments IS NOT NULL)
);

-- ---------- RECEIVING ----------
CREATE TABLE IF NOT EXISTS receipts (
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

CREATE TABLE IF NOT EXISTS receipt_items (
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

-- ---------- INVENTORY ----------
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id uuid NOT NULL REFERENCES divisions(id),
  product_id uuid NOT NULL REFERENCES products(id),
  size_id uuid REFERENCES sizes(id),
  receipt_item_id uuid REFERENCES receipt_items(id),
  txn_type inventory_type NOT NULL,
  quantity integer NOT NULL,
  unit_cost numeric(12,2),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_lookup ON inventory_transactions (division_id, product_id, size_id);

-- ---------- CROSS-CUTTING ----------
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  channel notify_channel NOT NULL DEFAULT 'in_app',
  event_type text NOT NULL,
  entity_type text, entity_id uuid,
  title text NOT NULL, body text,
  is_read boolean NOT NULL DEFAULT false,
  sent_at timestamptz NOT NULL DEFAULT now(),  read_at timestamptz
);

CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL, entity_id uuid NOT NULL,
  file_name text NOT NULL, mime_type text NOT NULL,
  size_bytes bigint NOT NULL, storage_key text NOT NULL,
  checksum text, uploaded_by uuid NOT NULL REFERENCES users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attach_entity ON attachments (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL, entity_id uuid NOT NULL,
  author_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL,
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','approval')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid, user_role text,
  division_id uuid, section_id uuid,
  action_type text NOT NULL,
  entity_type text NOT NULL, entity_id uuid NOT NULL,
  before_value jsonb, after_value jsonb,
  reason text, request_id text, ip_address inet
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs (entity_type, entity_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_audit_user   ON audit_logs (user_id, occurred_at);

-- Immutability trigger for audit_logs
CREATE OR REPLACE FUNCTION forbid_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END $$;

DO $$ BEGIN
  CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION forbid_audit_mutation();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY, value jsonb NOT NULL, description text,
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  storage_key text NOT NULL,
  status job_status NOT NULL DEFAULT 'pending',
  total_rows integer, valid_rows integer, error_rows integer,
  error_report jsonb,
  requested_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL, filters jsonb,
  format text NOT NULL DEFAULT 'xlsx' CHECK (format IN ('xlsx','csv','pdf')),
  status job_status NOT NULL DEFAULT 'pending',
  storage_key text,
  requested_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);

-- ---------- HELPER: updated_at trigger ----------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_divisions_upd BEFORE UPDATE ON divisions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_po_upd BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- MIGRATION 001 — Team Chat
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id uuid REFERENCES divisions(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  body        text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_div_time ON chat_messages (division_id, created_at DESC);

-- ============================================================
-- MIGRATION 002 — Workspace UI upgrade
-- ============================================================
CREATE TABLE IF NOT EXISTS product_images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  file_name   text NOT NULL,
  mime_type   text NOT NULL,
  size_bytes  bigint NOT NULL,
  storage_key text NOT NULL,
  is_primary  boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  uploaded_by uuid REFERENCES users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id, is_primary DESC, sort_order);

CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id, uploaded_at DESC);

ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS designation text;

INSERT INTO settings (key, value, description)
VALUES ('uploads.policy', '{"maxSizeMb": 200, "allowed": "*"}'::jsonb,
        'Universal attachment policy: every file type accepted up to the size cap')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- MIGRATION 003: Men's Apparel Collection Management
-- ============================================================
CREATE TABLE IF NOT EXISTS manufacturers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text NOT NULL UNIQUE,
  name           text NOT NULL,
  contact_person text,
  phone          text,
  email          text,
  address        text,
  city           text,
  state          text,
  country        text DEFAULT 'India',
  gstin          text,
  notes          text,
  status         entity_status NOT NULL DEFAULT 'active',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  CREATE TRIGGER trg_manufacturers_upd BEFORE UPDATE ON manufacturers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS product_manufacturers (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  manufacturer_id uuid NOT NULL REFERENCES manufacturers(id),
  PRIMARY KEY (product_id, manufacturer_id)
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS material text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS pattern text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS fit text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS neck_type text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sleeve_type text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS season text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS gender text DEFAULT 'men';
ALTER TABLE products ADD COLUMN IF NOT EXISTS collection text DEFAULT 'mens_wear';
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_price numeric(12,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_price numeric(12,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS internal_ref text;

-- Generated columns (wrapped for idempotency)
DO $$ BEGIN
  ALTER TABLE products ADD COLUMN profit_amount numeric(12,2)
    GENERATED ALWAYS AS (selling_price - purchase_price) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE products ADD COLUMN profit_margin numeric(5,2)
    GENERATED ALWAYS AS (CASE WHEN purchase_price > 0
      THEN ROUND(((selling_price - purchase_price) / purchase_price) * 100, 2)
      ELSE 0 END) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_products_gender ON products(gender);
CREATE INDEX IF NOT EXISTS idx_products_collection ON products(collection);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_material ON products(material);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

INSERT INTO roles (code, name) VALUES
  ('admin', 'Admin'),
  ('men_collection_manager', 'Men''s Collection Manager'),
  ('purchaser_manager', 'Purchaser Manager')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, module, description) VALUES
  ('products.view', 'product', 'View products'),
  ('products.create', 'product', 'Create products'),
  ('products.edit', 'product', 'Edit products'),
  ('products.delete', 'product', 'Delete/archive products'),
  ('categories.manage', 'category', 'Manage categories'),
  ('brands.manage', 'brand', 'Manage brands'),
  ('manufacturers.manage', 'manufacturer', 'Manage manufacturers'),
  ('colors.manage', 'color', 'Manage colors'),
  ('sizes.manage', 'size', 'Manage sizes'),
  ('attributes.manage', 'attribute', 'Manage product attributes'),
  ('pricing.view', 'pricing', 'View pricing information'),
  ('pricing.manage', 'pricing', 'Manage pricing'),
  ('orders.create', 'order', 'Create purchase orders'),
  ('orders.view', 'order', 'View purchase orders'),
  ('orders.manage', 'order', 'Manage order statuses'),
  ('reports.export', 'report', 'Export reports as PDF/CSV'),
  ('settings.manage', 'settings', 'Manage system settings')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'men_collection_manager'
  AND p.code IN ('products.view', 'products.create', 'products.edit',
    'categories.manage', 'brands.manage', 'manufacturers.manage',
    'colors.manage', 'sizes.manage', 'attributes.manage',
    'pricing.view', 'pricing.manage', 'reports.view', 'reports.export')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'purchaser_manager'
  AND p.code IN ('products.view', 'orders.create', 'orders.view',
    'reports.view', 'reports.export')
ON CONFLICT DO NOTHING;

INSERT INTO settings (key, value, description) VALUES
  ('currency', '"INR"', 'Default currency'),
  ('currency_symbol', '"₹"', 'Currency symbol'),
  ('app_name', '"BSC Exclusive POMS"', 'Application name'),
  ('app_version', '"1.0.0"', 'Version')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- MIGRATION 004: Apparel product junctions
-- ============================================================
CREATE TABLE IF NOT EXISTS product_sizes (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size_id uuid NOT NULL REFERENCES sizes(id),
  PRIMARY KEY (product_id, size_id)
);
CREATE TABLE IF NOT EXISTS product_colours (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  colour_id uuid NOT NULL REFERENCES colours(id),
  PRIMARY KEY (product_id, colour_id)
);
CREATE INDEX IF NOT EXISTS idx_product_sizes_size ON product_sizes(size_id);
CREATE INDEX IF NOT EXISTS idx_product_colours_colour ON product_colours(colour_id);

-- ============================================================
-- MIGRATION 005: Training / Media Video Library
-- ============================================================
CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  module text,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  storage_key text NOT NULL,
  thumbnail_key text,
  duration_seconds integer,
  status entity_status NOT NULL DEFAULT 'active',
  uploaded_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category, status);
CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created_at DESC);
DO $$ BEGIN
  CREATE TRIGGER trg_videos_upd BEFORE UPDATE ON videos
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO permissions (code, module, description) VALUES
  ('videos.view', 'video', 'View video library'),
  ('videos.manage', 'video', 'Upload/edit/archive videos')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('super_admin', 'admin', 'domain_admin', 'men_collection_manager')
  AND p.code IN ('videos.view', 'videos.manage')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('super_admin', 'admin', 'domain_admin',
  'purchase_manager', 'purchase_executive', 'viewer')
  AND p.code = 'videos.view'
ON CONFLICT DO NOTHING;

-- ============================================================
-- MIGRATION 006: Locations, Brand assets, Product types, Colour images
-- ============================================================
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  address text, city text, state text,
  country text DEFAULT 'India',
  latitude numeric(10,7), longitude numeric(10,7),
  contact_person text, phone text, notes text,
  status entity_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  CREATE TRIGGER trg_locations_upd BEFORE UPDATE ON locations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE purchase_orders ADD COLUMN location_id uuid REFERENCES locations(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE brands ADD COLUMN logo_url text; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE brands ADD COLUMN image_url text; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE brands ADD COLUMN description text; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE colours ADD COLUMN image_url text; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE colours ADD COLUMN description text; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS product_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES sections(id),
  category_id uuid REFERENCES categories(id),
  subcategory_id uuid REFERENCES categories(id),
  code text NOT NULL,
  name text NOT NULL,
  status entity_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_type UNIQUE (section_id, category_id, subcategory_id, code)
);
DO $$ BEGIN
  CREATE TRIGGER trg_product_types_upd BEFORE UPDATE ON product_types
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE products ADD COLUMN product_type_id uuid REFERENCES product_types(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE products ADD COLUMN manual_size text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

INSERT INTO locations (code, name, address, city, state, country, latitude, longitude) VALUES
  ('DVG', 'Davangere', 'Davangere, Karnataka', 'Davangere', 'Karnataka', 'India', 14.4673600, 74.9966800),
  ('SMG', 'Shivamogga', 'Shivamogga, Karnataka', 'Shivamogga', 'Karnataka', 'India', 13.9299300, 75.5681000),
  ('BGV', 'Bhigervi', 'Bhigervi, Karnataka', 'Bhigervi', 'Karnataka', 'India', NULL, NULL)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'super_admin'
  AND p.code IN ('products.view', 'products.create', 'products.edit',
    'products.delete', 'categories.manage', 'brands.manage',
    'manufacturers.manage', 'colors.manage', 'sizes.manage',
    'attributes.manage', 'pricing.view', 'pricing.manage',
    'orders.create', 'orders.view', 'orders.manage',
    'reports.export', 'settings.manage')
ON CONFLICT DO NOTHING;

-- ============================================================
-- MIGRATION 007: Brand logo (already in 006)
-- ============================================================

-- ============================================================
-- MIGRATION 008: Collections, Dealers, Company Settings
-- ============================================================
CREATE TABLE IF NOT EXISTS collections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,
  name          text NOT NULL,
  description   text,
  display_order integer NOT NULL DEFAULT 0,
  status        entity_status NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_collections (
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, collection_id)
);

CREATE TABLE IF NOT EXISTS brand_collections (
  brand_id      uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  PRIMARY KEY (brand_id, collection_id)
);

CREATE TABLE IF NOT EXISTS dealers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  company_name    text NOT NULL,
  contact_person  text,
  phone           text,
  email           text,
  address         text,
  city            text,
  state           text,
  gstin           text,
  pan             text,
  payment_terms   payment_terms NOT NULL DEFAULT 'net_30',
  notes           text,
  status          entity_status NOT NULL DEFAULT 'active',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_settings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name  text NOT NULL DEFAULT 'BSC Exclusive Pvt. Ltd.',
  logo_url      text,
  address       text,
  city          text,
  state         text,
  pin_code      text,
  phone         text,
  email         text,
  gst_number    text,
  website       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE TRIGGER trg_collections_upd BEFORE UPDATE ON collections
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_dealers_upd BEFORE UPDATE ON dealers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_company_settings_upd BEFORE UPDATE ON company_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO collections (code, name, display_order) VALUES
  ('mens_wear',        'Men',               1),
  ('womens_wear',      'Women',             2),
  ('kids_wear',        'Kids',              3),
  ('home_furnishing',  'Home Furnishing',   4),
  ('jewellery',        'Jewellery',         5),
  ('wedding',          'Wedding Collection',6),
  ('suits',            'Suits',             7),
  ('dothis_dozolo',    'Dothis / Dozolo',   8),
  ('towels',           'Towels',            9),
  ('other',            'Other Collections', 10)
ON CONFLICT (code) DO NOTHING;

INSERT INTO company_settings (company_name, address, city, state, phone, email)
VALUES ('BSC Exclusive Pvt. Ltd.', 'Davanagere, Karnataka', 'Davanagere', 'Karnataka', '+91-9876543210', 'info@bscexclusive.in')
ON CONFLICT DO NOTHING;

INSERT INTO permissions (code, module, description) VALUES
  ('collections.view',   'collections',   'View collections'),
  ('collections.manage', 'collections',   'Manage collections'),
  ('dealers.view',       'dealers',       'View dealers'),
  ('dealers.manage',     'dealers',       'Manage dealers'),
  ('company.view',       'company',       'View company settings'),
  ('company.manage',     'company',       'Manage company settings')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('admin', 'super_admin')
  AND p.code IN ('collections.view','collections.manage',
    'dealers.view','dealers.manage','company.view','company.manage')
ON CONFLICT DO NOTHING;

-- ============================================================
-- MIGRATION 009: Remove non-admin users (data cleanup, skip on fresh install)
-- ============================================================

-- ============================================================
-- MIGRATION 010: File Attachments
-- ============================================================
CREATE TABLE IF NOT EXISTS file_attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name   text NOT NULL,
  mime_type   text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes  bigint NOT NULL,
  storage_key text NOT NULL,
  description text,
  uploaded_by uuid NOT NULL REFERENCES users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_file_attachments_uploaded ON file_attachments (uploaded_at DESC);

-- ============================================================
-- MIGRATION 011: Account Manager role + Vladimir user
-- ============================================================
INSERT INTO roles (code, name, description)
VALUES ('account_manager', 'Account & Category Manager',
        'Creates user accounts and manages category sections.')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.code = 'account_manager'
   AND p.code IN ('users.manage', 'masters.view', 'masters.manage')
ON CONFLICT DO NOTHING;

INSERT INTO users (email, username, password_hash, full_name, status, force_password_reset)
VALUES ('vladimir@bsc.local', 'vladimir',
        '$2a$10$0mdtUMxM3J2Ae8CpjtbKpu0dOd32FsPjFD9ql2DeFeVMsOcxdgcCe',
        'Vladimir', 'active', false)
ON CONFLICT (email) DO UPDATE
   SET password_hash = EXCLUDED.password_hash,
       username      = EXCLUDED.username,
       full_name     = EXCLUDED.full_name,
       status        = 'active',
       force_password_reset = true;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
  FROM users u, roles r
 WHERE u.email = 'vladimir@bsc.local' AND r.code = 'account_manager'
ON CONFLICT DO NOTHING;

-- ============================================================
-- MIGRATION 012: User Sessions, Profile Tracking, Security Settings
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_updated_at timestamptz;

CREATE TABLE IF NOT EXISTS user_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tab_id        text NOT NULL,
  login_at      timestamptz NOT NULL DEFAULT now(),
  logout_at     timestamptz,
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  ip_address    text,
  user_agent    text,
  device_type   text,
  browser       text,
  os            text,
  screen        text,
  current_route text,
  current_title text,
  latitude      double precision,
  longitude     double precision,
  location_accuracy double precision,
  devtools_seen boolean NOT NULL DEFAULT false,
  ended_reason  text,
  CONSTRAINT uq_user_session_tab UNIQUE (user_id, tab_id)
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_seen ON user_sessions(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);

INSERT INTO settings (key, value, description)
VALUES ('security', '{"devtoolsBlock": true}'::jsonb,
        'DevTools blocking — when on, opening browser developer tools blocks login and ends the session')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- MIGRATION 013: Performance Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_audit_occurred ON audit_logs (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipt_items_po_item ON receipt_items (po_item_id);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items (po_id);
CREATE INDEX IF NOT EXISTS idx_po_created ON purchase_orders (created_at DESC);
