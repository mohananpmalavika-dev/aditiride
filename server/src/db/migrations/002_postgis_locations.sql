-- Migration 002: PostGIS Extension, Driver Profiles & Spatial Indexing
CREATE EXTENSION IF NOT EXISTS postgis;

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
  accepts_favorite_requests BOOLEAN DEFAULT TRUE,
  custom_base_fare NUMERIC(10, 2),
  custom_per_km_rate NUMERIC(10, 2),
  last_location_update TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_driver_profiles_location_gist ON driver_profiles USING GIST (current_location);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_status ON driver_profiles (availability_status, verification_status);

CREATE TABLE IF NOT EXISTS vehicles (
  id VARCHAR(64) PRIMARY KEY,
  driver_id VARCHAR(64) NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  vehicle_category_id VARCHAR(64) NOT NULL REFERENCES vehicle_categories(id),
  brand VARCHAR(64) NOT NULL,
  model VARCHAR(64) NOT NULL,
  color VARCHAR(32) NOT NULL,
  plate_number VARCHAR(32) UNIQUE NOT NULL,
  year INT,
  rc_number VARCHAR(64),
  insurance_number VARCHAR(64),
  permit_type VARCHAR(32),
  status VARCHAR(32) DEFAULT 'ACTIVE'
);

CREATE INDEX IF NOT EXISTS idx_vehicles_driver ON vehicles (driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_category ON vehicles (vehicle_category_id, status);
