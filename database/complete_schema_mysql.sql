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


-- ---------- ENUMS (wrapped in DO blocks for idempotency) ----------






















-- ---------- ORGANIZATION / SCOPE ----------
CREATE TABLE IF NOT EXISTS organizations (
  id          VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name        VARCHAR(191) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS divisions (
  id          VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  org_id      VARCHAR(36) NOT NULL REFERENCES organizations(id),
  code        VARCHAR(191) NOT NULL UNIQUE,
  name        VARCHAR(191) NOT NULL,
  location    text,  contact_phone text,  contact_email text,
  status      VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS departments (
  id          VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  code        VARCHAR(191) NOT NULL,
  name        VARCHAR(191) NOT NULL,
  division_id VARCHAR(36) REFERENCES divisions(id),
  is_global   TINYINT(1) NOT NULL DEFAULT 0,
  status      VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_dept UNIQUE  (division_id, code)
);

-- ---------- SECTION / CATALOGUE HIERARCHY ----------
CREATE TABLE IF NOT EXISTS size_methods (
  id        VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  code      VARCHAR(191) NOT NULL UNIQUE,
  name      VARCHAR(191) NOT NULL,
  is_custom TINYINT(1) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sections (
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  code            VARCHAR(191) NOT NULL,
  name            VARCHAR(191) NOT NULL,
  department_id   VARCHAR(36) NOT NULL REFERENCES departments(id),
  parent_group    text,
  sizing_method_id VARCHAR(36) NOT NULL REFERENCES size_methods(id),
  display_order   integer NOT NULL DEFAULT 0,
  attributes      JSON,
  icon_url        text,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  created_by      VARCHAR(36),  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_section UNIQUE  (department_id, code)
);
CREATE INDEX idx_sections_status ON sections(department_id, status);

CREATE TABLE IF NOT EXISTS section_attributes (
  id             VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  section_id     VARCHAR(36) NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  attribute_key  VARCHAR(191) NOT NULL,  attribute_label text NOT NULL,
  data_type      VARCHAR(191) NOT NULL DEFAULT 'text',
  options        JSON,  is_required TINYINT(1) NOT NULL DEFAULT 0,
  display_order  integer NOT NULL DEFAULT 0,
  UNIQUE (section_id, attribute_key)
);

CREATE TABLE IF NOT EXISTS categories (
  id          VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  section_id  VARCHAR(36) NOT NULL REFERENCES sections(id),
  parent_category_id VARCHAR(36) REFERENCES categories(id),
  code        VARCHAR(191) NOT NULL,  name VARCHAR(191) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'active',
  CONSTRAINT uq_cat UNIQUE  (section_id, parent_category_id, code)
);

CREATE TABLE IF NOT EXISTS sizes (
  id             VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  size_method_id VARCHAR(36) NOT NULL REFERENCES size_methods(id),
  label          VARCHAR(191) NOT NULL,
  numeric_value  numeric,
  display_order  integer NOT NULL DEFAULT 0,
  UNIQUE (size_method_id, label)
);

CREATE TABLE IF NOT EXISTS colours (
  id           VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  code         VARCHAR(191) NOT NULL UNIQUE,
  name         VARCHAR(191) NOT NULL,
  colour_family VARCHAR(191),  swatch_hex char(7),
  is_custom    TINYINT(1) NOT NULL DEFAULT 0,
  status       VARCHAR(20) NOT NULL DEFAULT 'active'
);
CREATE UNIQUE INDEX uq_colour_name_ci ON colours (name);

-- ---------- BRAND / PRODUCT ----------
CREATE TABLE IF NOT EXISTS brands (
  id            VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  brand_number  VARCHAR(191) NOT NULL UNIQUE,
  brand_serial  VARCHAR(191) NOT NULL UNIQUE,
  brand_name    text NOT NULL,
  brand_code    VARCHAR(191),
  manufacturer  text,
  valid_from    date,  valid_to date,
  status        VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id             VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  product_serial VARCHAR(191) NOT NULL UNIQUE,
  sku            VARCHAR(191) NOT NULL,
  barcode        VARCHAR(191) UNIQUE,
  name           VARCHAR(191) NOT NULL,  description text,
  brand_id       VARCHAR(36) NOT NULL REFERENCES brands(id),
  department_id  VARCHAR(36) REFERENCES departments(id),
  section_id     VARCHAR(36) NOT NULL REFERENCES sections(id),
  category_id    VARCHAR(36) REFERENCES categories(id),
  subcategory_id VARCHAR(36) REFERENCES categories(id),
  attributes     JSON,
  hsn_sac        VARCHAR(191),  tax_category text,
  status         VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX uq_product_sku ON products (sku);

CREATE TABLE IF NOT EXISTS product_variants (
  id         VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  product_id VARCHAR(36) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size_id    VARCHAR(36) REFERENCES sizes(id),
  colour_id  VARCHAR(36) REFERENCES colours(id),
  style      VARCHAR(191),
  CONSTRAINT uq_variant UNIQUE  (product_id, size_id, colour_id, style)
);

-- ---------- SUPPLIERS / DEALERS ----------
CREATE TABLE IF NOT EXISTS suppliers (
  id             VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  code           VARCHAR(191) NOT NULL UNIQUE,
  company_name   text NOT NULL,  contact_person VARCHAR(191),
  mobile         text,  email VARCHAR(191),  address text,
  gstin          VARCHAR(191),  pan VARCHAR(191),
  payment_terms  VARCHAR(30) NOT NULL DEFAULT 'net_30',
  preferred_brands JSON,  internal_rating numeric(3,1),
  bank_details   JSON,
  notes          text,
  status         VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS supplier_divisions (
  supplier_id VARCHAR(36) NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  division_id VARCHAR(36) NOT NULL REFERENCES divisions(id),
  PRIMARY KEY (supplier_id, division_id)
);

CREATE TABLE IF NOT EXISTS supplier_brands (
  supplier_id VARCHAR(36) NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  brand_id    VARCHAR(36) NOT NULL REFERENCES brands(id),
  PRIMARY KEY (supplier_id, brand_id)
);

-- ---------- USERS / RBAC ----------
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email         VARCHAR(191) NOT NULL UNIQUE,
  username      VARCHAR(191) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name     text NOT NULL,  phone VARCHAR(191),
  mfa_enabled   TINYINT(1) NOT NULL DEFAULT 0,
  force_password_reset TINYINT(1) NOT NULL DEFAULT 0,
  failed_attempts integer NOT NULL DEFAULT 0, locked_until DATETIME,
  last_login_at DATETIME,
  status        VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  code VARCHAR(191) NOT NULL UNIQUE,
  name VARCHAR(191) NOT NULL,  description text
);

CREATE TABLE IF NOT EXISTS permissions (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  code VARCHAR(191) NOT NULL UNIQUE,    module VARCHAR(191) NOT NULL,  description text
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id VARCHAR(36) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id VARCHAR(36) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id VARCHAR(36) NOT NULL REFERENCES roles(id),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS user_divisions (
  user_id    VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  division_id VARCHAR(36) NOT NULL REFERENCES divisions(id),
  PRIMARY KEY (user_id, division_id)
);

CREATE TABLE IF NOT EXISTS user_sections (
  user_id    VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_id VARCHAR(36) NOT NULL REFERENCES sections(id),
  PRIMARY KEY (user_id, section_id)
);

-- ---------- NUMBER SEQUENCES ----------
CREATE TABLE IF NOT EXISTS number_sequences (
  id           VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  entity_type  VARCHAR(191) NOT NULL,
  division_id  VARCHAR(36) REFERENCES divisions(id),
  seq_year     integer NOT NULL,
  prefix       VARCHAR(191) NOT NULL,
  current_value bigint NOT NULL DEFAULT 0,
  CONSTRAINT uq_seq UNIQUE  (entity_type, division_id, seq_year)
);



-- ---------- PURCHASE ORDERS ----------
CREATE TABLE IF NOT EXISTS purchase_orders (
  id             VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  po_number      VARCHAR(191) NOT NULL UNIQUE,
  version        integer NOT NULL DEFAULT 1,
  parent_po_id   VARCHAR(36) REFERENCES purchase_orders(id),
  division_id    VARCHAR(36) NOT NULL REFERENCES divisions(id),
  department_id  VARCHAR(36) NOT NULL REFERENCES departments(id),
  section_id     VARCHAR(36) NOT NULL REFERENCES sections(id),
  supplier_id    VARCHAR(36) NOT NULL REFERENCES suppliers(id),
  created_by     VARCHAR(36) NOT NULL REFERENCES users(id),
  po_date        date NOT NULL DEFAULT (CURRENT_DATE),
  status         VARCHAR(30) NOT NULL DEFAULT 'draft',
  payment_terms  VARCHAR(30),  delivery_terms VARCHAR(191),
  currency       char(3) NOT NULL DEFAULT 'INR',
  tax_scheme     text,
  expected_delivery_date date,
  subtotal       numeric(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  order_discount_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (order_discount_amount >= 0),
  tax_amount     numeric(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  charges_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (charges_amount >= 0),
  grand_total    numeric(14,2) NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
  header_snapshot JSON,
  remarks        text,
  qr_code        text,
  idempotency_key VARCHAR(36),
  submitted_at DATETIME, approved_at DATETIME,
  issued_at    DATETIME, closed_at   DATETIME,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_po_div_status ON purchase_orders (division_id, status);
CREATE INDEX idx_po_supplier   ON purchase_orders (supplier_id);
CREATE UNIQUE INDEX uq_po_idempotency_key ON purchase_orders (idempotency_key);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id             VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  po_id          VARCHAR(36) NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  line_no        integer NOT NULL,
  product_id     VARCHAR(36) NOT NULL REFERENCES products(id),
  product_snapshot JSON NOT NULL,
  brand_snapshot   JSON NOT NULL,
  colour_id      VARCHAR(36) REFERENCES colours(id),
  colour_snapshot  JSON,
  description    text,
  purchase_price numeric(12,2) NOT NULL CHECK (purchase_price >= 0),
  margin_percent numeric(5,2)  NOT NULL DEFAULT 0 CHECK (margin_percent >= 0),
  margin_amount  numeric(12,2) NOT NULL DEFAULT 0,
  net_value_per_unit numeric(12,2) NOT NULL DEFAULT 0,
  discount_type  VARCHAR(30),  discount_value numeric(12,2),
  discount_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  final_value_per_unit numeric(12,2) NOT NULL DEFAULT 0,
  total_quantity integer NOT NULL CHECK (total_quantity > 0),
  line_total     numeric(14,2) NOT NULL DEFAULT 0 CHECK (line_total >= 0),
  UNIQUE (po_id, line_no)
);

CREATE TABLE IF NOT EXISTS purchase_order_quantities (
  id           VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  po_item_id   VARCHAR(36) NOT NULL REFERENCES purchase_order_items(id) ON DELETE CASCADE,
  size_id      VARCHAR(36) REFERENCES sizes(id),
  size_label   text NOT NULL,
  quantity     integer NOT NULL CHECK (quantity >= 0),
  UNIQUE (po_item_id, size_id)
);

CREATE TABLE IF NOT EXISTS purchase_order_discounts (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  po_id VARCHAR(36) NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  discount_type VARCHAR(30) NOT NULL,
  discount_value numeric(12,2) NOT NULL CHECK (discount_value >= 0),
  discount_amount numeric(14,2) NOT NULL CHECK (discount_amount >= 0),
  reason text
);

CREATE TABLE IF NOT EXISTS purchase_order_taxes (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  po_id VARCHAR(36) NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  po_item_id VARCHAR(36) REFERENCES purchase_order_items(id),
  tax_name text NOT NULL,
  rate numeric(5,2) NOT NULL,
  taxable_base numeric(14,2) NOT NULL,
  tax_amount numeric(14,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_order_charges (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  po_id VARCHAR(36) NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  charge_type VARCHAR(30) NOT NULL,
  description text,  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  is_supplier_billed TINYINT(1) NOT NULL DEFAULT 1
);

-- ---------- APPROVALS ----------
CREATE TABLE IF NOT EXISTS approval_rules (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(191) NOT NULL,  priority integer NOT NULL DEFAULT 100,
  min_value numeric(14,2) DEFAULT 0,  max_value numeric(14,2),
  division_id VARCHAR(36) REFERENCES divisions(id),
  department_id VARCHAR(36) REFERENCES departments(id),
  section_id VARCHAR(36) REFERENCES sections(id),
  supplier_id VARCHAR(36) REFERENCES suppliers(id),
  category_id VARCHAR(36) REFERENCES categories(id),
  min_discount_percent numeric(5,2),
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  CHECK (max_value IS NULL OR max_value >= min_value)
);

CREATE TABLE IF NOT EXISTS approval_levels (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  rule_id VARCHAR(36) NOT NULL REFERENCES approval_rules(id) ON DELETE CASCADE,
  level_no integer NOT NULL,
  approver_role_id VARCHAR(36) REFERENCES roles(id),
  approver_user_id VARCHAR(36) REFERENCES users(id),
  auto_escalate_after_hours integer,
  UNIQUE (rule_id, level_no)
);

CREATE TABLE IF NOT EXISTS approval_instances (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  po_id VARCHAR(36) NOT NULL REFERENCES purchase_orders(id),
  rule_id VARCHAR(36) REFERENCES approval_rules(id),
  current_level integer NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'under_review',
  created_by VARCHAR(36) NOT NULL REFERENCES users(id),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME
);

CREATE TABLE IF NOT EXISTS approval_actions (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  instance_id VARCHAR(36) NOT NULL REFERENCES approval_instances(id),
  level_no integer NOT NULL,
  approver_id VARCHAR(36) NOT NULL REFERENCES users(id),
  action VARCHAR(30) NOT NULL,
  comments text,
  acted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT rejection_needs_reason CHECK (
    action IN ('submitted','approved','escalated') OR comments IS NOT NULL)
);

-- ---------- RECEIVING ----------
CREATE TABLE IF NOT EXISTS receipts (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  receipt_number VARCHAR(191) NOT NULL UNIQUE,
  po_id VARCHAR(36) NOT NULL REFERENCES purchase_orders(id),
  supplier_id VARCHAR(36) NOT NULL REFERENCES suppliers(id),
  division_id VARCHAR(36) NOT NULL REFERENCES divisions(id),
  delivery_date date,  invoice_number text,  invoice_date date,
  received_by VARCHAR(36) NOT NULL REFERENCES users(id),
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  remarks text,  attachments JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS receipt_items (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  receipt_id VARCHAR(36) NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  po_item_id VARCHAR(36) NOT NULL REFERENCES purchase_order_items(id),
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
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  division_id VARCHAR(36) NOT NULL REFERENCES divisions(id),
  product_id VARCHAR(36) NOT NULL REFERENCES products(id),
  size_id VARCHAR(36) REFERENCES sizes(id),
  receipt_item_id VARCHAR(36) REFERENCES receipt_items(id),
  txn_type VARCHAR(30) NOT NULL,
  quantity integer NOT NULL,
  unit_cost numeric(12,2),
  created_by VARCHAR(36) NOT NULL REFERENCES users(id),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_inv_lookup ON inventory_transactions (division_id, product_id, size_id);

-- ---------- CROSS-CUTTING ----------
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL REFERENCES users(id),
  channel VARCHAR(30) NOT NULL DEFAULT 'in_app',
  event_type text NOT NULL,
  entity_type VARCHAR(191), entity_id VARCHAR(36),
  title VARCHAR(191) NOT NULL, body text,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,  read_at DATETIME
);

CREATE TABLE IF NOT EXISTS attachments (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  entity_type VARCHAR(191) NOT NULL, entity_id VARCHAR(36) NOT NULL,
  file_name VARCHAR(191) NOT NULL, mime_type VARCHAR(191) NOT NULL,
  size_bytes bigint NOT NULL, storage_key VARCHAR(191) NOT NULL,
  checksum text, uploaded_by VARCHAR(36) NOT NULL REFERENCES users(id),
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_attach_entity ON attachments (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS comments (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  entity_type VARCHAR(191) NOT NULL, entity_id VARCHAR(36) NOT NULL,
  author_id VARCHAR(36) NOT NULL REFERENCES users(id),
  body text NOT NULL,
  visibility VARCHAR(191) NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','approval')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  event_id VARCHAR(36) NOT NULL DEFAULT (UUID()),
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id VARCHAR(36), user_role text,
  division_id VARCHAR(36), section_id VARCHAR(36),
  action_type text NOT NULL,
  entity_type VARCHAR(191) NOT NULL, entity_id VARCHAR(36) NOT NULL,
  before_value JSON, after_value JSON,
  reason text, request_id text, ip_address VARCHAR(45)
);
CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id, occurred_at);
CREATE INDEX idx_audit_user   ON audit_logs (user_id, occurred_at);

-- Immutability trigger for audit_logs




CREATE TABLE IF NOT EXISTS settings (`key` VARCHAR(191) PRIMARY KEY, value JSON NOT NULL, description text,
  updated_by VARCHAR(36), updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS import_jobs (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  job_type text NOT NULL,
  storage_key VARCHAR(191) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  total_rows integer, valid_rows integer, error_rows integer,
  error_report JSON,
  requested_by VARCHAR(36) NOT NULL REFERENCES users(id),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS export_jobs (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  job_type text NOT NULL, filters JSON,
  format VARCHAR(191) NOT NULL DEFAULT 'xlsx' CHECK (format IN ('xlsx','csv','pdf')),
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  storage_key VARCHAR(191),
  requested_by VARCHAR(36) NOT NULL REFERENCES users(id),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME
);

-- ---------- HELPER: updated_at trigger ----------






-- ============================================================
-- MIGRATION 001 — Team Chat
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id          VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  division_id VARCHAR(36) REFERENCES divisions(id),
  user_id     VARCHAR(36) NOT NULL REFERENCES users(id),
  body        text NOT NULL CHECK (length(TRIM(body)) > 0),
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_chat_div_time ON chat_messages (division_id, created_at DESC);

-- ============================================================
-- MIGRATION 002 — Workspace UI upgrade
-- ============================================================
CREATE TABLE IF NOT EXISTS product_images (
  id          VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  product_id  VARCHAR(36) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  file_name   VARCHAR(191) NOT NULL,
  mime_type   VARCHAR(191) NOT NULL,
  size_bytes  bigint NOT NULL,
  storage_key VARCHAR(191) NOT NULL,
  is_primary  TINYINT(1) NOT NULL DEFAULT 0,
  sort_order  integer NOT NULL DEFAULT 0,
  uploaded_by VARCHAR(36) REFERENCES users(id),
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_product_images_product ON product_images(product_id, is_primary DESC, sort_order);

CREATE INDEX idx_attachments_entity ON attachments(entity_type, entity_id, uploaded_at DESC);

ALTER TABLE users ADD COLUMN profile_photo_url text;
ALTER TABLE users ADD COLUMN designation text;

INSERT IGNORE INTO settings (`key`, value, description)
VALUES ('uploads.policy', '{"maxSizeMb": 200, "allowed": "*"}',
        'Universal attachment policy: every file type accepted up to the size cap')
;

-- ============================================================
-- MIGRATION 003: Men's Apparel Collection Management
-- ============================================================
CREATE TABLE IF NOT EXISTS manufacturers (
  id             VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  code           VARCHAR(191) NOT NULL UNIQUE,
  name           VARCHAR(191) NOT NULL,
  contact_person VARCHAR(191),
  phone          VARCHAR(191),
  email          VARCHAR(191),
  address        text,
  city           text,
  state          text,
  country        VARCHAR(191) DEFAULT 'India',
  gstin          VARCHAR(191),
  notes          text,
  status         VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS product_manufacturers (
  product_id VARCHAR(36) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  manufacturer_id VARCHAR(36) NOT NULL REFERENCES manufacturers(id),
  PRIMARY KEY (product_id, manufacturer_id)
);

ALTER TABLE products ADD COLUMN material VARCHAR(191);
ALTER TABLE products ADD COLUMN pattern VARCHAR(191);
ALTER TABLE products ADD COLUMN fit VARCHAR(191);
ALTER TABLE products ADD COLUMN neck_type text;
ALTER TABLE products ADD COLUMN sleeve_type text;
ALTER TABLE products ADD COLUMN season VARCHAR(191);
ALTER TABLE products ADD COLUMN gender VARCHAR(191) DEFAULT 'men';
ALTER TABLE products ADD COLUMN collection VARCHAR(191) DEFAULT 'mens_wear';
ALTER TABLE products ADD COLUMN purchase_price numeric(12,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN selling_price numeric(12,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN barcode text;
ALTER TABLE products ADD COLUMN internal_ref text;

-- Generated columns (wrapped for idempotency)




CREATE INDEX idx_products_gender ON products(gender);
CREATE INDEX idx_products_collection ON products(collection);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_material ON products(material);
CREATE INDEX idx_products_status ON products(status);

INSERT IGNORE INTO roles (code, name) VALUES
  ('admin', 'Admin'),
  ('men_collection_manager', 'Men''s Collection Manager'),
  ('purchaser_manager', 'Purchaser Manager')
;

INSERT IGNORE INTO permissions (code, module, description) VALUES
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
;

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.code = 'admin'
;

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'men_collection_manager'
  AND p.code IN ('products.view', 'products.create', 'products.edit',
    'categories.manage', 'brands.manage', 'manufacturers.manage',
    'colors.manage', 'sizes.manage', 'attributes.manage',
    'pricing.view', 'pricing.manage', 'reports.view', 'reports.export')
;

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'purchaser_manager'
  AND p.code IN ('products.view', 'orders.create', 'orders.view',
    'reports.view', 'reports.export')
;

INSERT IGNORE INTO settings (`key`, value, description) VALUES
  ('currency', '"INR"', 'Default currency'),
  ('currency_symbol', '"₹"', 'Currency symbol'),
  ('app_name', '"BSC Exclusive POMS"', 'Application name'),
  ('app_version', '"1.0.0"', 'Version')
;

-- ============================================================
-- MIGRATION 004: Apparel product junctions
-- ============================================================
CREATE TABLE IF NOT EXISTS product_sizes (
  product_id VARCHAR(36) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size_id VARCHAR(36) NOT NULL REFERENCES sizes(id),
  PRIMARY KEY (product_id, size_id)
);
CREATE TABLE IF NOT EXISTS product_colours (
  product_id VARCHAR(36) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  colour_id VARCHAR(36) NOT NULL REFERENCES colours(id),
  PRIMARY KEY (product_id, colour_id)
);
CREATE INDEX idx_product_sizes_size ON product_sizes(size_id);
CREATE INDEX idx_product_colours_colour ON product_colours(colour_id);

-- ============================================================
-- MIGRATION 005: Training / Media Video Library
-- ============================================================
CREATE TABLE IF NOT EXISTS videos (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  title VARCHAR(191) NOT NULL,
  description text,
  category VARCHAR(191) NOT NULL DEFAULT 'general',
  module VARCHAR(191),
  file_name VARCHAR(191) NOT NULL,
  mime_type VARCHAR(191) NOT NULL,
  size_bytes bigint NOT NULL,
  storage_key VARCHAR(191) NOT NULL,
  thumbnail_key text,
  duration_seconds integer,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  uploaded_by VARCHAR(36) REFERENCES users(id),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_videos_category ON videos(category, status);
CREATE INDEX idx_videos_created ON videos(created_at DESC);


INSERT IGNORE INTO permissions (code, module, description) VALUES
  ('videos.view', 'video', 'View video library'),
  ('videos.manage', 'video', 'Upload/edit/archive videos')
;

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('super_admin', 'admin', 'domain_admin', 'men_collection_manager')
  AND p.code IN ('videos.view', 'videos.manage')
;

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('super_admin', 'admin', 'domain_admin',
  'purchase_manager', 'purchase_executive', 'viewer')
  AND p.code = 'videos.view'
;

-- ============================================================
-- MIGRATION 006: Locations, Brand assets, Product types, Colour images
-- ============================================================
CREATE TABLE IF NOT EXISTS locations (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  code VARCHAR(191) NOT NULL UNIQUE,
  name VARCHAR(191) NOT NULL,
  address text, city text, state text,
  country VARCHAR(191) DEFAULT 'India',
  latitude numeric(10,7), longitude numeric(10,7),
  contact_person VARCHAR(191), phone VARCHAR(191), notes text,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);










CREATE TABLE IF NOT EXISTS product_types (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  section_id VARCHAR(36) NOT NULL REFERENCES sections(id),
  category_id VARCHAR(36) REFERENCES categories(id),
  subcategory_id VARCHAR(36) REFERENCES categories(id),
  code VARCHAR(191) NOT NULL,
  name VARCHAR(191) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_product_type UNIQUE (section_id, category_id, subcategory_id, code)
);





INSERT IGNORE INTO locations (code, name, address, city, state, country, latitude, longitude) VALUES
  ('DVG', 'Davangere', 'Davangere, Karnataka', 'Davangere', 'Karnataka', 'India', 14.4673600, 74.9966800),
  ('SMG', 'Shivamogga', 'Shivamogga, Karnataka', 'Shivamogga', 'Karnataka', 'India', 13.9299300, 75.5681000),
  ('BGV', 'Bhigervi', 'Bhigervi, Karnataka', 'Bhigervi', 'Karnataka', 'India', NULL, NULL)
;

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.code = 'admin'
;

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'super_admin'
  AND p.code IN ('products.view', 'products.create', 'products.edit',
    'products.delete', 'categories.manage', 'brands.manage',
    'manufacturers.manage', 'colors.manage', 'sizes.manage',
    'attributes.manage', 'pricing.view', 'pricing.manage',
    'orders.create', 'orders.view', 'orders.manage',
    'reports.export', 'settings.manage')
;

-- ============================================================
-- MIGRATION 007: Brand logo (already in 006)
-- ============================================================

-- ============================================================
-- MIGRATION 008: Collections, Dealers, Company Settings
-- ============================================================
CREATE TABLE IF NOT EXISTS collections (
  id            VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  code          VARCHAR(191) NOT NULL UNIQUE,
  name          VARCHAR(191) NOT NULL,
  description   text,
  display_order integer NOT NULL DEFAULT 0,
  status        VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_collections (
  user_id       VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_id VARCHAR(36) NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, collection_id)
);

CREATE TABLE IF NOT EXISTS brand_collections (
  brand_id      VARCHAR(36) NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  collection_id VARCHAR(36) NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  PRIMARY KEY (brand_id, collection_id)
);

CREATE TABLE IF NOT EXISTS dealers (
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  code            VARCHAR(191) NOT NULL UNIQUE,
  company_name    text NOT NULL,
  contact_person  VARCHAR(191),
  phone           VARCHAR(191),
  email           VARCHAR(191),
  address         text,
  city            text,
  state           text,
  gstin           VARCHAR(191),
  pan             VARCHAR(191),
  payment_terms   VARCHAR(30) NOT NULL DEFAULT 'net_30',
  notes           text,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_settings (
  id            VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  company_name  VARCHAR(191) NOT NULL DEFAULT 'BSC Exclusive Pvt. Ltd.',
  logo_url      text,
  address       text,
  city          text,
  state         text,
  pin_code      text,
  phone         VARCHAR(191),
  email         VARCHAR(191),
  gst_number    text,
  website       text,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);







INSERT IGNORE INTO collections (code, name, display_order) VALUES
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
;

INSERT IGNORE INTO company_settings (company_name, address, city, state, phone, email)
VALUES ('BSC Exclusive Pvt. Ltd.', 'Davanagere, Karnataka', 'Davanagere', 'Karnataka', '+91-9876543210', 'info@bscexclusive.in')
;

INSERT IGNORE INTO permissions (code, module, description) VALUES
  ('collections.view',   'collections',   'View collections'),
  ('collections.manage', 'collections',   'Manage collections'),
  ('dealers.view',       'dealers',       'View dealers'),
  ('dealers.manage',     'dealers',       'Manage dealers'),
  ('company.view',       'company',       'View company settings'),
  ('company.manage',     'company',       'Manage company settings')
;

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('admin', 'super_admin')
  AND p.code IN ('collections.view','collections.manage',
    'dealers.view','dealers.manage','company.view','company.manage')
;

-- ============================================================
-- MIGRATION 009: Remove non-admin users (data cleanup, skip on fresh install)
-- ============================================================

-- ============================================================
-- MIGRATION 010: File Attachments
-- ============================================================
CREATE TABLE IF NOT EXISTS file_attachments (
  id          VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  file_name   VARCHAR(191) NOT NULL,
  mime_type   VARCHAR(191) NOT NULL DEFAULT 'application/octet-stream',
  size_bytes  bigint NOT NULL,
  storage_key VARCHAR(191) NOT NULL,
  description text,
  uploaded_by VARCHAR(36) NOT NULL REFERENCES users(id),
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_file_attachments_uploaded ON file_attachments (uploaded_at DESC);

-- ============================================================
-- MIGRATION 011: Account Manager role + Vladimir user
-- ============================================================
INSERT IGNORE INTO roles (code, name, description)
VALUES ('account_manager', 'Account & Category Manager',
        'Creates user accounts and manages category sections.')
;

INSERT IGNORE INTO users (email, username, password_hash, full_name, status, force_password_reset)
VALUES ('vladimir@bsc.local', 'vladimir',
        '$2a$10$0mdtUMxM3J2Ae8CpjtbKpu0dOd32FsPjFD9ql2DeFeVMsOcxdgcCe',
        'Vladimir', 'active', false)
;

-- ============================================================
-- MIGRATION 012: User Sessions, Profile Tracking, Security Settings
-- ============================================================
ALTER TABLE users ADD COLUMN profile_updated_at DATETIME;

CREATE TABLE IF NOT EXISTS user_sessions (
  id            VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id       VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tab_id        VARCHAR(191) NOT NULL,
  login_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  logout_at     DATETIME,
  last_seen_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
  devtools_seen TINYINT(1) NOT NULL DEFAULT 0,
  ended_reason  text,
  CONSTRAINT uq_user_session_tab UNIQUE (user_id, tab_id)
);
CREATE INDEX idx_user_sessions_seen ON user_sessions(last_seen_at);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);

INSERT IGNORE INTO settings (`key`, value, description)
VALUES ('security', '{"devtoolsBlock": true}',
        'DevTools blocking — when on, opening browser developer tools blocks login and ends the session')
;

-- ============================================================
-- MIGRATION 013: Performance Indexes
-- ============================================================
CREATE INDEX idx_audit_occurred ON audit_logs (occurred_at DESC);
CREATE INDEX idx_receipt_items_po_item ON receipt_items (po_item_id);
CREATE INDEX idx_po_items_po ON purchase_order_items (po_id);
CREATE INDEX idx_po_created ON purchase_orders (created_at DESC);


ALTER TABLE purchase_orders ADD COLUMN location_id VARCHAR(36) REFERENCES locations(id);
ALTER TABLE brands ADD COLUMN logo_url TEXT;
ALTER TABLE brands ADD COLUMN image_url TEXT;
ALTER TABLE brands ADD COLUMN description TEXT;
ALTER TABLE colours ADD COLUMN image_url TEXT;
ALTER TABLE colours ADD COLUMN description TEXT;
ALTER TABLE products ADD COLUMN product_type_id VARCHAR(36) REFERENCES product_types(id);
ALTER TABLE products ADD COLUMN manual_size VARCHAR(191);
ALTER TABLE products ADD COLUMN profit_amount DECIMAL(12,2) GENERATED ALWAYS AS (selling_price - purchase_price) STORED;
ALTER TABLE products ADD COLUMN profit_margin DECIMAL(5,2) GENERATED ALWAYS AS (CASE WHEN purchase_price > 0 THEN ROUND(((selling_price - purchase_price) / purchase_price) * 100, 2) ELSE 0 END) STORED;
ALTER TABLE users ADD COLUMN password_changed_at DATETIME;
ALTER TABLE users ADD COLUMN clerk_id VARCHAR(191);
ALTER TABLE users ADD COLUMN reset_otp VARCHAR(10);
ALTER TABLE users ADD COLUMN reset_otp_expires_at DATETIME;
ALTER TABLE users ADD COLUMN reset_otp_phone VARCHAR(10);
ALTER TABLE users ADD COLUMN mfa_otp VARCHAR(10);
ALTER TABLE users ADD COLUMN mfa_otp_expires_at DATETIME;
ALTER TABLE user_sessions ADD COLUMN token_hash VARCHAR(64);
ALTER TABLE purchase_orders ADD COLUMN qr_code text;
ALTER TABLE purchase_orders ADD COLUMN idempotency_key VARCHAR(36);

CREATE TABLE IF NOT EXISTS import_history (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  file_name VARCHAR(191) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_size_bytes bigint NOT NULL DEFAULT 0,
  storage_key VARCHAR(191),
  import_type VARCHAR(50) NOT NULL DEFAULT 'product',
  uploaded_by VARCHAR(36) REFERENCES users(id),
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) NOT NULL DEFAULT 'processing',
  total_records int NOT NULL DEFAULT 0,
  imported_count int NOT NULL DEFAULT 0,
  updated_count int NOT NULL DEFAULT 0,
  skipped_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  duplicate_count int NOT NULL DEFAULT 0,
  needs_review_count int NOT NULL DEFAULT 0,
  processing_duration_ms int NOT NULL DEFAULT 0,
  fields_detected int NOT NULL DEFAULT 0,
  sheets JSON,
  summary JSON,
  error_summary JSON,
  confirmed_at DATETIME,
  confirmed_by VARCHAR(36) REFERENCES users(id),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS import_records (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  import_id VARCHAR(36) NOT NULL REFERENCES import_history(id) ON DELETE CASCADE,
  row_index int NOT NULL,
  sheet VARCHAR(191),
  action VARCHAR(50),
  operation VARCHAR(50),
  extracted JSON,
  mapped JSON,
  warnings JSON,
  errors JSON,
  resolved_entity_id VARCHAR(36),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
