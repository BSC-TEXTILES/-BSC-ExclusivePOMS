-- Migration 017: Add Clerk authentication support
-- Adds clerk_id column to users table for Clerk user sync

-- Add clerk_id column for linking Clerk users to existing DB users
ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_id TEXT UNIQUE;

-- Create index for fast lookups by clerk_id
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users (clerk_id);

-- Comment for documentation
COMMENT ON COLUMN users.clerk_id IS 'Clerk user ID for authentication sync';
