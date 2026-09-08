-- 007: Add logo_url to brands for brand logo images

ALTER TABLE brands ADD COLUMN IF NOT EXISTS logo_url text;
