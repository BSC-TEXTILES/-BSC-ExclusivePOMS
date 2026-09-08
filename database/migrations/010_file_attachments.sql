-- Migration 010: Standalone file attachments table
-- For general file management (PDF, Excel, Word, images, video, any format)

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
