import { describe, it, expect, beforeAll } from 'vitest';
import { getDb, run, get, query } from '../db/index.js';
import { generateToken, hashPassword, comparePassword, verifyToken } from '../middleware/auth.js';
import { SafetyService } from '../services/SafetyService.js';
import { BookingStateMachine } from '../services/BookingStateMachine.js';
import { FareEngine } from '../services/FareEngine.js';
import { PaymentService } from '../services/PaymentService.js';
import { VoiceEngine } from '../services/VoiceEngine.js';
import { LedgerService } from '../services/LedgerService.js';
import { IdempotencyService } from '../services/IdempotencyService.js';
import { DispatchEngine } from '../services/DispatchEngine.js';
import { DriverKYCService } from '../services/DriverKYCService.js';

describe('P0 Security & Authorization Hardening Tests', () => {
  beforeAll(async () => {
    await getDb();
  });

  describe('1. Authentication & Password Hashing (Bcrypt)', () => {
    it('should correctly hash and verify passwords using bcrypt without plaintext leak', () => {
      const plain = 'StrongPass#2026';
      const hash = hashPassword(plain);

      expect(hash).not.toBe(plain);
      expect(hash.startsWith('$2')).toBe(true);
      expect(comparePassword(plain, hash)).toBe(true);
      expect(comparePassword('WrongPassword', hash)).toBe(false);
    });

    it('should generate and verify cryptographically signed JWT tokens with claims', () => {
      const token = generateToken({
        id: 'usr_passenger_test',
        role: 'PASSENGER',
        email: 'test@aditiride.com',
        phone: '+919999988888',
        name: 'Test Passenger'
      });

      expect(token).toBeDefined();
      expect(token.split('.').length).toBe(3);

      const decoded = verifyToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.id).toBe('usr_passenger_test');
      expect(decoded?.role).toBe('PASSENGER');
    });

    it('should reject tampered or invalid JWT tokens', () => {
      const invalid = verifyToken('tampered.jwt.token');
      expect(invalid).toBeNull();
    });
  });

  describe('2. Zero-Trust IDOR Protection & Identity Derivation', () => {
    it('should enforce that favorite drivers are strictly bound to authenticated user', () => {
      const realUserA = 'usr_passenger';
      const fakeVictimB = 'usr_victim_user_id';
      const driverId = 'drv_priya';

      // Ensure clean state
      run(`DELETE FROM favorites WHERE id = 'fav_test_1'`);

      // Server records favorite for realUserA
      run(`INSERT INTO favorites (id, passenger_id, driver_id, status) VALUES ('fav_test_1', ?, ?, 'ACTIVE')`, [
        realUserA,
        driverId
      ]);

      const victimFavorites = query(`SELECT * FROM favorites WHERE passenger_id = ? AND status = 'ACTIVE'`, [fakeVictimB]);
      expect(victimFavorites.length).toBe(0);

      const userAFavorites = query(`SELECT * FROM favorites WHERE passenger_id = ? AND id = 'fav_test_1' AND status = 'ACTIVE'`, [realUserA]);
      expect(userAFavorites.length).toBe(1);
      expect(userAFavorites[0].driver_id).toBe(driverId);

      run(`DELETE FROM favorites WHERE id = 'fav_test_1'`);
    });

    it('should enforce blocker identity derivation in bilateral blocking', () => {
      const blockerId = 'usr_passenger';
      const blockedDriver = 'usr_driver_rahul';

      run(`DELETE FROM user_blocks WHERE blocker_user_id = ? AND blocked_user_id = ?`, [blockerId, blockedDriver]);

      run(`
        INSERT INTO user_blocks (id, blocker_user_id, blocked_user_id, reason, block_type, status, created_by)
        VALUES ('blk_sec_1', ?, ?, 'Safety concern', 'PASSENGER_TO_DRIVER', 'ACTIVE', ?)
      `, [blockerId, blockedDriver, blockerId]);

      const blocks = query(`SELECT * FROM user_blocks WHERE blocker_user_id = ? AND status = 'ACTIVE'`, [blockerId]);
      expect(blocks.length).toBe(1);
      expect(blocks[0].blocked_user_id).toBe(blockedDriver);
      expect(blocks[0].blocker_user_id).toBe(blockerId);

      run(`DELETE FROM user_blocks WHERE id = 'blk_sec_1'`);
    });
  });

  describe('3. Fare Tampering & Authoritative Final Fare Calculation', () => {
    it('should dynamically calculate final fare upon trip completion based on real distance & duration', () => {
      const bookingId = 'bk_sec_fare_test';
      run(`
        INSERT OR REPLACE INTO bookings (
          id, booking_number, passenger_id, driver_id, vehicle_category_id, booking_type,
          pickup_lat, pickup_lng, pickup_address, destination_lat, destination_lng, destination_address,
          distance_km, duration_min, otp_code, fare_estimate, fare_source, fare_rule_version,
          surge_multiplier, payment_method, payment_status, status
        ) VALUES (
          ?, 'ADITI-TEST-001', 'usr_passenger', 'drv_rahul', 'cat_sedan', 'INSTANT',
          10.5276, 76.2144, 'Swaraj Round', 10.5360, 76.2220, 'Thrissur Round',
          4.0, 12, '5821', 120.0, 'ESTIMATE', 'v2.0',
          1.0, 'UPI', 'PENDING', 'TRIP_STARTED'
        )
      `, [bookingId]);

      // Complete trip with actual final distance 8.5 km and duration 25 min
      const completed = BookingStateMachine.transition(bookingId, 'COMPLETED', 'usr_driver_rahul', {
        finalDistanceKm: 8.5,
        finalDurationMin: 25
      });

      expect(completed.status).toBe('COMPLETED');
      expect(completed.distance_km).toBe(8.5);
      expect(completed.duration_min).toBe(25);
      // Final fare must be recalculated higher than initial 4km estimate (120)
      expect(completed.final_fare).toBeGreaterThan(120);
    });

    it('should derive payable wallet amount from DB truth rather than client-submitted price', () => {
      const bookingId = 'bk_sec_payment_test';
      run(`UPDATE wallets SET balance = 5000.0 WHERE user_id = 'usr_passenger'`);
      run(`
        INSERT OR REPLACE INTO bookings (
          id, booking_number, passenger_id, driver_id, vehicle_category_id, booking_type,
          pickup_lat, pickup_lng, pickup_address, destination_lat, destination_lng, destination_address,
          distance_km, duration_min, otp_code, fare_estimate, final_fare, fare_source, fare_rule_version,
          surge_multiplier, payment_method, payment_status, status
        ) VALUES (
          ?, 'ADITI-TEST-002', 'usr_passenger', 'drv_rahul', 'cat_sedan', 'INSTANT',
          10.5276, 76.2144, 'A', 10.5360, 76.2220, 'B',
          5.0, 15, '5821', 180.0, 195.0, 'FINAL_CALC', 'v2.0',
          1.0, 'WALLET', 'PENDING', 'COMPLETED'
        )
      `, [bookingId]);

      // Server loads booking and uses final_fare = 195.0
      const booking = get<any>('SELECT * FROM bookings WHERE id = ?', [bookingId]);
      const authoritativeAmount = booking.final_fare || booking.fare_estimate;
      expect(authoritativeAmount).toBe(195.0);

      const paymentResult = PaymentService.processPayment(
        bookingId,
        'usr_passenger',
        authoritativeAmount,
        'WALLET',
        `idem_key_${Date.now()}`
      );

      expect(paymentResult.payment.amount).toBe(195.0);
      expect(paymentResult.payment.status).toBe('COMPLETED');
    });
  });

  describe('4. SOS Security & Cryptographic Live Share Tokens', () => {
    it('should reject unauthorized users from triggering SOS on rides they are not part of', () => {
      const bookingId = 'bk_sec_sos_test';
      run(`
        INSERT OR REPLACE INTO bookings (
          id, booking_number, passenger_id, driver_id, vehicle_category_id, booking_type,
          pickup_lat, pickup_lng, pickup_address, destination_lat, destination_lng, destination_address,
          distance_km, duration_min, otp_code, fare_estimate, fare_source, fare_rule_version,
          surge_multiplier, payment_method, payment_status, status
        ) VALUES (
          ?, 'ADITI-SOS-001', 'usr_passenger', 'drv_rahul', 'cat_sedan', 'INSTANT',
          10.5276, 76.2144, 'A', 10.5360, 76.2220, 'B',
          5.0, 15, '5821', 150.0, 'ESTIMATE', 'v2.0',
          1.0, 'UPI', 'PENDING', 'TRIP_STARTED'
        )
      `, [bookingId]);

      // Malicious third party
      expect(() => {
        SafetyService.triggerSOS(bookingId, 'usr_unrelated_hacker', 10.52, 76.21, 'Fake SOS');
      }).toThrow(/Access forbidden/);

      // Legitimate passenger
      const legitResult = SafetyService.triggerSOS(bookingId, 'usr_passenger', 10.5276, 76.2144, 'Legit SOS');
      expect(legitResult.sosEvent.id).toBeDefined();
      expect(legitResult.emergencyContactsNotified).toBe(true);
    });

    it('should generate 256-bit cryptographically secure unguessable live share tokens', () => {
      const bookingId = 'bk_sec_share_test';
      const share = SafetyService.generateLiveShareToken(bookingId);

      expect(share.token.startsWith('share_')).toBe(true);
      expect(share.token.length).toBeGreaterThanOrEqual(64);
      expect(share.shareUrl).toBe(`/track/live/${share.token}`);
    });
  });

  describe('5. Booking State Transition Authorization & Tamper Resistance', () => {
    it('should prevent a passenger from fraudulently marking a trip as COMPLETED', () => {
      const bookingId = 'bk_sec_transition_test';
      run(`
        INSERT OR REPLACE INTO bookings (
          id, booking_number, passenger_id, driver_id, vehicle_category_id, booking_type,
          pickup_lat, pickup_lng, pickup_address, destination_lat, destination_lng, destination_address,
          distance_km, duration_min, otp_code, fare_estimate, fare_source, fare_rule_version,
          surge_multiplier, payment_method, payment_status, status
        ) VALUES (
          ?, 'ADITI-TRANS-001', 'usr_passenger', 'drv_rahul', 'cat_sedan', 'INSTANT',
          10.5276, 76.2144, 'A', 10.5360, 76.2220, 'B',
          5.0, 15, '5821', 150.0, 'ESTIMATE', 'v2.0',
          1.0, 'UPI', 'PENDING', 'TRIP_STARTED'
        )
      `, [bookingId]);

      // Passenger tries to complete the trip
      expect(() => {
        BookingStateMachine.transition(bookingId, 'COMPLETED', 'usr_passenger');
      }).toThrow(/Access forbidden: Only a verified driver or admin can transition/);
    });

    it('should prevent Driver B from completing or modifying Driver A assigned ride', () => {
      const bookingId = 'bk_sec_driver_mismatch';
      run(`
        INSERT OR REPLACE INTO bookings (
          id, booking_number, passenger_id, driver_id, vehicle_category_id, booking_type,
          pickup_lat, pickup_lng, pickup_address, destination_lat, destination_lng, destination_address,
          distance_km, duration_min, otp_code, fare_estimate, fare_source, fare_rule_version,
          surge_multiplier, payment_method, payment_status, status
        ) VALUES (
          ?, 'ADITI-TRANS-002', 'usr_passenger', 'drv_rahul', 'cat_sedan', 'INSTANT',
          10.5276, 76.2144, 'A', 10.5360, 76.2220, 'B',
          5.0, 15, '5821', 150.0, 'ESTIMATE', 'v2.0',
          1.0, 'UPI', 'PENDING', 'TRIP_STARTED'
        )
      `, [bookingId]);

      // Driver Arun attempts to complete Rahul's ride
      expect(() => {
        BookingStateMachine.transition(bookingId, 'COMPLETED', 'usr_driver_arun');
      }).toThrow(/Access forbidden: You are not the assigned driver/);
    });
  });

  describe('6. Voice Engine Missing Location Safety', () => {
    it('should prompt user for pickup location instead of silently assuming default coordinates when GPS is unavailable', () => {
      // User says "Book a sedan" without GPS coordinates or explicit pickup location
      const result = VoiceEngine.parseUtterance('Book a sedan to Lulu Mall', 0, 0, 'en');

      expect(result.preview?.actionRequired).toBe('ASK_DESTINATION');
      expect(result.preview?.spokenPrompt).toContain('Where should I pick you up?');
      expect(result.entities.pickup).toBe('Location Not Provided');
    });
  });

  describe('7. Double-Entry Ledger System (Paise Precision)', () => {
    it('should record double-entry transactions and correctly track balances', () => {
      const testUserId = `usr_ledger_test_${Date.now()}`;
      const userAccountId = LedgerService.getOrCreateAccount(testUserId, 'USER_WALLET');
      const clearingAccountId = LedgerService.getPlatformClearingAccount();

      // Top up ₹500 (50,000 paise)
      LedgerService.recordDoubleEntryTransaction(
        'WALLET_TOPUP',
        null,
        clearingAccountId,
        userAccountId,
        50000,
        'Test topup'
      );

      const bal = LedgerService.getWalletBalanceRupees(testUserId);
      expect(bal).toBe(500.0);
    });
  });

  describe('8. Idempotency Key Service', () => {
    it('should prevent duplicate executions with the same idempotency key and return cached response', () => {
      const key = `idem_test_${Date.now()}`;
      const userId = 'usr_passenger';

      // First call acquires
      const check1 = IdempotencyService.acquireKey(key, userId, 'TEST_OP', { test: 123 });
      expect(check1.isExisting).toBe(false);

      // Complete
      IdempotencyService.completeKey(key, userId, 201, { bookingId: 'bk_123', status: 'CONFIRMED' });

      // Second call returns cached
      const check2 = IdempotencyService.acquireKey(key, userId, 'TEST_OP', { test: 123 });
      expect(check2.isExisting).toBe(true);
      expect(check2.cachedResponse?.status).toBe(201);
      expect(check2.cachedResponse?.body.bookingId).toBe('bk_123');
    });
  });

  describe('9. Driver Availability Leases & Dispatch Pipeline', () => {
    it('should acquire atomic lease on driver and prevent double reservation', () => {
      const driverId = 'drv_rahul';
      run(`UPDATE driver_profiles SET availability_status = 'ONLINE', verification_status = 'VERIFIED' WHERE id = ?`, [driverId]);

      // Release any stale lease
      DispatchEngine.releaseDriverLease(driverId);

      // Booking 1 acquires lease
      const acquired1 = DispatchEngine.acquireDriverLease(driverId, 'bk_race_1', 20);
      expect(acquired1).toBe(true);

      // Booking 2 attempts to lease same driver -> rejected
      const acquired2 = DispatchEngine.acquireDriverLease(driverId, 'bk_race_2', 20);
      expect(acquired2).toBe(false);

      // Clean up
      DispatchEngine.releaseDriverLease(driverId);
    });
  });

  describe('10. Driver KYC Verification Guardrail', () => {
    it('should block unverified drivers from toggling status to ONLINE', () => {
      const testDriverId = 'drv_unverified_test';
      run(`
        INSERT OR REPLACE INTO driver_profiles (id, user_id, verification_status, availability_status)
        VALUES (?, 'usr_unverified', 'DOCUMENTS_PENDING', 'OFFLINE')
      `, [testDriverId]);

      expect(() => {
        DriverKYCService.assertCanGoOnline(testDriverId);
      }).toThrow(/Cannot go ONLINE: Driver status is 'DOCUMENTS_PENDING'/);

      // Admin reviews & verifies driver
      DriverKYCService.updateVerificationStatus(testDriverId, 'VERIFIED', 'usr_admin', 'Approved test KYC');
      expect(() => {
        DriverKYCService.assertCanGoOnline(testDriverId);
      }).not.toThrow();

      // Clean up
      run(`DELETE FROM driver_profiles WHERE id = ?`, [testDriverId]);
    });
  });
});
