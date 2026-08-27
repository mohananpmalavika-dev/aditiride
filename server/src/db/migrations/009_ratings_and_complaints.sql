-- Migration 009: Two-Way Ratings and Complaints Architecture
CREATE TABLE IF NOT EXISTS complaints (
  id TEXT PRIMARY KEY,
  ticket_number TEXT UNIQUE NOT NULL,
  complainant_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  complainant_role TEXT NOT NULL DEFAULT 'PASSENGER',
  target_type TEXT NOT NULL DEFAULT 'DRIVER', -- DRIVER | PASSENGER | RIDE | FARE | SAFETY | APP
  target_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'MEDIUM', -- LOW | MEDIUM | HIGH | CRITICAL
  status TEXT NOT NULL DEFAULT 'OPEN', -- OPEN | UNDER_REVIEW | RESOLVED | REJECTED
  resolution_notes TEXT,
  resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_complaints_user ON complaints(complainant_user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_booking ON complaints(booking_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
