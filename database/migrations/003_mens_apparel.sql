-- ============================================================
-- MIGRATION 003: Men's Apparel Collection Management
-- Adds: manufacturers table, product apparel columns,
--        new roles/permissions for men's collection
-- ============================================================

-- ---------- MANUFACTURERS ----------
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
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------- PRODUCT-MANUFACTURER LINK ----------
CREATE TABLE IF NOT EXISTS product_manufacturers (
  product_id      uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  manufacturer_id uuid NOT NULL REFERENCES manufacturers(id),
  PRIMARY KEY (product_id, manufacturer_id)
);

-- ---------- APPAREL COLUMNS ON PRODUCTS ----------
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

-- Computed profit columns (generated always)
DO $$ BEGIN
  ALTER TABLE products ADD COLUMN profit_amount numeric(12,2)
    GENERATED ALWAYS AS (selling_price - purchase_price) STORED;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE products ADD COLUMN profit_margin numeric(5,2)
    GENERATED ALWAYS AS (
      CASE WHEN purchase_price > 0
      THEN ROUND(((selling_price - purchase_price) / purchase_price) * 100, 2)
      ELSE 0 END
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ---------- INDEXES FOR APPAREL ----------
CREATE INDEX IF NOT EXISTS idx_products_gender ON products(gender);
CREATE INDEX IF NOT EXISTS idx_products_collection ON products(collection);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_material ON products(material);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

-- ---------- NEW ROLES ----------
INSERT INTO roles (code, name) VALUES
  ('admin', 'Admin'),
  ('men_collection_manager', 'Men''s Collection Manager'),
  ('purchaser_manager', 'Purchaser Manager')
ON CONFLICT (code) DO NOTHING;

-- ---------- NEW PERMISSIONS ----------
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

-- ---------- ASSIGN PERMISSIONS TO NEW ROLES ----------
-- Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

-- Men's Collection Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'men_collection_manager'
  AND p.code IN ('products.view', 'products.create', 'products.edit',
                 'categories.manage', 'brands.manage', 'manufacturers.manage',
                 'colors.manage', 'sizes.manage', 'attributes.manage',
                 'pricing.view', 'pricing.manage', 'reports.view', 'reports.export')
ON CONFLICT DO NOTHING;

-- Purchaser Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'purchaser_manager'
  AND p.code IN ('products.view', 'orders.create', 'orders.view',
                 'reports.view', 'reports.export')
ON CONFLICT DO NOTHING;

-- ---------- SETTINGS DEFAULTS ----------
INSERT INTO settings (key, value, description) VALUES
  ('currency', '"INR"', 'Default currency — Indian Rupees'),
  ('currency_symbol', '"₹"', 'Currency symbol for display'),
  ('app_name', '"Men''s Collection Management System"', 'Application name'),
  ('app_version', '"1.0.0"', 'Application version')
ON CONFLICT (key) DO NOTHING;
