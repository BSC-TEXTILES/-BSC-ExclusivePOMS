-- ============================================================
-- MIGRATION 006: Locations, Brand assets, Product types, Colour images
-- Adds: locations table, purchase_orders.location_id,
--        brands.logo_url/image_url/description,
--        colours.image_url/description,
--        product_types table, products.product_type_id,
--        products.subcategory_id fix (already exists)
-- ============================================================

-- ---------- LOCATIONS ----------
CREATE TABLE IF NOT EXISTS locations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text NOT NULL UNIQUE,
  name           text NOT NULL,
  address        text,
  city           text,
  state          text,
  country        text DEFAULT 'India',
  latitude       numeric(10,7),
  longitude      numeric(10,7),
  contact_person text,
  phone          text,
  notes          text,
  status         entity_status NOT NULL DEFAULT 'active',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE TRIGGER trg_locations_upd BEFORE UPDATE ON locations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------- LOCATION ON PURCHASE ORDERS ----------
DO $$ BEGIN
  ALTER TABLE purchase_orders ADD COLUMN location_id uuid REFERENCES locations(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ---------- BRAND ASSETS ----------
DO $$ BEGIN
  ALTER TABLE brands ADD COLUMN logo_url text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE brands ADD COLUMN image_url text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE brands ADD COLUMN description text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ---------- COLOUR ASSETS ----------
DO $$ BEGIN
  ALTER TABLE colours ADD COLUMN image_url text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE colours ADD COLUMN description text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ---------- PRODUCT TYPES ----------
CREATE TABLE IF NOT EXISTS product_types (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id     uuid NOT NULL REFERENCES sections(id),
  category_id    uuid REFERENCES categories(id),
  subcategory_id uuid REFERENCES categories(id),
  code           text NOT NULL,
  name           text NOT NULL,
  status         entity_status NOT NULL DEFAULT 'active',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_type UNIQUE (section_id, category_id, subcategory_id, code)
);

DO $$ BEGIN
  CREATE TRIGGER trg_product_types_upd BEFORE UPDATE ON product_types
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------- PRODUCT TYPE ON PRODUCTS ----------
DO $$ BEGIN
  ALTER TABLE products ADD COLUMN product_type_id uuid REFERENCES product_types(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ---------- MANUAL SIZE ON PRODUCTS ----------
DO $$ BEGIN
  ALTER TABLE products ADD COLUMN manual_size text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ---------- SEED DEFAULT LOCATIONS ----------
INSERT INTO locations (code, name, address, city, state, country, latitude, longitude, contact_person, phone) VALUES
  ('DVG', 'Davangere', 'Davangere, Karnataka', 'Davangere', 'Karnataka', 'India', 14.4673600, 74.9966800, NULL, NULL),
  ('SMG', 'Shivamogga', 'Shivamogga, Karnataka', 'Shivamogga', 'Karnataka', 'India', 13.9299300, 75.5681000, NULL, NULL),
  ('BGV', 'Bhigervi', 'Bhigervi, Karnataka', 'Bhigervi', 'Karnataka', 'India', NULL, NULL, NULL, NULL)
ON CONFLICT (code) DO NOTHING;

-- ---------- ENSURE ADMIN ROLE HAS FULL ACCESS ----------
-- The admin role (from migration 003) already gets all permissions via the
-- INSERT ... SELECT r.id, p.id FROM roles r, permissions p WHERE r.code = 'admin'
-- statement. Ensure new permissions are also assigned.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

-- Also grant the new permissions to super_admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'super_admin'
  AND p.code IN ('products.view', 'products.create', 'products.edit', 'products.delete',
                 'categories.manage', 'brands.manage', 'manufacturers.manage',
                 'colors.manage', 'sizes.manage', 'attributes.manage',
                 'pricing.view', 'pricing.manage', 'orders.create', 'orders.view',
                 'orders.manage', 'reports.export', 'settings.manage')
ON CONFLICT DO NOTHING;
