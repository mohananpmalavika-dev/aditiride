-- Migration 007: Safety Tokens, OTP Guardrails, Favorites, Blocks, and Audit Trail
CREATE TABLE IF NOT EXISTS booking_otp_verifications (
  booking_id VARCHAR(64) PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
  otp_hash VARCHAR(128) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trip_share_tokens (
  id VARCHAR(64) PRIMARY KEY,
  token_hash VARCHAR(128) UNIQUE NOT NULL,
  booking_id VARCHAR(64) NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  created_by VARCHAR(64) NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trip_share_token_hash ON trip_share_tokens (token_hash);

CREATE TABLE IF NOT EXISTS favorites (
  id VARCHAR(64) PRIMARY KEY,
  passenger_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_id VARCHAR(64) NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  status VARCHAR(32) DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(passenger_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_lookup ON favorites (passenger_id, driver_id, status);

CREATE TABLE IF NOT EXISTS user_blocks (
  id VARCHAR(64) PRIMARY KEY,
  blocker_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(64),
  notes TEXT,
  status VARCHAR(32) DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(blocker_user_id, blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_lookup ON user_blocks (blocker_user_id, blocked_user_id, status);

CREATE TABLE IF NOT EXISTS sos_events (
  id VARCHAR(64) PRIMARY KEY,
  booking_id VARCHAR(64) NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  triggered_by_user_id VARCHAR(64) NOT NULL REFERENCES users(id),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  status VARCHAR(32) DEFAULT 'ACTIVE',
  notes TEXT,
  resolved_by VARCHAR(64) REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  actor_user_id VARCHAR(64) NOT NULL,
  actor_role VARCHAR(32) NOT NULL,
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  reason_code VARCHAR(64),
  ip_address VARCHAR(64) NOT NULL,
  user_agent TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON audit_logs (created_at);
