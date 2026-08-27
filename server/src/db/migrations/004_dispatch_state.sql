-- Migration 004: Bookings, Stops, State Events & Scheduled Rides
CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(64) PRIMARY KEY,
  booking_number VARCHAR(64) UNIQUE NOT NULL,
  passenger_id VARCHAR(64) NOT NULL REFERENCES users(id),
  driver_id VARCHAR(64) REFERENCES driver_profiles(id),
  vehicle_category_id VARCHAR(64) NOT NULL REFERENCES vehicle_categories(id),
  booking_type VARCHAR(32) DEFAULT 'INSTANT',
  pickup_location GEOGRAPHY(Point, 4326),
  pickup_lat DOUBLE PRECISION NOT NULL,
  pickup_lng DOUBLE PRECISION NOT NULL,
  pickup_address TEXT NOT NULL,
  destination_location GEOGRAPHY(Point, 4326),
  destination_lat DOUBLE PRECISION NOT NULL,
  destination_lng DOUBLE PRECISION NOT NULL,
  destination_address TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  distance_km NUMERIC(8, 2) NOT NULL,
  duration_min INT NOT NULL,
  otp_code VARCHAR(8) NOT NULL,
  fare_estimate NUMERIC(10, 2) NOT NULL,
  final_fare NUMERIC(10, 2),
  fare_source VARCHAR(32) DEFAULT 'ESTIMATE',
  fare_rule_version VARCHAR(16) DEFAULT 'v1.0',
  surge_multiplier NUMERIC(4, 2) DEFAULT 1.0,
  payment_method VARCHAR(32) DEFAULT 'UPI',
  payment_status VARCHAR(32) DEFAULT 'PENDING',
  status VARCHAR(32) NOT NULL DEFAULT 'CREATED',
  accepted_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancellation_fee NUMERIC(10, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bookings_pickup_gist ON bookings USING GIST (pickup_location);
CREATE INDEX IF NOT EXISTS idx_bookings_dest_gist ON bookings USING GIST (destination_location);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_passenger ON bookings (passenger_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_driver ON bookings (driver_id, status);

CREATE TABLE IF NOT EXISTS booking_stops (
  id VARCHAR(64) PRIMARY KEY,
  booking_id VARCHAR(64) NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  stop_order INT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  address TEXT NOT NULL,
  reached_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS booking_state_events (
  id VARCHAR(64) PRIMARY KEY,
  booking_id VARCHAR(64) NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  previous_state VARCHAR(32) NOT NULL,
  new_state VARCHAR(32) NOT NULL,
  actor_id VARCHAR(64) NOT NULL,
  actor_role VARCHAR(32) NOT NULL,
  reason TEXT,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_state_events_booking ON booking_state_events (booking_id, created_at);

CREATE TABLE IF NOT EXISTS scheduled_bookings (
  id VARCHAR(64) PRIMARY KEY,
  passenger_id VARCHAR(64) NOT NULL REFERENCES users(id),
  vehicle_category_id VARCHAR(64) NOT NULL REFERENCES vehicle_categories(id),
  preferred_driver_id VARCHAR(64) REFERENCES driver_profiles(id),
  pickup_lat DOUBLE PRECISION NOT NULL,
  pickup_lng DOUBLE PRECISION NOT NULL,
  pickup_address TEXT NOT NULL,
  destination_lat DOUBLE PRECISION NOT NULL,
  destination_lng DOUBLE PRECISION NOT NULL,
  destination_address TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  recurrence_rule VARCHAR(64),
  status VARCHAR(32) DEFAULT 'PENDING',
  payment_method VARCHAR(32) DEFAULT 'UPI',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
