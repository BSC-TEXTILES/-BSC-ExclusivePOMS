-- ============================================================
-- MIGRATION 005: Training / Media Video Library
-- Stores video metadata + file reference for the redesigned
-- video section (list, detail, player, permissions).
-- ============================================================

CREATE TABLE IF NOT EXISTS videos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  description   text,
  category      text NOT NULL DEFAULT 'general',   -- training | product | process | marketing | other
  module        text,                              -- related project module, e.g. 'purchase_orders'
  file_name     text NOT NULL,
  mime_type     text NOT NULL,
  size_bytes    bigint NOT NULL,
  storage_key   text NOT NULL,                     -- path under backend/uploads
  thumbnail_key text,                              -- optional poster image
  duration_seconds integer,
  status        entity_status NOT NULL DEFAULT 'active',
  uploaded_by   uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category, status);
CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created_at DESC);

DO $$ BEGIN
  CREATE TRIGGER trg_videos_upd BEFORE UPDATE ON videos
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Permission for video management
INSERT INTO permissions (code, module, description) VALUES
  ('videos.view', 'video', 'View video library'),
  ('videos.manage', 'video', 'Upload/edit/archive videos')
ON CONFLICT (code) DO NOTHING;

-- Grant to admin roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('super_admin', 'admin', 'domain_admin', 'men_collection_manager')
  AND p.code IN ('videos.view', 'videos.manage')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('super_admin', 'admin', 'domain_admin', 'purchase_manager', 'purchase_executive', 'viewer')
  AND p.code = 'videos.view'
ON CONFLICT DO NOTHING;