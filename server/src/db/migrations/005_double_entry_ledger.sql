-- Migration 005: Double-Entry Ledger System (Paise Precision)
CREATE TABLE IF NOT EXISTS ledger_accounts (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id),
  account_type VARCHAR(32) NOT NULL, -- 'USER_WALLET', 'PLATFORM_REVENUE', 'PLATFORM_CLEARING', 'DRIVER_PAYABLE'
  currency VARCHAR(8) DEFAULT 'INR',
  balance_paise BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ledger_transactions (
  id VARCHAR(64) PRIMARY KEY,
  booking_id VARCHAR(64) REFERENCES bookings(id),
  transaction_type VARCHAR(32) NOT NULL, -- 'RIDE_PAYMENT', 'WALLET_TOPUP', 'DRIVER_PAYOUT', 'REFUND', 'CANCELLATION_FEE'
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

CREATE TABLE IF NOT EXISTS wallets (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) UNIQUE NOT NULL REFERENCES users(id),
  balance NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(8) DEFAULT 'INR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id VARCHAR(64) PRIMARY KEY,
  wallet_id VARCHAR(64) NOT NULL REFERENCES wallets(id),
  amount NUMERIC(10, 2) NOT NULL,
  type VARCHAR(16) NOT NULL, -- 'CREDIT', 'DEBIT'
  reference_type VARCHAR(32) NOT NULL,
  reference_id VARCHAR(128),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS driver_earnings (
  id VARCHAR(64) PRIMARY KEY,
  driver_id VARCHAR(64) NOT NULL REFERENCES driver_profiles(id),
  booking_id VARCHAR(64) NOT NULL REFERENCES bookings(id),
  gross_fare NUMERIC(10, 2) NOT NULL,
  platform_commission NUMERIC(10, 2) NOT NULL,
  tax_deducted NUMERIC(10, 2) NOT NULL,
  net_earning NUMERIC(10, 2) NOT NULL,
  cash_collected NUMERIC(10, 2) DEFAULT 0.00,
  settlement_status VARCHAR(32) DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id VARCHAR(64) PRIMARY KEY,
  reconciled_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(32) NOT NULL,
  ledger_wallets_rupees NUMERIC(12, 2) NOT NULL,
  cached_wallets_rupees NUMERIC(12, 2) NOT NULL,
  platform_revenue_rupees NUMERIC(12, 2) NOT NULL,
  payments_completed_rupees NUMERIC(12, 2) NOT NULL,
  driver_earnings_rupees NUMERIC(12, 2) NOT NULL,
  unexplained_diff_rupees NUMERIC(12, 2) NOT NULL,
  discrepancies_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
