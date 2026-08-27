-- Migration 001: Initial Core Schema
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(64) UNIQUE,
  phone VARCHAR(32) UNIQUE NOT NULL,
  email VARCHAR(128) UNIQUE,
  name VARCHAR(128) NOT NULL,
  role VARCHAR(32) NOT NULL,
  avatar_url TEXT,
  password_hash VARCHAR(256) NOT NULL,
  preferred_language VARCHAR(8) DEFAULT 'en',
  status VARCHAR(32) DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS passenger_profiles (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  default_vehicle_category_id VARCHAR(64),
  default_payment_method VARCHAR(32) DEFAULT 'UPI',
  wallet_balance NUMERIC(10, 2) DEFAULT 0.00,
  rating_avg NUMERIC(3, 2) DEFAULT 5.00,
  total_rides INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicle_categories (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(32) UNIQUE NOT NULL,
  name VARCHAR(64) NOT NULL,
  display_name VARCHAR(64) NOT NULL,
  description TEXT,
  vehicle_class VARCHAR(32) NOT NULL,
  passenger_capacity INT NOT NULL,
  luggage_capacity INT NOT NULL,
  base_fare NUMERIC(10, 2) NOT NULL,
  minimum_fare NUMERIC(10, 2) NOT NULL,
  per_km_rate NUMERIC(10, 2) NOT NULL,
  per_minute_rate NUMERIC(10, 2) NOT NULL,
  waiting_rate NUMERIC(10, 2) NOT NULL,
  booking_fee NUMERIC(10, 2) NOT NULL,
  platform_fee NUMERIC(10, 2) NOT NULL,
  commission_percent NUMERIC(5, 2) NOT NULL,
  cancellation_fee NUMERIC(10, 2) NOT NULL,
  tax_percent NUMERIC(5, 2) NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  icon_url TEXT
);
