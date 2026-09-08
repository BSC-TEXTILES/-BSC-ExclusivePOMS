-- 008: Collections system — core tables for collection-based access

-- Collections master table
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

-- User ↔ Collection access
CREATE TABLE IF NOT EXISTS user_collections (
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, collection_id)
);

-- Brand ↔ Collection mapping
CREATE TABLE IF NOT EXISTS brand_collections (
  brand_id      uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  PRIMARY KEY (brand_id, collection_id)
);

-- Dealers (separate from suppliers, specifically for PO dealer info)
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

-- Company settings (logo, address, GST, etc.)
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

-- Triggers
CREATE OR REPLACE FUNCTION trg_collections_upd() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_collections_upd ON collections;
CREATE TRIGGER trg_collections_upd BEFORE UPDATE ON collections FOR EACH ROW EXECUTE FUNCTION trg_collections_upd();

CREATE OR REPLACE FUNCTION trg_dealers_upd() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_dealers_upd ON dealers;
CREATE TRIGGER trg_dealers_upd BEFORE UPDATE ON dealers FOR EACH ROW EXECUTE FUNCTION trg_dealers_upd();

CREATE OR REPLACE FUNCTION trg_company_settings_upd() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_company_settings_upd ON company_settings;
CREATE TRIGGER trg_company_settings_upd BEFORE UPDATE ON company_settings FOR EACH ROW EXECUTE FUNCTION trg_company_settings_upd();

-- Seed 10 default collections
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

-- Seed default company settings
INSERT INTO company_settings (company_name, address, city, state, phone, email)
VALUES ('BSC Exclusive Pvt. Ltd.', 'Davanagere, Karnataka', 'Davanagere', 'Karnataka', '+91-9876543210', 'info@bscexclusive.in')
ON CONFLICT DO NOTHING;

-- Grant access to admin role for new tables
INSERT INTO permissions (code, module, description) VALUES
  ('collections.view',   'collections',   'View collections'),
  ('collections.manage', 'collections',   'Manage collections'),
  ('dealers.view',       'dealers',       'View dealers'),
  ('dealers.manage',     'dealers',       'Manage dealers'),
  ('company.view',       'company',       'View company settings'),
  ('company.manage',     'company',       'Manage company settings')
ON CONFLICT (code) DO NOTHING;

-- Assign new permissions to admin/super_admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('admin', 'super_admin')
  AND p.code IN ('collections.view','collections.manage','dealers.view','dealers.manage','company.view','company.manage')
ON CONFLICT DO NOTHING;
