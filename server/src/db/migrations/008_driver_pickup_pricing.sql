-- Migration 008: Driver Configurable Free Pickup Distance & Pickup Surcharges
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS free_pickup_km NUMERIC(4, 2) DEFAULT 2.0;
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS pickup_charge_per_km NUMERIC(10, 2) DEFAULT 10.0;

ALTER TABLE driver_pricing ADD COLUMN IF NOT EXISTS free_pickup_km NUMERIC(4, 2) DEFAULT 2.0;
ALTER TABLE driver_pricing ADD COLUMN IF NOT EXISTS pickup_charge_per_km NUMERIC(10, 2) DEFAULT 10.0;
