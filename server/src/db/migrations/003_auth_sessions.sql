-- Migration 003: Persistent Authentication Sessions & Token Rotation Lineage
CREATE TABLE IF NOT EXISTS auth_sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash VARCHAR(128) UNIQUE NOT NULL,
  device_id VARCHAR(128),
  device_name VARCHAR(128),
  ip VARCHAR(64) NOT NULL,
  user_agent TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  rotated_from VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions (user_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_hash ON auth_sessions (refresh_token_hash);
