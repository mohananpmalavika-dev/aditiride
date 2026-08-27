import { v4 as uuidv4 } from 'uuid';
import { get, query, run, transaction } from '../db/index.js';
import { Payment, PaymentMethod, PaymentStatus, Wallet, WalletTransaction, DriverEarning, Booking, VehicleCategory } from '../types/index.js';
import { LedgerService } from './LedgerService.js';

export class PaymentService {
  /**
   * Process idempotent payment for a completed booking.
   * Amount is strictly derived from authoritative server-side booking final_fare / fare_estimate.
   * Entire operation is enclosed in an atomic database transaction.
   */
  public static processPayment(
    bookingId: string,
    userId: string,
    paymentMethod: PaymentMethod,
    idempotencyKey: string
  ): { payment: Payment; walletBalance?: number } {
    return transaction(() => {
      // 1. Idempotency Check
      const existing = get<Payment>('SELECT * FROM payments WHERE idempotency_key = ?', [idempotencyKey]);
      if (existing) {
        return { payment: existing };
      }

      // 2. Authoritative Booking State & Fare Lookup
      const booking = get<Booking>('SELECT * FROM bookings WHERE id = ?', [bookingId]);
      if (!booking) {
        throw new Error(`Booking ${bookingId} not found`);
      }

      // Enforce that user is the booking passenger or admin
      if (booking.passenger_id !== userId) {
        const user = get<{ role: string }>('SELECT role FROM users WHERE id = ?', [userId]);
        if (user?.role !== 'SUPER_ADMIN' && user?.role !== 'ADMIN') {
          throw new Error('Access forbidden: You are not authorized to pay for this booking.');
        }
      }

      // Authoritatively derive payable amount from server truth
      const authoritativeAmount = booking.final_fare || booking.fare_estimate;
      if (!authoritativeAmount || authoritativeAmount <= 0) {
        throw new Error(`Invalid authoritative booking fare: ₹${authoritativeAmount}`);
      }

      const category = get<VehicleCategory>('SELECT * FROM vehicle_categories WHERE id = ?', [booking.vehicle_category_id]);
      const commissionPercent = category?.commission_percent || 12.0;
      const taxPercent = category?.tax_percent || 5.0;

      const taxAmount = Math.round((authoritativeAmount * (taxPercent / 100)) * 100) / 100;
      const platformCommission = Math.round(((authoritativeAmount - taxAmount) * (commissionPercent / 100) + (category?.booking_fee || 5)) * 100) / 100;
      const netDriverEarning = Math.max(0, Math.round((authoritativeAmount - platformCommission - taxAmount) * 100) / 100);

      let passengerWalletBalance = 0;
      const amountPaise = LedgerService.rupeesToPaise(authoritativeAmount);

      // 3. Handle Wallet Double-Entry Accounting
      if (paymentMethod === 'WALLET') {
        const userAccountId = LedgerService.getOrCreateAccount(userId, 'USER_WALLET');
        const clearingAccountId = LedgerService.getPlatformClearingAccount();
        const revenueAccountId = LedgerService.getPlatformRevenueAccount();

        const wallet = get<Wallet>('SELECT * FROM wallets WHERE user_id = ?', [userId]);
        if (!wallet || wallet.balance < authoritativeAmount) {
          throw new Error(`Insufficient wallet balance. Available: ₹${wallet?.balance || 0}, Required: ₹${authoritativeAmount}`);
        }

        // Record double-entry transaction: User Wallet -> Platform Clearing
        LedgerService.recordDoubleEntryTransaction(
          'RIDE_PAYMENT',
          bookingId,
          userAccountId,
          clearingAccountId,
          amountPaise,
          `Ride payment debit for ${booking.booking_number}`
        );

        // Record platform commission: Clearing -> Revenue
        if (platformCommission > 0) {
          const commPaise = LedgerService.rupeesToPaise(platformCommission);
          LedgerService.recordDoubleEntryTransaction(
            'RIDE_PAYMENT',
            bookingId,
            clearingAccountId,
            revenueAccountId,
            commPaise,
            `Platform commission for ${booking.booking_number}`
          );
        }

        passengerWalletBalance = wallet.balance - authoritativeAmount;
        run(`UPDATE wallets SET balance = balance - ?, updated_at = datetime('now') WHERE user_id = ?`, [authoritativeAmount, userId]);

        // Record transaction ledger log
        run(`
          INSERT INTO wallet_transactions (id, wallet_id, amount, type, reference_type, reference_id, description)
          VALUES (?, ?, ?, 'DEBIT', 'RIDE_PAYMENT', ?, ?)
        `, [uuidv4(), wallet.id, authoritativeAmount, bookingId, `Ride payment for ${booking.booking_number}`]);
      }

      // 4. Create Payment Intent & Authoritative Payment Record
      const paymentId = `pay_${uuidv4().substring(0, 8)}`;
      const gatewayTxId = `gw_${paymentMethod.toLowerCase()}_${Date.now()}`;
      
      run(`
        INSERT INTO payment_intents (id, booking_id, user_id, amount_paise, currency, provider, provider_order_id, status, idempotency_key)
        VALUES (?, ?, ?, ?, 'INR', ?, ?, 'CAPTURED', ?)
      `, [`pi_${uuidv4().substring(0, 8)}`, bookingId, userId, amountPaise, paymentMethod, gatewayTxId, idempotencyKey]);

      run(`
        INSERT INTO payments (id, booking_id, user_id, amount, currency, payment_method, gateway_transaction_id, idempotency_key, status)
        VALUES (?, ?, ?, ?, 'INR', ?, ?, ?, 'COMPLETED')
      `, [paymentId, bookingId, userId, authoritativeAmount, paymentMethod, gatewayTxId, idempotencyKey]);

      // 5. Record Driver Earning & Settlement
      if (booking.driver_id) {
        const earningId = `earn_${uuidv4().substring(0, 8)}`;
        const cashCollected = paymentMethod === 'CASH' ? authoritativeAmount : 0.0;
        run(`
          INSERT INTO driver_earnings (id, driver_id, booking_id, gross_fare, platform_commission, tax_deducted, net_earning, cash_collected, settlement_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SETTLED')
        `, [earningId, booking.driver_id, bookingId, authoritativeAmount, platformCommission, taxAmount, netDriverEarning, cashCollected]);
      }

      // 6. Update booking payment status
      run(`UPDATE bookings SET payment_method = ?, payment_status = 'COMPLETED' WHERE id = ?`, [paymentMethod, bookingId]);

      const createdPayment = get<Payment>('SELECT * FROM payments WHERE id = ?', [paymentId]);
      return {
        payment: createdPayment!,
        walletBalance: passengerWalletBalance
      };
    });
  }

