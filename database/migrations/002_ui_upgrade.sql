-- ============================================================
-- MIGRATION 002 — Workspace UI upgrade
--  · product_images        — gallery per product (primary + alternates)
--  · attachments indexes   — fast polymorphic lookup + PO file drawers
--  · users.profile         — avatar + designation for the new top bar
--  · notification prefs    — none needed; notifications table already exists
-- Run: psql -h localhost -p 5433 -U postgres -d poms -f 002_ui_upgrade.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS product_images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  file_name   text NOT NULL,
  mime_type   text NOT NULL,
  size_bytes  bigint NOT NULL,
  storage_key text NOT NULL,                 -- path under backend/uploads
  is_primary  boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  uploaded_by uuid REFERENCES users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id, is_primary DESC, sort_order);

CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id, uploaded_at DESC);

ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS designation text;

-- Landing/demo helper: settings row documenting upload policy
INSERT INTO settings (key, value, description)
VALUES ('uploads.policy', '{"maxSizeMb": 200, "allowed": "*"}'::jsonb,
        'Universal attachment policy: every file type accepted up to the size cap')
ON CONFLICT (key) DO NOTHING;
