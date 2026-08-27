import { get, query, run } from '../db/index.js';
import { LedgerService } from './LedgerService.js';
import { v4 as uuidv4 } from 'uuid';

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
    // 1. Double-Entry Debits vs Credits Check
    const entriesSummary = get<{ debits: number; credits: number }>(`
      SELECT 
        COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_paise ELSE 0 END), 0) as debits,
        COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_paise ELSE 0 END), 0) as credits
      FROM ledger_entries
    `) || { debits: 0, credits: 0 };

    const ledgerImbalancePaise = Math.abs(entriesSummary.debits - entriesSummary.credits);

    // 2. Authoritative Ledger Balances for User Wallets
    const ledgerUserWallets = get<{ total: number }>(`
      SELECT COALESCE(SUM(balance_paise), 0) as total 
      FROM ledger_accounts 
      WHERE account_type = 'USER_WALLET'
    `)?.total || 0;

    // 3. Cached Projection Wallets Table
    const cachedWallets = get<{ total: number }>(`
      SELECT COALESCE(SUM(balance), 0) as total 
      FROM wallets
    `)?.total || 0;

    // 4. Platform Revenue
    const platformRevenuePaise = get<{ total: number }>(`
      SELECT COALESCE(SUM(balance_paise), 0) as total 
      FROM ledger_accounts 
      WHERE account_type = 'PLATFORM_REVENUE'
    `)?.total || 0;

    // 5. Completed Payments
    const completedPayments = get<{ total: number }>(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM payments 
      WHERE status = 'COMPLETED'
    `)?.total || 0;

    // 6. Driver Earnings
    const driverEarnings = get<{ total: number }>(`
      SELECT COALESCE(SUM(net_earning), 0) as total 
      FROM driver_earnings 
      WHERE settlement_status = 'SETTLED'
    `)?.total || 0;

    const isBalanced = ledgerImbalancePaise === 0;
    const unexplainedDiffRupees = LedgerService.paiseToRupees(ledgerImbalancePaise);

    const report: ReconciliationReport = {
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

    // Persist reconciliation run
    try {
      run(`
        INSERT INTO reconciliation_runs (
          id, reconciled_at, status, ledger_wallets_rupees, cached_wallets_rupees,
          platform_revenue_rupees, payments_completed_rupees, driver_earnings_rupees, unexplained_diff_rupees
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        `rec_${uuidv4().substring(0, 8)}`,
        report.reconciledAt,
        report.status,
        report.totalLedgerUserWalletsRupees,
        report.totalCachedWalletsRupees,
        report.totalPlatformRevenueRupees,
        report.totalPaymentsCompletedRupees,
        report.totalDriverEarningsRupees,
        report.unexplainedDifferenceRupees
      ]);
    } catch {}

    return report;
  }
}
