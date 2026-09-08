-- ============================================================
-- MIGRATION 003: Product, Role & Order Management System
-- Adds: customers, om_orders, om_order_items, production_tasks,
--        production_assignments, daily_user_activity,
--        company_settings, product_sheets, pdf_documents,
--        csv_exports, order_status_history
-- ============================================================

-- ---------- NEW ENUMS ----------
CREATE TYPE om_order_status AS ENUM (
  'draft','submitted','pending_approval','approved','rejected',
  'assigned','production_started','in_production','quality_check',
  'production_completed','ready_for_delivery','delivered','completed','cancelled'
);

CREATE TYPE om_priority AS ENUM ('low','normal','high','urgent');

CREATE TYPE production_status AS ENUM (
  'pending','started','in_progress','paused','completed','delayed'
);

CREATE TYPE daily_activity_status AS ENUM (
  'online','offline','working','idle','on_leave','suspended'
);

CREATE TYPE pdf_version_status AS ENUM ('active','superseded','archived');

-- ---------- COMPANY SETTINGS ----------
CREATE TABLE company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'BSC Exclusive',
  logo_url text,
  address text,
  phone text,
  email text,
  website text,
  gst_number text,
  pan_number text,
  registration_info text,
  invoice_footer text,
  pdf_header text,
  pdf_footer text,
  authorized_signatory text,
  order_prefix text NOT NULL DEFAULT 'ORD',
  order_seq_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  order_seq_current integer NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- PRODUCT SHEETS / COLOURS ----------
CREATE TABLE product_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_code text NOT NULL UNIQUE,
  sheet_name text NOT NULL,
  color_name text,
  color_code text,
  swatch_hex char(7),
  finish text,
  material text,
  image_url text,
  availability text NOT NULL DEFAULT 'available' CHECK (availability IN ('available','unlimited','out_of_stock')),
  notes text,
  status entity_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- CUSTOMERS ----------
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code text NOT NULL UNIQUE,
  name text NOT NULL,
  company text,
  contact_person text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  country text DEFAULT 'India',
  postal_code text,
  gst_number text,
  pan_number text,
  tax_info text,
  notes text,
  status entity_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_search ON customers USING gin(to_tsvector('english', name || ' ' || COALESCE(company,'') || ' ' || COALESCE(contact_person,'')));

-- ---------- OM ORDERS (Customer Orders) ----------
CREATE TABLE om_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES customers(id),
  order_date date NOT NULL DEFAULT current_date,
  required_date date,
  created_by uuid NOT NULL REFERENCES users(id),
  assigned_supervisor_id uuid REFERENCES users(id),
  priority om_priority NOT NULL DEFAULT 'normal',
  status om_order_status NOT NULL DEFAULT 'draft',
  production_status om_order_status DEFAULT 'draft',
  payment_info jsonb,
  delivery_info jsonb,
  notes text,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  grand_total numeric(14,2) NOT NULL DEFAULT 0,
  submitted_at timestamptz,
  approved_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_om_order_status ON om_orders(status);
CREATE INDEX idx_om_order_customer ON om_orders(customer_id);
CREATE INDEX idx_om_order_date ON om_orders(order_date);

-- ---------- OM ORDER ITEMS ----------
CREATE TABLE om_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES om_orders(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  product_id uuid NOT NULL REFERENCES products(id),
  product_snapshot jsonb,
  product_image_url text,
  description text,
  sheet_id uuid REFERENCES product_sheets(id),
  sheet_snapshot jsonb,
  size_label text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  tax_percent numeric(5,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  discount_type text,
  discount_value numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  production_notes text,
  status text NOT NULL DEFAULT 'pending',
  UNIQUE (order_id, line_no)
);

-- ---------- ORDER STATUS HISTORY ----------
CREATE TABLE order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES om_orders(id) ON DELETE CASCADE,
  previous_status om_order_status,
  new_status om_order_status NOT NULL,
  changed_by uuid NOT NULL REFERENCES users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  remarks text
);
CREATE INDEX idx_order_history ON order_status_history(order_id, changed_at);

-- ---------- PRODUCTION TASKS ----------
CREATE TABLE production_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES om_orders(id),
  order_item_id uuid REFERENCES om_order_items(id),
  assigned_user_id uuid NOT NULL REFERENCES users(id),
  assigned_by uuid NOT NULL REFERENCES users(id),
  supervisor_id uuid REFERENCES users(id),
  priority om_priority NOT NULL DEFAULT 'normal',
  status production_status NOT NULL DEFAULT 'pending',
  due_date date,
  started_at timestamptz,
  completed_at timestamptz,
  production_notes text,
  supervisor_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_prod_task_user ON production_tasks(assigned_user_id, status);
CREATE INDEX idx_prod_task_order ON production_tasks(order_id);

-- ---------- PRODUCTION ASSIGNMENTS ----------
CREATE TABLE production_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES om_orders(id),
  order_item_id uuid REFERENCES om_order_items(id),
  user_id uuid NOT NULL REFERENCES users(id),
  assigned_by uuid NOT NULL REFERENCES users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

-- ---------- DAILY USER ACTIVITY ----------
CREATE TABLE daily_user_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  activity_date date NOT NULL DEFAULT current_date,
  login_time timestamptz,
  logout_time timestamptz,
  first_activity timestamptz,
  last_activity timestamptz,
  status daily_activity_status NOT NULL DEFAULT 'offline',
  assigned_orders integer NOT NULL DEFAULT 0,
  started_tasks integer NOT NULL DEFAULT 0,
  completed_tasks integer NOT NULL DEFAULT 0,
  work_duration_minutes integer NOT NULL DEFAULT 0,
  notes text,
  UNIQUE (user_id, activity_date)
);
CREATE INDEX idx_daily_activity_date ON daily_user_activity(activity_date, status);

-- ---------- PDF DOCUMENTS ----------
CREATE TABLE pdf_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES om_orders(id),
  file_name text NOT NULL,
  storage_key text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  generated_by uuid NOT NULL REFERENCES users(id),
  version integer NOT NULL DEFAULT 1,
  status pdf_version_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pdf_order ON pdf_documents(order_id, status);

-- ---------- CSV EXPORTS ----------
CREATE TABLE csv_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  export_type text NOT NULL,
  filters jsonb,
  file_size integer NOT NULL DEFAULT 0,
  storage_key text NOT NULL,
  generated_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_csv_export_type ON csv_exports(export_type, created_at);

-- ---------- TRIGGERS ----------
CREATE TRIGGER trg_om_orders_upd BEFORE UPDATE ON om_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_om_order_items_upd BEFORE UPDATE ON om_order_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_company_settings_upd BEFORE UPDATE ON company_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_product_sheets_upd BEFORE UPDATE ON product_sheets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_customers_upd BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_production_tasks_upd BEFORE UPDATE ON production_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
