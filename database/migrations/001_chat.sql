-- ============================================================
-- POMS EXTENSION MIGRATION 001 — Team Chat (§18 communication)
-- Adds division-scoped team chat; live delivery via WebSocket.
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id uuid REFERENCES divisions(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  body        text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_div_time ON chat_messages (division_id, created_at DESC);
