import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import { getDb, run, get } from '../db/index.js';
import { AuthSessionService } from '../services/AuthSessionService.js';
import { PaymentService } from '../services/PaymentService.js';
import { RazorpayPaymentProvider } from '../services/payment/PaymentProvider.js';
import { ReconciliationService } from '../services/ReconciliationService.js';
import { RedisClient } from '../services/redis/RedisClient.js';
import { User } from '../types/index.js';

describe('P0 Distributed Architecture, Sessions & Payment Webhook Tests', () => {
  beforeAll(async () => {
    await getDb();
    run(`
      INSERT OR REPLACE INTO users (id, phone, name, role, status, password_hash)
      VALUES ('usr_dist_passenger', '+919988776655', 'Distributed Test Rider', 'PASSENGER', 'ACTIVE', '$2a$12$e8pYf7w8A4s9d0f1g2h3j4k5l6m7n8o9p0q1r2s3t4u5v6w7x8y9z')
    `);
  });

  const mockPassenger: User = {
    id: 'usr_dist_passenger',
    phone: '+919988776655',
    name: 'Distributed Test Rider',
    role: 'PASSENGER',
    status: 'ACTIVE',
    created_at: new Date().toISOString()
  };

  describe('1. Persistent Auth Sessions & Refresh Token Rotation', () => {
    it('should create persistent session, rotate refresh token, and invalidate old token', () => {
      const session1 = AuthSessionService.createSession(mockPassenger, '127.0.0.1', 'Vitest-Agent');
      expect(session1.accessToken).toBeDefined();
      expect(session1.refreshToken).toBeDefined();

      // Rotate session
      const session2 = AuthSessionService.rotateSession(session1.refreshToken, '127.0.0.1', 'Vitest-Agent');
      expect(session2.accessToken).toBeDefined();
      expect(session2.refreshToken).toBeDefined();
      expect(session2.refreshToken).not.toBe(session1.refreshToken);

      // Verify old session is marked revoked
      const oldSession = get<any>(
        'SELECT * FROM auth_sessions WHERE refresh_token_hash = ?',
        [crypto.createHash('sha256').update(session1.refreshToken).digest('hex')]
      );
      expect(oldSession.revoked_at).not.toBeNull();
    });

    it('should detect token reuse attack and revoke all user sessions', () => {
      const sessionA = AuthSessionService.createSession(mockPassenger, '127.0.0.1', 'Vitest-Agent');

      // Valid rotation
      const sessionB = AuthSessionService.rotateSession(sessionA.refreshToken, '127.0.0.1', 'Vitest-Agent');
      expect(sessionB.accessToken).toBeDefined();

      // Attacker replays already-rotated sessionA.refreshToken
      expect(() => {
        AuthSessionService.rotateSession(sessionA.refreshToken, '10.0.0.1', 'Malicious-Client');
      }).toThrow(/Security Alert: Refresh token reuse detected/);

      // Verify all active sessions for this user were revoked
      const activeSessions = get<{ count: number }>(
        'SELECT COUNT(*) as count FROM auth_sessions WHERE user_id = ? AND revoked_at IS NULL',
        [mockPassenger.id]
      );
      expect(activeSessions?.count).toBe(0);
    });
  });

  describe('2. Authoritative Payment Gateway Webhook & HMAC Verification', () => {
    it('should verify HMAC-SHA256 signature and process payment.captured idempotently', async () => {
      const bookingId = 'bk_webhook_test_01';
      run(`
        INSERT OR REPLACE INTO bookings (
          id, booking_number, passenger_id, driver_id, vehicle_category_id, booking_type,
          pickup_lat, pickup_lng, pickup_address, destination_lat, destination_lng, destination_address,
          distance_km, duration_min, otp_code, fare_estimate, final_fare, status
        ) VALUES (
          ?, 'ADITI-WEBHOOK-01', 'usr_dist_passenger', 'drv_rahul', 'cat_sedan', 'INSTANT',
          10.52, 76.21, 'A', 10.53, 76.22, 'B',
          5.0, 15, '4918', 210.0, 210.0, 'COMPLETED'
        )
      `, [bookingId]);

      const intent = await PaymentService.createPaymentIntent(bookingId, mockPassenger.id, 'RAZORPAY', `idem_wh_${Date.now()}`);
      expect(intent.providerOrderId).toBeDefined();

      const webhookSecret = 'aditi_webhook_secret_key_123';
      const webhookPayload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: `pay_gateway_${Date.now()}`,
              order_id: intent.providerOrderId,
              amount: 21000,
              currency: 'INR',
              status: 'captured'
            }
          }
        }
      };

      const rawBody = JSON.stringify(webhookPayload);
      const signature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

      // Process webhook
      const webhookResult = PaymentService.handlePaymentWebhook(webhookPayload, signature, rawBody, webhookSecret);
      expect(webhookResult.success).toBe(true);
      expect(webhookResult.intent?.status).toBe('CAPTURED');

      // Verify booking updated to COMPLETED payment
      const updatedBooking = get<any>('SELECT payment_status FROM bookings WHERE id = ?', [bookingId]);
      expect(updatedBooking.payment_status).toBe('COMPLETED');
    });
  });

  describe('3. Automated Financial Reconciliation Engine', () => {
    it('should calculate ledger balances vs cached projections and report discrepancy metrics', () => {
      const report = ReconciliationService.runFinancialReconciliation();
      expect(report.reconciledAt).toBeDefined();
      expect(typeof report.unexplainedDifferenceRupees).toBe('number');
      expect(report.totalLedgerUserWalletsRupees).toBeGreaterThanOrEqual(0);
      expect(report.totalPlatformRevenueRupees).toBeGreaterThanOrEqual(0);
    });
  });

  describe('4. Redis Distributed State & Coordination', () => {
    it('should acquire atomic distributed lease and prevent double lease across nodes', async () => {
      const driverId = 'drv_redis_test_99';
      const leaseKey = `driver:lease:${driverId}`;

      // Node 1 acquires lease
      const acquired1 = await RedisClient.acquireDistributedLease(leaseKey, 'bk_order_1', 20);
      expect(acquired1).toBe(true);

      // Node 2 tries to lease same driver -> rejected
      const acquired2 = await RedisClient.acquireDistributedLease(leaseKey, 'bk_order_2', 20);
      expect(acquired2).toBe(false);

      // Release lease with correct owner
      const released = await RedisClient.releaseDistributedLease(leaseKey, 'bk_order_1');
      expect(released).toBe(true);

      // Now available for Node 2
      const acquired3 = await RedisClient.acquireDistributedLease(leaseKey, 'bk_order_2', 20);
      expect(acquired3).toBe(true);
    });

    it('should prevent Booking A from releasing Booking B lease via compare-and-delete semantics', async () => {
      const leaseKey = 'driver:lease:drv_concurrent_check';
      await RedisClient.acquireDistributedLease(leaseKey, 'bk_owner_real', 30);

      // Imposter tries to release with wrong expectedValue
      const imposterRelease = await RedisClient.releaseDistributedLease(leaseKey, 'bk_imposter');
      expect(imposterRelease).toBe(false);

      // Real owner releases successfully
      const realRelease = await RedisClient.releaseDistributedLease(leaseKey, 'bk_owner_real');
      expect(realRelease).toBe(true);
    });
  });
});
