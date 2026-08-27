-- Migration 006: Payment Intents & Real Gateway State Machine
CREATE TABLE IF NOT EXISTS payment_intents (
  id VARCHAR(64) PRIMARY KEY,
  booking_id VARCHAR(64) NOT NULL REFERENCES bookings(id),
  user_id VARCHAR(64) NOT NULL REFERENCES users(id),
  amount_paise BIGINT NOT NULL,
  currency VARCHAR(8) DEFAULT 'INR',
  provider VARCHAR(32) NOT NULL, -- 'RAZORPAY', 'CASHFREE', 'UPI_INTENT', 'WALLET', 'CASH'
  provider_order_id VARCHAR(128) UNIQUE,
  provider_payment_id VARCHAR(128),
  signature TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'CREATED', -- 'CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED'
  idempotency_key VARCHAR(128) UNIQUE NOT NULL,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_order ON payment_intents (provider_order_id, status);

CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(64) PRIMARY KEY,
  booking_id VARCHAR(64) NOT NULL REFERENCES bookings(id),
  user_id VARCHAR(64) NOT NULL REFERENCES users(id),
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(8) DEFAULT 'INR',
  payment_method VARCHAR(32) NOT NULL,
  gateway_transaction_id VARCHAR(128),
  idempotency_key VARCHAR(128) UNIQUE NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
