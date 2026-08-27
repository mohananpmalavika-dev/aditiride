import { v4 as uuidv4 } from 'uuid';
import { get, query, run } from '../db/index.js';

export class LedgerService {
  /**
   * Convert Rupees (e.g. 180.50) to Paise Integer (18050)
   */
  public static rupeesToPaise(rupees: number): number {
    return Math.round(rupees * 100);
  }

  /**
   * Convert Paise Integer (18050) to Rupees (180.50)
   */
  public static paiseToRupees(paise: number): number {
    return paise / 100.0;
  }

  /**
   * Ensure user has a ledger account initialized
   */
  public static getOrCreateAccount(userId: string, accountType: 'USER_WALLET' | 'DRIVER_PAYABLE' | 'PLATFORM_REVENUE' | 'PLATFORM_CLEARING' = 'USER_WALLET'): string {
    const existing = get<{ id: string }>(
      'SELECT id FROM ledger_accounts WHERE user_id = ? AND account_type = ?',
      [userId, accountType]
    );

    if (existing) return existing.id;

    const accountId = `acc_${uuidv4().substring(0, 8)}`;
    run(
      `INSERT INTO ledger_accounts (id, user_id, account_type, currency, balance_paise)
       VALUES (?, ?, ?, 'INR', 0)`,
      [accountId, userId, accountType]
    );

    return accountId;
  }

  /**
   * Get platform clearing account ID
   */
  public static getPlatformClearingAccount(): string {
    return this.getOrCreateAccount('SYSTEM_PLATFORM_CLEARING', 'PLATFORM_CLEARING');
  }

  /**
   * Get platform revenue account ID
   */
  public static getPlatformRevenueAccount(): string {
    return this.getOrCreateAccount('SYSTEM_PLATFORM_REVENUE', 'PLATFORM_REVENUE');
  }

  /**
   * Execute an atomic double-entry transaction in Paise precision
   */
  public static recordDoubleEntryTransaction(
    transactionType: 'RIDE_PAYMENT' | 'WALLET_TOPUP' | 'DRIVER_PAYOUT' | 'REFUND' | 'CANCELLATION_FEE',
    bookingId: string | null,
    debitAccountId: string,
    creditAccountId: string,
    amountPaise: number,
    description: string
  ): { transactionId: string } {
    if (amountPaise <= 0) {
      throw new Error(`Transaction amount must be positive. Received: ${amountPaise} paise.`);
    }

    const transactionId = `tx_${uuidv4().substring(0, 8)}`;

    // 1. Insert Transaction Header
    run(
      `INSERT INTO ledger_transactions (id, booking_id, transaction_type, description)
       VALUES (?, ?, ?, ?)`,
      [transactionId, bookingId, transactionType, description]
    );

    // 2. Insert Debit Entry
    const debitEntryId = `entry_${uuidv4().substring(0, 8)}`;
    run(
      `INSERT INTO ledger_entries (id, transaction_id, account_id, entry_type, amount_paise)
       VALUES (?, ?, ?, 'DEBIT', ?)`,
      [debitEntryId, transactionId, debitAccountId, amountPaise]
    );

    // 3. Insert Credit Entry
    const creditEntryId = `entry_${uuidv4().substring(0, 8)}`;
    run(
      `INSERT INTO ledger_entries (id, transaction_id, account_id, entry_type, amount_paise)
       VALUES (?, ?, ?, 'CREDIT', ?)`,
      [creditEntryId, transactionId, creditAccountId, amountPaise]
    );

    // 4. Atomically recalculate balances
    run(
      `UPDATE ledger_accounts SET balance_paise = balance_paise - ? WHERE id = ?`,
      [amountPaise, debitAccountId]
    );
    run(
      `UPDATE ledger_accounts SET balance_paise = balance_paise + ? WHERE id = ?`,
      [amountPaise, creditAccountId]
    );

    return { transactionId };
  }

  /**
   * Get user wallet balance derived from double-entry ledger
   */
  public static getWalletBalanceRupees(userId: string): number {
    const account = get<{ balance_paise: number }>(
      `SELECT balance_paise FROM ledger_accounts WHERE user_id = ? AND account_type = 'USER_WALLET'`,
      [userId]
    );
    return account ? this.paiseToRupees(account.balance_paise) : 0.0;
  }
}