  /**
   * Add money to user wallet with double-entry accounting in an atomic transaction
   */
  public static topUpWallet(userId: string, amount: number): { wallet: Wallet; transaction: WalletTransaction } {
    if (amount <= 0) throw new Error('Top-up amount must be greater than zero');

    return transaction(() => {
      let wallet = get<Wallet>('SELECT * FROM wallets WHERE user_id = ?', [userId]);
      if (!wallet) {
        const walletId = `wal_${uuidv4().substring(0, 8)}`;
        run(`INSERT INTO wallets (id, user_id, balance, currency) VALUES (?, ?, ?, 'INR')`, [walletId, userId, amount]);
        wallet = get<Wallet>('SELECT * FROM wallets WHERE id = ?', [walletId])!;
      } else {
        run(`UPDATE wallets SET balance = balance + ?, updated_at = datetime('now') WHERE id = ?`, [amount, wallet.id]);
        wallet = get<Wallet>('SELECT * FROM wallets WHERE id = ?', [wallet.id])!;
      }

      // Double-entry record: Clearing -> User Wallet
      const userAccountId = LedgerService.getOrCreateAccount(userId, 'USER_WALLET');
      const clearingAccountId = LedgerService.getPlatformClearingAccount();
      const amountPaise = LedgerService.rupeesToPaise(amount);

      LedgerService.recordDoubleEntryTransaction(
        'WALLET_TOPUP',
        null,
        clearingAccountId,
        userAccountId,
        amountPaise,
        `Wallet top-up via UPI gateway`
      );

      const txId = `tx_${uuidv4().substring(0, 8)}`;
      run(`
        INSERT INTO wallet_transactions (id, wallet_id, amount, type, reference_type, reference_id, description)
        VALUES (?, ?, ?, 'CREDIT', 'TOPUP', ?, 'Added money via UPI/Netbanking')
      `, [txId, wallet.id, amount, `topup_${Date.now()}`]);

      const tx = get<WalletTransaction>('SELECT * FROM wallet_transactions WHERE id = ?', [txId]);
      return { wallet, transaction: tx! };
    });
  }

  /**
   * Fetch wallet and transaction history
   */
  public static getWallet(userId: string): { wallet: Wallet; transactions: WalletTransaction[] } {
    let wallet = get<Wallet>('SELECT * FROM wallets WHERE user_id = ?', [userId]);
    if (!wallet) {
      const walletId = `wal_${uuidv4().substring(0, 8)}`;
      run(`INSERT INTO wallets (id, user_id, balance, currency) VALUES (?, ?, 500.0, 'INR')`, [walletId, userId]);
      wallet = get<Wallet>('SELECT * FROM wallets WHERE id = ?', [walletId])!;
    }

    const transactions = query<WalletTransaction>(
      'SELECT * FROM wallet_transactions WHERE wallet_id = ? ORDER BY created_at DESC LIMIT 30',
      [wallet.id]
    );

    return { wallet, transactions };
  }
}
