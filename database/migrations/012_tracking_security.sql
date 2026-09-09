-- Migration 012: Live tracking, session monitoring, profile completion, security settings
-- 1) user_sessions   — one row per user login per browser tab (heartbeat-updated)
-- 2) users.profile_updated_at — set when the user saves their profile; UI blocks until set
-- 3) settings seed   — security.devtoolsBlock default ON (admin can toggle from topbar)

ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_updated_at timestamptz;

CREATE TABLE IF NOT EXISTS user_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tab_id        text NOT NULL,
  login_at      timestamptz NOT NULL DEFAULT now(),
  logout_at     timestamptz,
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  ip_address    text,
  user_agent    text,
  device_type   text,                    -- desktop | mobile | tablet
  browser       text,
  os            text,
  screen        text,
  current_route text,
  current_title text,
  latitude      double precision,
  longitude     double precision,
  location_accuracy double precision,
  devtools_seen boolean NOT NULL DEFAULT false,
  ended_reason  text,                    -- 'logout' | 'devtools'
  CONSTRAINT uq_user_session_tab UNIQUE (user_id, tab_id)
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_seen ON user_sessions(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);

INSERT INTO settings (key, value, description)
VALUES ('security', '{"devtoolsBlock": true}'::jsonb,
        'DevTools blocking — when on, opening browser developer tools blocks login and ends the session')
ON CONFLICT (key) DO NOTHING;
