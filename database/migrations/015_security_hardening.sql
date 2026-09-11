-- ============================================================
-- MIGRATION 015: Add password_changed_at column for token invalidation
-- ============================================================

-- Add password_changed_at column to support token invalidation on password change.
-- When a user changes their password, this timestamp is updated. Tokens issued
-- before this timestamp are rejected by the authenticate middleware.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;

-- Add index for faster lookups during authentication
CREATE INDEX IF NOT EXISTS idx_users_password_changed_at ON users(password_changed_at);

-- Backfill existing users: set password_changed_at to updated_at for existing records
UPDATE users SET password_changed_at = updated_at WHERE password_changed_at IS NULL;
