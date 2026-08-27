import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb, run, get, query, transaction } from '../db/index.js';
import { RedisClient } from '../services/redis/RedisClient.js';
import { DispatchEngine } from '../services/DispatchEngine.js';
import { PaymentService } from '../services/PaymentService.js';
import { LedgerService } from '../services/LedgerService.js';
import { ReconciliationService } from '../services/ReconciliationService.js';
import { SchedulerWorker } from '../services/SchedulerWorker.js';
import { PostgresSpatialHelper } from '../db/postgres.js';
import { DriverRepository } from '../repositories/DriverRepository.js';

describe('P0 Production Cutover & Distributed Concurrency Test Suite', () => {
  const mockPassengerId = 'usr_pass_conc_101';
  const mockDriverId = 'drv_conc_202';
  const mockDriverUserId = 'usr_drv_conc_202';

  beforeAll(async () => {
    await getDb();

    // Seed test passenger
    run(`
      INSERT OR IGNORE INTO users (id, phone, name, role, password_hash, status)
      VALUES (?, '+919900112233', 'Concurrency Passenger', 'PASSENGER', 'hashed_pw', 'ACTIVE')
    `, [mockPassengerId]);

    // Seed test driver user
    run(`
      INSERT OR IGNORE INTO users (id, phone, name, role, password_hash, status)
      VALUES (?, '+919900112244', 'Concurrency Driver User', 'DRIVER', 'hashed_pw', 'ACTIVE')
    `, [mockDriverUserId]);

    // Seed verified driver profile
    run(`
      INSERT OR IGNORE INTO driver_profiles (
        id, user_id, availability_status, verification_status, rating_avg, current_lat, current_lng
      ) VALUES (?, ?, 'ONLINE', 'VERIFIED', 4.95, 10.5276, 76.2144)
    `, [mockDriverId, mockDriverUserId]);

    // Seed vehicle
    run(`
      INSERT OR IGNORE INTO vehicles (
        id, driver_id, vehicle_category_id, brand, model, color, plate_number, status
      ) VALUES ('veh_conc_1', ?, 'cat_sedan', 'Toyota', 'Etios', 'White', 'KL-08-CC-9999', 'ACTIVE')
    `, [mockDriverId]);
  });

  describe('1. Distributed Redis Driver Lease & Concurrency Control', () => {
    it('should grant lease to exactly one node and reject concurrent competitor', async () => {
      const leaseKey = `driver:lease:${mockDriverId}`;

      // Node A acquires lease
      const nodeAAcquired = await RedisClient.acquireDistributedLease(leaseKey, 'bk_order_node_a', 20);
      expect(nodeAAcquired).toBe(true);

      // Node B attempts to acquire same driver lease -> MUST FAIL
      const nodeBAcquired = await RedisClient.acquireDistributedLease(leaseKey, 'bk_order_node_b', 20);
      expect(nodeBAcquired).toBe(false);

      // Node B cannot release Node A's lease (CAS protection)
      const fakeRelease = await RedisClient.releaseDistributedLease(leaseKey, 'bk_order_node_b');
      expect(fakeRelease).toBe(false);

      // Node A releases lease
      const legitimateRelease = await RedisClient.releaseDistributedLease(leaseKey, 'bk_order_node_a');
      expect(legitimateRelease).toBe(true);

      // Node B can now acquire lease
      const nodeBRetry = await RedisClient.acquireDistributedLease(leaseKey, 'bk_order_node_b', 20);
      expect(nodeBRetry).toBe(true);

      // Cleanup
      await RedisClient.releaseDistributedLease(leaseKey, 'bk_order_node_b');
    });
  });

  describe('2. Webhook Idempotency & Replay Attack Defense', () => {
    it('should process 10 duplicate webhook calls with exactly 1 ledger settlement', async () => {
      const bookingId = `bk_conc_wh_${Date.now()}`;
      const bookingNumber = `ADITI-WH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const amount = 350.0;
      const amountPaise = 35000;

      run(`
        INSERT INTO bookings (
          id, booking_number, passenger_id, driver_id, vehicle_category_id,
          pickup_lat, pickup_lng, pickup_address, destination_lat, destination_lng, destination_address,
          distance_km, duration_min, otp_code, fare_estimate, final_fare, status, payment_status
        ) VALUES (
          ?, ?, ?, ?, 'cat_sedan',
          10.52, 76.21, 'P', 10.55, 76.25, 'D',
          8.0, 20, '1234', 350.0, 350.0, 'COMPLETED', 'PENDING'
        )
      `, [bookingId, bookingNumber, mockPassengerId, mockDriverId]);

      const intent = await PaymentService.createPaymentIntent(
        bookingId,
        mockPassengerId,
        'RAZORPAY',
        `idem_replay_${bookingId}`
      );

      const webhookSecret = 'conc_webhook_secret_key_2026';
      const webhookPayload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: `pay_conc_${Date.now()}`,
              order_id: intent.providerOrderId,
              amount: amountPaise,
              currency: 'INR',
              status: 'captured'
            }
          }
        }
      };

      const rawBody = JSON.stringify(webhookPayload);
      const signature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

      // Send 10 concurrent / duplicate webhook invocations
      const results = await Promise.all(
        Array.from({ length: 10 }).map(() =>
          Promise.resolve(PaymentService.handlePaymentWebhook(webhookPayload, signature, rawBody, webhookSecret))
        )
      );

      // At least 1 was the primary capturer, all indicate success/idempotency
      const successful = results.filter((r) => r.success);
      expect(successful.length).toBe(10);

      // Verify booking payment status is COMPLETED
      const booking = get<any>('SELECT payment_status FROM bookings WHERE id = ?', [bookingId]);
      expect(booking.payment_status).toBe('COMPLETED');

      // Verify exactly ONE ledger transaction was created for this booking
      const txCount = get<{ count: number }>(
        `SELECT COUNT(*) as count FROM ledger_transactions WHERE booking_id = ?`,
        [bookingId]
      );
      expect(txCount?.count).toBe(1);
    });
  });

  describe('3. Distributed Scheduler Leader Lock', () => {
    it('should permit only one worker replica to execute the scheduled ride tick', async () => {
      const lockName = 'scheduled-dispatch-concurrency-test';

      // Worker 1 acquires lock
      const worker1Lock = await RedisClient.acquireWorkerLock(lockName, 15);
      expect(worker1Lock).toBe(true);

      // Worker 2 attempts same lock during active TTL -> Rejected
      const worker2Lock = await RedisClient.acquireWorkerLock(lockName, 15);
      expect(worker2Lock).toBe(false);

      // Release lock
      await RedisClient.releaseDistributedLease(`lock:worker:${lockName}`);
    });
  });

  describe('4. PostGIS Spatial Query Structure & Parameterization', () => {
    it('should generate parameterized ST_DWithin query with GiST geography types', () => {
      const lat = 10.5276;
      const lng = 76.2144;
      const radiusMeters = 8000;
      const categoryId = 'cat_sedan';

      const spatial = PostgresSpatialHelper.buildNearbyDriversQuery(lat, lng, radiusMeters, categoryId);

      expect(spatial.sql).toContain('ST_DWithin');
      expect(spatial.sql).toContain('ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography');
      expect(spatial.values).toEqual([lng, lat, categoryId, radiusMeters]);
    });
  });

  describe('5. Automated Financial Reconciliation Verification', () => {
    it('should confirm ₹0 unexplained discrepancy across all ledger accounts', () => {
      const report = ReconciliationService.runFinancialReconciliation();
      expect(report.healthy).toBe(true);
      expect(report.unexplainedDifferenceRupees).toBe(0);
    });
  });
});
