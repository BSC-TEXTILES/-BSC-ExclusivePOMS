-- Migration 018: Enforce bcrypt hash format in password_hash column
-- Defense-in-depth: ensures only valid bcrypt hashes can be stored

-- Add CHECK constraint to validate bcrypt hash format
-- Bcrypt hashes start with $2a$, $2b$, or $2y$ followed by cost factor and 53 chars of salt+hash
ALTER TABLE users ADD CONSTRAINT chk_password_hash_format
  CHECK (password_hash ~ '^\$2[aby]?\$\d{1,2}\$.{53}$');

-- Update the comment on password_hash column
COMMENT ON COLUMN users.password_hash IS 'bcrypt hash — never plaintext, validated by chk_password_hash_format';
