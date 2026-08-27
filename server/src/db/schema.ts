export const SCHEMA_SQL = `
-- Enable foreign key enforcement
PRAGMA foreign_keys = ON;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  phone TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'PASSENGER',
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  emergency_contact TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Passenger Profiles
CREATE TABLE IF NOT EXISTS passenger_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  default_vehicle_category_id TEXT,
  default_payment_method TEXT NOT NULL DEFAULT 'UPI',
  wallet_balance REAL NOT NULL DEFAULT 500.0,
  rating_avg REAL NOT NULL DEFAULT 4.9,
  total_rides INTEGER NOT NULL DEFAULT 0
);

-- Driver Profiles
CREATE TABLE IF NOT EXISTS driver_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fleet_id TEXT,
  verification_status TEXT NOT NULL DEFAULT 'VERIFIED',
  availability_status TEXT NOT NULL DEFAULT 'ONLINE',
  current_lat REAL NOT NULL DEFAULT 10.5276,
  current_lng REAL NOT NULL DEFAULT 76.2144,
  heading REAL NOT NULL DEFAULT 0,
  last_location_update TEXT NOT NULL DEFAULT (datetime('now')),
  rating_avg REAL NOT NULL DEFAULT 4.85,
  acceptance_rate REAL NOT NULL DEFAULT 0.95,
  cancellation_rate REAL NOT NULL DEFAULT 0.03,
  total_trips INTEGER NOT NULL DEFAULT 24,
  custom_fare_enabled INTEGER NOT NULL DEFAULT 1,
  accepts_favorite_requests INTEGER NOT NULL DEFAULT 1,
  accepts_scheduled_rides INTEGER NOT NULL DEFAULT 1,
  accepts_airport_rides INTEGER NOT NULL DEFAULT 1,
  accepts_outstation INTEGER NOT NULL DEFAULT 1,
  accepts_cash INTEGER NOT NULL DEFAULT 1,
  free_pickup_km REAL NOT NULL DEFAULT 2.0,
  pickup_charge_per_km REAL NOT NULL DEFAULT 10.0,
  operating_zone TEXT DEFAULT 'Thrissur & Central Kerala'
);

-- Vehicle Categories (Configurable catalogue)
CREATE TABLE IF NOT EXISTS vehicle_categories (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  vehicle_class TEXT NOT NULL,
  passenger_capacity INTEGER NOT NULL DEFAULT 4,
  luggage_capacity INTEGER NOT NULL DEFAULT 2,
  base_fare REAL NOT NULL DEFAULT 40.0,
  minimum_fare REAL NOT NULL DEFAULT 60.0,
  per_km_rate REAL NOT NULL DEFAULT 12.0,
  per_minute_rate REAL NOT NULL DEFAULT 2.0,
  waiting_rate REAL NOT NULL DEFAULT 2.0,
  booking_fee REAL NOT NULL DEFAULT 5.0,
  platform_fee REAL NOT NULL DEFAULT 5.0,
  tax_percent REAL NOT NULL DEFAULT 5.0,
  commission_percent REAL NOT NULL DEFAULT 12.0,
  cancellation_fee REAL NOT NULL DEFAULT 30.0,
  night_charge_multiplier REAL NOT NULL DEFAULT 1.25,
  surge_enabled INTEGER NOT NULL DEFAULT 1,
  driver_custom_fare_allowed INTEGER NOT NULL DEFAULT 1,
  max_deviation_percent REAL NOT NULL DEFAULT 20.0,
  admin_fare_enabled INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 1,
  icon TEXT NOT NULL,
  image TEXT NOT NULL
);

-- Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  driver_id TEXT UNIQUE NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  vehicle_category_id TEXT NOT NULL REFERENCES vehicle_categories(id),
  vehicle_type TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  color TEXT NOT NULL,
  plate_number TEXT UNIQUE NOT NULL,
  seating_capacity INTEGER NOT NULL DEFAULT 4,
  luggage_capacity INTEGER NOT NULL DEFAULT 2,
  ac_enabled INTEGER NOT NULL DEFAULT 1,
  is_ev INTEGER NOT NULL DEFAULT 0,
  wheelchair_accessible INTEGER NOT NULL DEFAULT 0,
  pet_friendly INTEGER NOT NULL DEFAULT 1,
  child_seat_available INTEGER NOT NULL DEFAULT 0,
  dashcam_equipped INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
);

-- Driver Documents
CREATE TABLE IF NOT EXISTS driver_documents (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  doc_number TEXT NOT NULL,
  file_url TEXT NOT NULL,
  expiry_date TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'VERIFIED',
  verified_by TEXT,
  verified_at TEXT,
  rejection_reason TEXT
);

-- Driver Custom Pricing
CREATE TABLE IF NOT EXISTS driver_pricing (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  vehicle_category_id TEXT NOT NULL REFERENCES vehicle_categories(id),
  custom_base_fare REAL NOT NULL,
  custom_per_km REAL NOT NULL,
  custom_per_minute REAL NOT NULL,
  custom_waiting_rate REAL NOT NULL,
  custom_minimum_fare REAL NOT NULL,
  free_pickup_km REAL NOT NULL DEFAULT 2.0,
  pickup_charge_per_km REAL NOT NULL DEFAULT 10.0,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  approved_by_admin INTEGER NOT NULL DEFAULT 1,
  effective_from TEXT NOT NULL DEFAULT (datetime('now')),
  effective_until TEXT,
  UNIQUE(driver_id, vehicle_category_id)
);

-- User Two-Way Blocks
CREATE TABLE IF NOT EXISTS user_blocks (
  id TEXT PRIMARY KEY,
  blocker_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  block_type TEXT NOT NULL DEFAULT 'PASSENGER_TO_DRIVER',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL,
  UNIQUE(blocker_user_id, blocked_user_id)
);

-- Passenger Favorite Drivers
CREATE TABLE IF NOT EXISTS favorites (
  id TEXT PRIMARY KEY,
  passenger_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  UNIQUE(passenger_id, driver_id)
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  booking_number TEXT UNIQUE NOT NULL,
  passenger_id TEXT NOT NULL REFERENCES users(id),
  driver_id TEXT REFERENCES driver_profiles(id),
  vehicle_id TEXT REFERENCES vehicles(id),
  vehicle_category_id TEXT NOT NULL REFERENCES vehicle_categories(id),
  booking_type TEXT NOT NULL DEFAULT 'INSTANT',
  pickup_lat REAL NOT NULL,
  pickup_lng REAL NOT NULL,
  pickup_address TEXT NOT NULL,
  destination_lat REAL NOT NULL,
  destination_lng REAL NOT NULL,
  destination_address TEXT NOT NULL,
  scheduled_at TEXT,
  distance_km REAL NOT NULL DEFAULT 0.0,
  duration_min REAL NOT NULL DEFAULT 0.0,
  otp_code TEXT NOT NULL,
  fare_estimate REAL NOT NULL,
  final_fare REAL,
  fare_source TEXT NOT NULL DEFAULT 'PLATFORM_COMMON',
  fare_rule_version TEXT NOT NULL DEFAULT '1.0',
  surge_multiplier REAL NOT NULL DEFAULT 1.0,
  payment_method TEXT NOT NULL DEFAULT 'UPI',
  payment_status TEXT NOT NULL DEFAULT 'PENDING',
  status TEXT NOT NULL DEFAULT 'CREATED',
  cancellation_reason TEXT,
  cancellation_fee REAL DEFAULT 0.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at TEXT,
  arrived_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT
);

-- Booking Stops (Multi-stop trips)
CREATE TABLE IF NOT EXISTS booking_stops (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  address TEXT NOT NULL,
  arrived_at TEXT,
  completed_at TEXT
);

-- Fare Quotes (Itemized snapshots)
CREATE TABLE IF NOT EXISTS fare_quotes (
  id TEXT PRIMARY KEY,
  booking_id TEXT,
  vehicle_category_id TEXT NOT NULL REFERENCES vehicle_categories(id),
  fare_rule_version TEXT NOT NULL DEFAULT '1.0',
  fare_source TEXT NOT NULL,
  base_fare REAL NOT NULL,
  distance_fare REAL NOT NULL,
  time_fare REAL NOT NULL,
  waiting_fare REAL NOT NULL,
  booking_fee REAL NOT NULL,
  surge_amount REAL NOT NULL,
  surge_multiplier REAL NOT NULL,
  tax_amount REAL NOT NULL,
  discount_amount REAL NOT NULL,
  total_fare REAL NOT NULL,
  estimated_fare_min REAL NOT NULL,
  estimated_fare_max REAL NOT NULL,
  platform_commission REAL NOT NULL,
  driver_payout REAL NOT NULL,
  distance_km REAL NOT NULL,
  duration_min REAL NOT NULL,
  expires_at TEXT NOT NULL
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  payment_method TEXT NOT NULL,
  gateway_transaction_id TEXT UNIQUE NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Wallets
CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance REAL NOT NULL DEFAULT 500.0,
  currency TEXT NOT NULL DEFAULT 'INR',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Wallet Transactions & Immutable Ledger
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  type TEXT NOT NULL, -- CREDIT | DEBIT
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Driver Earnings
CREATE TABLE IF NOT EXISTS driver_earnings (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES driver_profiles(id),
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  gross_fare REAL NOT NULL,
  platform_commission REAL NOT NULL,
  tax_deducted REAL NOT NULL,
  net_earning REAL NOT NULL,
  cash_collected REAL NOT NULL DEFAULT 0.0,
  settlement_status TEXT NOT NULL DEFAULT 'SETTLED',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Scheduled & Recurring Bookings
CREATE TABLE IF NOT EXISTS scheduled_bookings (
  id TEXT PRIMARY KEY,
  passenger_id TEXT NOT NULL REFERENCES users(id),
  driver_preference TEXT NOT NULL DEFAULT 'ANY',
  specific_driver_id TEXT REFERENCES driver_profiles(id),
  vehicle_category_id TEXT NOT NULL REFERENCES vehicle_categories(id),
  pickup_lat REAL NOT NULL,
  pickup_lng REAL NOT NULL,
  pickup_address TEXT NOT NULL,
  destination_lat REAL NOT NULL,
  destination_lng REAL NOT NULL,
  destination_address TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  recurrence_rule TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  flight_or_train_number TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- SOS Events
CREATE TABLE IF NOT EXISTS sos_events (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  triggered_by_user_id TEXT NOT NULL REFERENCES users(id),
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  resolved_by TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Geofences & Surge Zones
CREATE TABLE IF NOT EXISTS geofences (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  zone_type TEXT NOT NULL,
  center_lat REAL NOT NULL,
  center_lng REAL NOT NULL,
  radius_meters REAL NOT NULL,
  surge_multiplier REAL NOT NULL DEFAULT 1.0,
  surcharge_amount REAL NOT NULL DEFAULT 0.0,
  active INTEGER NOT NULL DEFAULT 1
);

-- Ratings & Reviews
CREATE TABLE IF NOT EXISTS ratings (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  rater_id TEXT NOT NULL REFERENCES users(id),
  rated_user_id TEXT NOT NULL REFERENCES users(id),
  rating REAL NOT NULL,
  tags TEXT NOT NULL, -- JSON string array
  comment TEXT,
  is_safety_report INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id),
  sender_role TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Support Tickets & Lost & Found
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  booking_id TEXT REFERENCES bookings(id),
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Complaints & Grievance Redressal (Passenger / Driver / Ride / Fare)
CREATE TABLE IF NOT EXISTS complaints (
  id TEXT PRIMARY KEY,
  ticket_number TEXT UNIQUE NOT NULL,
  complainant_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  complainant_role TEXT NOT NULL DEFAULT 'PASSENGER',
  target_type TEXT NOT NULL DEFAULT 'DRIVER',
  target_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'MEDIUM',
  status TEXT NOT NULL DEFAULT 'OPEN',
  resolution_notes TEXT,
  resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Immutable Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  old_values TEXT,
  new_values TEXT,
  reason_code TEXT,
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tour Packages
CREATE TABLE IF NOT EXISTS tour_packages (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  destination TEXT NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 2,
  duration_nights INTEGER NOT NULL DEFAULT 1,
  base_price REAL NOT NULL,
  vehicle_types_json TEXT NOT NULL,
  included_items_json TEXT NOT NULL,
  itinerary_json TEXT NOT NULL,
  image_url TEXT NOT NULL,
  badge TEXT,
  rating REAL NOT NULL DEFAULT 4.9,
  active INTEGER NOT NULL DEFAULT 1
);

-- Parcel & Local Shop Deliveries
CREATE TABLE IF NOT EXISTS parcel_deliveries (
  id TEXT PRIMARY KEY,
  booking_id TEXT REFERENCES bookings(id),
  sender_id TEXT NOT NULL REFERENCES users(id),
  receiver_name TEXT NOT NULL,
  receiver_phone TEXT NOT NULL,
  package_type TEXT NOT NULL,
  weight_category TEXT NOT NULL,
  is_fragile INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  delivery_pin TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Feature Flags
CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL
);

-- Idempotency Keys (Prevent duplicate bookings & payments)
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  operation TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PROCESSING',
  response_code INTEGER,
  response_body TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Booking State Events (Immutable audit trail of all state transitions)
CREATE TABLE IF NOT EXISTS booking_state_events (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  previous_state TEXT NOT NULL,
  new_state TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES users(id),
  actor_role TEXT NOT NULL,
  reason TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Driver Availability Leases (Atomic reservation preventing race conditions)
CREATE TABLE IF NOT EXISTS driver_leases (
  driver_id TEXT PRIMARY KEY REFERENCES driver_profiles(id),
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  status TEXT NOT NULL DEFAULT 'OFFERED',
  lease_expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Immutable Double-Entry Ledger (Financial precision in Paise)
CREATE TABLE IF NOT EXISTS ledger_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  account_type TEXT NOT NULL, -- 'USER_WALLET', 'PLATFORM_REVENUE', 'PLATFORM_CLEARING', 'DRIVER_PAYABLE', 'TAX_PAYABLE'
  currency TEXT NOT NULL DEFAULT 'INR',
  balance_paise INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ledger_transactions (
  id TEXT PRIMARY KEY,
  booking_id TEXT REFERENCES bookings(id),
  transaction_type TEXT NOT NULL, -- 'RIDE_PAYMENT', 'WALLET_TOPUP', 'DRIVER_PAYOUT', 'REFUND', 'CANCELLATION_FEE'
  reference_id TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES ledger_transactions(id),
  account_id TEXT NOT NULL REFERENCES ledger_accounts(id),
  entry_type TEXT NOT NULL, -- 'DEBIT', 'CREDIT'
  amount_paise INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Trip Live-Share Tokens with Cryptographic Hash Lifecycle
CREATE TABLE IF NOT EXISTS trip_share_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_accessed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Payment Intents & Real Gateway State Machine
CREATE TABLE IF NOT EXISTS payment_intents (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  amount_paise INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  provider TEXT NOT NULL, -- 'RAZORPAY', 'CASHFREE', 'UPI_INTENT', 'WALLET', 'CASH'
  provider_order_id TEXT UNIQUE,
  provider_payment_id TEXT,
  signature TEXT,
  status TEXT NOT NULL DEFAULT 'CREATED', -- 'CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED'
  idempotency_key TEXT UNIQUE NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Booking Cryptographic OTP Verification Guardrails
CREATE TABLE IF NOT EXISTS booking_otp_verifications (
  booking_id TEXT PRIMARY KEY REFERENCES bookings(id),
  otp_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Persistent Authentication Sessions with Refresh Token Rotation
CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  refresh_token_hash TEXT UNIQUE NOT NULL,
  device_id TEXT,
  device_name TEXT,
  ip TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT,
  rotated_from TEXT
);

-- Indexes for lightning fast geospatial & lifecycle queries
CREATE INDEX IF NOT EXISTS idx_driver_status ON driver_profiles(availability_status, verification_status);
CREATE INDEX IF NOT EXISTS idx_driver_location ON driver_profiles(current_lat, current_lng);
CREATE INDEX IF NOT EXISTS idx_booking_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_booking_passenger ON bookings(passenger_id, status);
CREATE INDEX IF NOT EXISTS idx_booking_driver ON bookings(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_blocks ON user_blocks(blocker_user_id, blocked_user_id);
CREATE INDEX IF NOT EXISTS idx_favorites ON favorites(passenger_id, driver_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_fav_pass_driver ON favorites(passenger_id, driver_id, status);
CREATE INDEX IF NOT EXISTS idx_block_users ON user_blocks(blocker_user_id, blocked_user_id, status);
CREATE INDEX IF NOT EXISTS idx_state_events_booking ON booking_state_events(booking_id, created_at);
CREATE INDEX IF NOT EXISTS idx_driver_leases ON driver_leases(driver_id, status, lease_expires_at);
CREATE INDEX IF NOT EXISTS idx_trip_share_token_hash ON trip_share_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_payment_intents_order ON payment_intents(provider_order_id, status);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_hash ON auth_sessions(refresh_token_hash);
`;
