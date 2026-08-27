import { get, query } from '../db/index.js';
import { LedgerService } from './LedgerService.js';

export interface ReconciliationReport {
  reconciledAt: string;
  status: 'BALANCED' | 'DISCREPANCY_DETECTED';
  totalLedgerUserWalletsRupees: number;
  totalCachedWalletsRupees: number;
  totalPlatformRevenueRupees: number;
  totalPaymentsCompletedRupees: number;
  totalDriverEarningsRupees: number;
  unexplainedDifferenceRupees: number;
  healthy: boolean;
}

export class ReconciliationService {
  /**
   * Run automated end-of-day / real-time financial reconciliation.
   * Compares authoritative double-entry ledger postings against cached wallet projections and payment provider sums.
   */
  public static runFinancialReconciliation(): ReconciliationReport {
    // 1. Authoritative Ledger Balances for User Wallets
    const ledgerUserWallets = get<{ total: number }>(`
      SELECT COALESCE(SUM(balance_paise), 0) as total 
      FROM ledger_accounts 
      WHERE account_type = 'USER_WALLET'
    `)?.total || 0;

    // 2. Cached Projection Wallets Table
    const cachedWallets = get<{ total: number }>(`
      SELECT COALESCE(SUM(balance), 0) as total 
      FROM wallets
    `)?.total || 0;
    const cachedWalletsPaise = Math.round(cachedWallets * 100);

    // 3. Platform Revenue
    const platformRevenuePaise = get<{ total: number }>(`
      SELECT COALESCE(SUM(balance_paise), 0) as total 
      FROM ledger_accounts 
      WHERE account_type = 'PLATFORM_REVENUE'
    `)?.total || 0;

    // 4. Completed Payments
    const completedPayments = get<{ total: number }>(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM payments 
      WHERE status = 'COMPLETED'
    `)?.total || 0;

    // 5. Driver Earnings
    const driverEarnings = get<{ total: number }>(`
      SELECT COALESCE(SUM(net_earning), 0) as total 
      FROM driver_earnings 
      WHERE settlement_status = 'SETTLED'
    `)?.total || 0;

    // Discrepancy calculation between authoritative ledger and wallet cache
    const diffPaise = Math.abs(ledgerUserWallets - cachedWalletsPaise);
    const unexplainedDiffRupees = LedgerService.paiseToRupees(diffPaise);
    const isBalanced = diffPaise === 0;

    return {
      reconciledAt: new Date().toISOString(),
      status: isBalanced ? 'BALANCED' : 'DISCREPANCY_DETECTED',
      totalLedgerUserWalletsRupees: LedgerService.paiseToRupees(ledgerUserWallets),
      totalCachedWalletsRupees: cachedWallets,
      totalPlatformRevenueRupees: LedgerService.paiseToRupees(platformRevenuePaise),
      totalPaymentsCompletedRupees: Math.round(completedPayments * 100) / 100,
      totalDriverEarningsRupees: Math.round(driverEarnings * 100) / 100,
      unexplainedDifferenceRupees: unexplainedDiffRupees,
      healthy: isBalanced
    };
  }
}
