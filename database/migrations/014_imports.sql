-- ============================================================
-- MIGRATION 014: Admin-only Document / Data Import
-- Tracks every import session and its per-row results so admins
-- can preview (without saving), confirm, then audit the outcome.
--   import_history  : one row per uploaded file / import session
--   import_records  : per-row preview + import result for that file
-- ============================================================

CREATE TABLE IF NOT EXISTS import_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_type text NOT NULL,                 -- csv | xlsx | xls | pdf
  file_size_bytes bigint NOT NULL DEFAULT 0,
  storage_key text,
  import_type text NOT NULL DEFAULT 'product',  -- target sheet/mapper
  uploaded_by uuid REFERENCES users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'processing',
    CHECK (status IN ('processing','preview_ready','awaiting_confirmation',
                      'imported','partially_imported','failed','cancelled')),
  total_records int NOT NULL DEFAULT 0,
  imported_count int NOT NULL DEFAULT 0,
  updated_count int NOT NULL DEFAULT 0,
  skipped_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  duplicate_count int NOT NULL DEFAULT 0,
  needs_review_count int NOT NULL DEFAULT 0,
  processing_duration_ms int NOT NULL DEFAULT 0,
  fields_detected int NOT NULL DEFAULT 0,
  sheets text[] NOT NULL DEFAULT '{}',
  summary jsonb NOT NULL DEFAULT '{}',       -- import type stats
  error_summary jsonb NOT NULL DEFAULT '{}',
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_history_uploaded ON import_history (uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_history_status ON import_history (status);

CREATE TABLE IF NOT EXISTS import_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES import_history(id) ON DELETE CASCADE,
  row_index int NOT NULL,
  sheet text,
  action text,                         -- create | update | duplicate | needs_review | invalid | skipped
  operation text,                      -- create | update (set after confirm)
  extracted jsonb NOT NULL DEFAULT '{}',     -- original extracted values (preserved verbatim)
  mapped jsonb NOT NULL DEFAULT '{}',        -- mapped project fields
  warnings jsonb NOT NULL DEFAULT '[]',
  errors jsonb NOT NULL DEFAULT '[]',
  resolved_entity_id uuid,             -- product (etc.) created/updated
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_import_records_import ON import_records (import_id);

-- Reuse the existing audit system for import actions (RB-015).
-- No new secrets/credentials are ever stored; only file metadata + counts.