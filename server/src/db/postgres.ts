/**
 * PostgreSQL + PostGIS Production Migration & Repository Layer
 * Supports spatial queries (ST_DWithin), connection pooling, and multi-node clusters.
 */

export const POSTGRES_POSTGIS_SCHEMA = `
-- Enable PostGIS extension for high-performance geospatial spatial indexing
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(64) UNIQUE,
  phone VARCHAR(32) UNIQUE NOT NULL,
  email VARCHAR(128) UNIQUE,
  name VARCHAR(128) NOT NULL,
  role VARCHAR(32) NOT NULL,
  avatar_url TEXT,
  password_hash VARCHAR(256),
  preferred_language VARCHAR(8) DEFAULT 'en',
  status VARCHAR(32) DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Driver Profiles with PostGIS Geography Point
CREATE TABLE IF NOT EXISTS driver_profiles (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating_avg NUMERIC(3, 2) DEFAULT 5.00,
  total_trips INT DEFAULT 0,
  acceptance_rate NUMERIC(5, 2) DEFAULT 100.00,
  cancellation_rate NUMERIC(5, 2) DEFAULT 0.00,
  availability_status VARCHAR(32) DEFAULT 'OFFLINE',
  verification_status VARCHAR(32) DEFAULT 'DOCUMENTS_PENDING',
  current_location GEOGRAPHY(Point, 4326),
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  heading DOUBLE PRECISION DEFAULT 0.0,
  is_favorite_opt_in BOOLEAN DEFAULT TRUE,
  custom_base_fare NUMERIC(10, 2),
  custom_per_km_rate NUMERIC(10, 2),
  last_location_update TIMESTAMPTZ
);

-- Spatial GiST Index for sub-millisecond driver proximity queries
CREATE INDEX IF NOT EXISTS idx_driver_profiles_location_gist ON driver_profiles USING GIST (current_location);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_status ON driver_profiles (availability_status, verification_status);

-- Bookings with PostGIS Pickup & Destination Geometries
CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(64) PRIMARY KEY,
  booking_number VARCHAR(64) UNIQUE NOT NULL,
  passenger_id VARCHAR(64) NOT NULL REFERENCES users(id),
  driver_id VARCHAR(64) REFERENCES driver_profiles(id),
  vehicle_category_id VARCHAR(64) NOT NULL,
  booking_type VARCHAR(32) DEFAULT 'INSTANT',
  pickup_location GEOGRAPHY(Point, 4326),
  pickup_lat DOUBLE PRECISION NOT NULL,
  pickup_lng DOUBLE PRECISION NOT NULL,
  pickup_address TEXT NOT NULL,
  destination_location GEOGRAPHY(Point, 4326),
  destination_lat DOUBLE PRECISION NOT NULL,
  destination_lng DOUBLE PRECISION NOT NULL,
  destination_address TEXT NOT NULL,
  distance_km NUMERIC(8, 2) NOT NULL,
  duration_min INT NOT NULL,
  otp_code VARCHAR(8) NOT NULL,
  fare_estimate NUMERIC(10, 2) NOT NULL,
  final_fare NUMERIC(10, 2),
  surge_multiplier NUMERIC(4, 2) DEFAULT 1.0,
  payment_method VARCHAR(32) DEFAULT 'UPI',
  payment_status VARCHAR(32) DEFAULT 'PENDING',
  status VARCHAR(32) NOT NULL DEFAULT 'CREATED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bookings_pickup_gist ON bookings USING GIST (pickup_location);
CREATE INDEX IF NOT EXISTS idx_bookings_dest_gist ON bookings USING GIST (destination_location);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_passenger ON bookings (passenger_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_driver ON bookings (driver_id, status);

-- Persistent Authentication Sessions
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

-- Payment Intents & Real Gateway State Machine
CREATE TABLE IF NOT EXISTS payment_intents (
  id VARCHAR(64) PRIMARY KEY,
  booking_id VARCHAR(64) NOT NULL REFERENCES bookings(id),
  user_id VARCHAR(64) NOT NULL REFERENCES users(id),
  amount_paise BIGINT NOT NULL,
  currency VARCHAR(8) DEFAULT 'INR',
  provider VARCHAR(32) NOT NULL,
  provider_order_id VARCHAR(128) UNIQUE,
  provider_payment_id VARCHAR(128),
  signature TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'CREATED',
  idempotency_key VARCHAR(128) UNIQUE NOT NULL,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_order ON payment_intents (provider_order_id, status);

-- Double-Entry Ledger System (Paise Precision)
CREATE TABLE IF NOT EXISTS ledger_accounts (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id),
  account_type VARCHAR(32) NOT NULL,
  currency VARCHAR(8) DEFAULT 'INR',
  balance_paise BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ledger_transactions (
  id VARCHAR(64) PRIMARY KEY,
  booking_id VARCHAR(64) REFERENCES bookings(id),
  transaction_type VARCHAR(32) NOT NULL,
  reference_id VARCHAR(128),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id VARCHAR(64) PRIMARY KEY,
  transaction_id VARCHAR(64) NOT NULL REFERENCES ledger_transactions(id) ON DELETE CASCADE,
  account_id VARCHAR(64) NOT NULL REFERENCES ledger_accounts(id),
  entry_type VARCHAR(16) NOT NULL, -- 'DEBIT', 'CREDIT'
  amount_paise BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

export class PostgresSpatialHelper {
  /**
   * Generates PostGIS SQL query for sub-millisecond nearby driver search
   * Uses ST_DWithin on spatial geography points with meter radius
   */
  public static buildNearbyDriversQuery(
    lat: number,
    lng: number,
    radiusMeters: number,
    categoryId: string
  ): { sql: string; values: any[] } {
    const sql = `
      SELECT 
        d.id as driver_id,
        d.user_id,
        u.name as driver_name,
        d.rating_avg,
        d.current_lat,
        d.current_lng,
        d.heading,
        v.plate_number,
        v.brand,
        v.model,
        ST_Distance(
          d.current_location,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1000.0 as distance_km
      FROM driver_profiles d
      JOIN users u ON d.user_id = u.id
      JOIN vehicles v ON v.driver_id = d.id
      WHERE d.availability_status = 'ONLINE'
        AND d.verification_status = 'VERIFIED'
        AND v.vehicle_category_id = $3
        AND ST_DWithin(
          d.current_location,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $4
        )
      ORDER BY distance_km ASC
      LIMIT 10;
    `;
    return {
      sql,
      values: [lng, lat, categoryId, radiusMeters]
    };
  }
}
