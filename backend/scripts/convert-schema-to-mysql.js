import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pgSqlPath = path.resolve(__dirname, '../../database/complete_schema.sql');
const mysqlSqlPath = path.resolve(__dirname, '../../database/complete_schema_mysql.sql');

function convertToMySQL(rawBuffer) {
  // 1. Strip any corrupted bytes / UTF-16 at the end
  let cutoff = rawBuffer.indexOf(0);
  let raw = (cutoff !== -1 ? rawBuffer.subarray(0, cutoff) : rawBuffer).toString('utf8');

  // Strip trailing orphan characters
  raw = raw.replace(/\bA\s*$/g, '');

  let s = raw;

  // 2. Remove Postgres extension & custom ENUM DO blocks
  s = s.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/gi, '');
  s = s.replace(/DO \$\$ BEGIN[\s\S]*?END \$\$;/gi, '');
  s = s.replace(/CREATE OR REPLACE FUNCTION[\s\S]*?\$\$;/gi, '');
  s = s.replace(/CREATE TRIGGER[\s\S]*?;/gi, '');

  // 3. Remove Postgres typecasts like ::jsonb, ::text, etc.
  s = s.replace(/::[a-zA-Z0-9_]+(\[\])?/gi, '');

  // 4. Identity & Auto increment
  s = s.replace(/bigint\s+GENERATED\s+ALWAYS\s+AS\s+IDENTITY\s+PRIMARY\s+KEY/gi, 'BIGINT AUTO_INCREMENT PRIMARY KEY');
  s = s.replace(/serial\s+PRIMARY\s+KEY/gi, 'INT AUTO_INCREMENT PRIMARY KEY');
  s = s.replace(/bigserial\s+PRIMARY\s+KEY/gi, 'BIGINT AUTO_INCREMENT PRIMARY KEY');

  // 5. Fix JSON defaults
  s = s.replace(/\bjsonb\s+NOT\s+NULL\s+DEFAULT\s+'{}'/gi, 'JSON');
  s = s.replace(/\bjsonb\s+DEFAULT\s+'{}'/gi, 'JSON');
  s = s.replace(/\bjsonb\b/gi, 'JSON');
  s = s.replace(/\btext\[\]\b/gi, 'JSON');

  // 6. UUID & Timestamps & Network
  s = s.replace(/\buuid\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/gi, 'VARCHAR(36) PRIMARY KEY');
  s = s.replace(/\buuid\s+DEFAULT\s+gen_random_uuid\(\)/gi, 'VARCHAR(36)');
  s = s.replace(/\buuid\s+PRIMARY\s+KEY/gi, 'VARCHAR(36) PRIMARY KEY');
  s = s.replace(/DEFAULT\s+gen_random_uuid\(\)/gi, '');
  s = s.replace(/\buuid\b/gi, 'VARCHAR(36)');
  s = s.replace(/VARCHAR\(36\)\s+PRIMARY\s+KEY/gi, 'VARCHAR(36) PRIMARY KEY DEFAULT (UUID())');
  s = s.replace(/\btimestamptz\b/gi, 'DATETIME');
  s = s.replace(/\btimestamp with time zone\b/gi, 'DATETIME');
  s = s.replace(/\bDEFAULT\s+now\(\)/gi, 'DEFAULT CURRENT_TIMESTAMP');
  s = s.replace(/\bDEFAULT\s+current_date\b/gi, 'DEFAULT (CURRENT_DATE)');
  s = s.replace(/\binet\b/gi, 'VARCHAR(45)');

  // 7. Postgres ENUM types -> replace only when used as a TYPE (after column name)
  s = s.replace(/(\bdiscount_type\s+)discount_type\b/gi, '$1VARCHAR(30)');
  s = s.replace(/(\bcharge_type\s+)charge_type\b/gi, '$1VARCHAR(30)');
  s = s.replace(/(\bpayment_terms\s+)payment_terms\b/gi, '$1VARCHAR(30)');
  s = s.replace(/(\bstatus\s+)po_status\b/gi, '$1VARCHAR(30)');
  s = s.replace(/(\baction\s+)approval_action\b/gi, '$1VARCHAR(30)');
  s = s.replace(/(\bstatus\s+)entity_status\b/gi, '$1VARCHAR(20)');
  s = s.replace(/(\bstatus\s+)job_status\b/gi, '$1VARCHAR(30)');
  s = s.replace(/(\bstatus\s+)receipt_status\b/gi, '$1VARCHAR(30)');
  s = s.replace(/(\btxn_type\s+)inventory_type\b/gi, '$1VARCHAR(30)');
  s = s.replace(/(\bchannel\s+)notify_channel\b/gi, '$1VARCHAR(30)');
  s = s.replace(/(\bentity_type\s+)attachment_type\b/gi, '$1VARCHAR(30)');

  // Fallbacks for any remaining enum type keywords
  s = s.replace(/\bpo_status\b/gi, 'VARCHAR(30)');
  s = s.replace(/\bentity_status\b/gi, 'VARCHAR(20)');
  s = s.replace(/\bapproval_action\b/gi, 'VARCHAR(30)');
  s = s.replace(/\bjob_status\b/gi, 'VARCHAR(30)');
  s = s.replace(/\breceipt_status\b/gi, 'VARCHAR(30)');
  s = s.replace(/\binventory_type\b/gi, 'VARCHAR(30)');
  s = s.replace(/\bnotify_channel\b/gi, 'VARCHAR(30)');
  s = s.replace(/\battachment_type\b/gi, 'VARCHAR(30)');
  s = s.replace(/\bbtrim\(/gi, 'TRIM(');
  s = s.replace(/\bboolean\b/gi, 'TINYINT(1)');
  s = s.replace(/\bNULLS NOT DISTINCT\b/gi, '');
  s = s.replace(/\bDEFAULT\s+false\b/gi, 'DEFAULT 0');
  s = s.replace(/\bDEFAULT\s+true\b/gi, 'DEFAULT 1');

  // 8. Fix columns that have text DEFAULT '...' (MySQL rejects defaults on TEXT)
  s = s.replace(/(\b[a-zA-Z0-9_]+\s+)text(\s+DEFAULT\s+['"][^'"]*['"])/gi, '$1VARCHAR(191)$2');
  s = s.replace(/(\b[a-zA-Z0-9_]+\s+)text(\s+NOT\s+NULL\s+DEFAULT\s+['"][^'"]*['"])/gi, '$1VARCHAR(191)$2');

  // 9. Fix text columns that are unique or indexed
  const colsToVarchar = [
    'code', 'email', 'username', 'po_number', 'sku', 'brand_number', 'brand_code',
    'product_serial', 'serial_number', 'key', 'token_hash', 'phone', 'entity_type',
    'prefix', 'receipt_number', 'action_number', 'file_name', 'storage_key', 'mime_type',
    'name', 'slug', 'category_code', 'colour_code', 'size_code', 'label', 'colour_family',
    'hsn_sac', 'contact_person', 'gstin', 'pan', 'payment_terms', 'currency', 'gender',
    'collection', 'material', 'fit', 'sleeve', 'collar', 'pattern', 'season', 'delivery_terms',
    'vendor_reference', 'title', 'channel', 'provider', 'style', 'tab_id', 'data_type', 'visibility',
    'reset_otp', 'reset_otp_phone', 'mfa_otp', 'attribute_key', 'idempotency_key', 'module'
  ];

  for (const c of colsToVarchar) {
    const r = new RegExp(`(\\b${c}\\s+)text(\\b)`, 'gi');
    s = s.replace(r, `$1VARCHAR(191)$2`);
  }

  // Any remaining "text UNIQUE" -> VARCHAR(191) UNIQUE
  s = s.replace(/(\b[a-zA-Z0-9_]+\s+)text(\s+[^,\n\)]*?UNIQUE)/gi, '$1VARCHAR(191)$2');

  // 10. Backtick reserved keyword `key` in settings table
  s = s.replace(/\bsettings\s*\(\s*key\s*,/gi, 'settings (`key`,');
  s = s.replace(/\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+settings\s*\(\s*key\s+/gi, 'CREATE TABLE IF NOT EXISTS settings (`key` ');
  s = s.replace(/\bINSERT\s+INTO\s+settings\s*\(\s*key\s*,/gi, 'INSERT INTO settings (`key`,');
  s = s.replace(/\bON\s+CONFLICT\s*\(\s*key\s*\)/gi, 'ON CONFLICT (`key`)');

  // 11. Convert ON CONFLICT ... DO NOTHING to INSERT IGNORE
  s = s.replace(/INSERT\s+INTO\s+([a-zA-Z0-9_`]+)([\s\S]*?)ON\s+CONFLICT[\s\S]*?DO\s+NOTHING;/gi, 'INSERT IGNORE INTO $1$2;');

  // 12. Fix CREATE UNIQUE INDEX with WHERE clauses (partial index)
  s = s.replace(/CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+([a-zA-Z0-9_]+)\s+ON\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*WHERE[^;]+;/gi,
    'CREATE $1INDEX $2 ON $3 ($4);');

  // Fix lower(name) functional index in colours
  s = s.replace(/CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+uq_colour_name_ci\s+ON\s+colours\s*\(lower\(name\)\);/gi,
    'CREATE UNIQUE INDEX uq_colour_name_ci ON colours (name);');

  // Fix remaining CREATE INDEX IF NOT EXISTS -> CREATE INDEX
  s = s.replace(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+/gi, 'CREATE INDEX ');
  s = s.replace(/CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+/gi, 'CREATE UNIQUE INDEX ');

  // 13. Convert PostgreSQL ALTER TABLE ADD COLUMN IF NOT EXISTS to safe MySQL ALTER
  s = s.replace(/ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+/gi, 'ALTER TABLE $1 ADD COLUMN ');

  // 14. Ensure columns and tables from migrations 006, 014-018
  const extraMigrations = `
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
`;

  return s + '\n' + extraMigrations;

  return s;
}

const rawBuf = fs.readFileSync(pgSqlPath);
const mysqlSql = convertToMySQL(rawBuf);
fs.writeFileSync(mysqlSqlPath, mysqlSql, 'utf8');
console.log('Saved converted MySQL schema to', mysqlSqlPath);
