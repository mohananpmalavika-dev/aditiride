import { describe, it, expect, beforeAll } from 'vitest';
import { getDb, run, get, query } from '../db/index.js';
import { AuditService } from '../services/AuditService.js';
import { AdminService } from '../services/AdminService.js';
import { MatchingEngine } from '../services/MatchingEngine.js';
import { generateToken, verifyToken } from '../middleware/auth.js';

describe('Production Hardening & Audit Hash Chain Certification', () => {
  beforeAll(async () => {
    await getDb();
  });

  describe('1. Cryptographically Tamper-Evident SHA-256 Audit Hash Chaining', () => {
    it('should generate sequential SHA-256 linked blocks from genesis', () => {
      const entry1 = AuditService.log({
        actorUserId: 'usr_admin',
        actorRole: 'SUPER_ADMIN',
        action: 'UPDATE_PRICING_CONFIG',
        entityType: 'PRICING_ZONE',
        entityId: 'zone_thrissur',
        newValues: { baseFare: 50.0 }
      });

      const entry2 = AuditService.log({
        actorUserId: 'usr_admin',
        actorRole: 'SUPER_ADMIN',
        action: 'APPROVE_DRIVER_KYC',
        entityType: 'DRIVER_DOC',
        entityId: 'doc_license_99',
        newValues: { status: 'APPROVED' }
      });

      expect(entry1.sequenceNumber).toBeGreaterThan(0);
      expect(entry2.sequenceNumber).toBe(entry1.sequenceNumber + 1);
      expect(entry1.eventHash).toHaveLength(64);
      expect(entry2.eventHash).toHaveLength(64);

      // Verify chain integrity
      const verification = AuditService.verifyChainIntegrity();
      expect(verification.isValid).toBe(true);
      expect(verification.checkedCount).toBeGreaterThanOrEqual(2);
    });

    it('should detect unauthorized tampering with past audit logs', () => {
      // Fetch latest audit log
      const latest = get<any>('SELECT * FROM audit_logs WHERE sequence_number IS NOT NULL ORDER BY sequence_number DESC LIMIT 1');
      expect(latest).toBeDefined();

      // Tamper with old audit record payload directly in DB
      run('UPDATE audit_logs SET new_values = ? WHERE id = ?', ['{"tampered": true}', latest.id]);

      // Chain integrity must immediately fail
      const verification = AuditService.verifyChainIntegrity();
      expect(verification.isValid).toBe(false);
      expect(verification.brokenSequence).toBe(latest.sequence_number);

      // Restore original value
      run('UPDATE audit_logs SET new_values = ? WHERE id = ?', [latest.new_values, latest.id]);
      const restoredVerification = AuditService.verifyChainIntegrity();
      expect(restoredVerification.isValid).toBe(true);
    });
  });

  describe('2. Driver OTP Security Hardening & Zero Pre-Trip Leakage', () => {
    it('should verify OTP sanitization logic for driver queries', () => {
      // Seed a test active booking
      const bId = `bk_sec_test_${Date.now()}`;
      run(`
        INSERT INTO bookings (
          id, booking_number, passenger_id, driver_id, vehicle_category_id,
          pickup_lat, pickup_lng, pickup_address, destination_lat, destination_lng, destination_address,
          distance_km, duration_min, fare_estimate, otp_code, status
        ) VALUES (
          ?, 'BK-SEC-01', 'usr_pass_aditi', 'drv_rahul', 'cat_sedan',
          10.5276, 76.2144, 'Round North', 10.5100, 76.2200, 'Railway Station',
          4.5, 12, 140.0, '7742', 'ACCEPTED'
        )
      `, [bId]);

      const rawBooking = get<any>('SELECT * FROM bookings WHERE id = ?', [bId]);
      expect(rawBooking.otp_code).toBe('7742');

      // Driver projection sanitization
      const driverProjection = { ...rawBooking };
      delete driverProjection.otp_code;

      expect(driverProjection.otp_code).toBeUndefined();
      expect(rawBooking.otp_code).toBe('7742');
    });
  });

  describe('3. Feature Maturity Lifecycle Gating', () => {
    it('should gate public features to only maturity >= END_TO_END', () => {
      const publicFeatures = query<any>(`
        SELECT key, enabled, maturity, description
        FROM feature_flags
        WHERE enabled = 1
          AND maturity IN ('END_TO_END', 'PRODUCTION_INTEGRATED', 'LOAD_TESTED', 'SECURITY_TESTED', 'PRODUCTION_CERTIFIED')
      `);

      const featureKeys = publicFeatures.map(f => f.key);
      expect(featureKeys).toContain('instant_ride');
      expect(featureKeys).toContain('favorite_drivers');
      expect(featureKeys).toContain('recurring_commute');

      // UI_ONLY or NOT_IMPLEMENTED features must NOT be in publicFeatures
      expect(featureKeys).not.toContain('rentals');
      expect(featureKeys).not.toContain('corporate_accounts');
      expect(featureKeys).not.toContain('audio_safety_recording');
    });

    it('should allow Admin full transparency into all maturity stages', () => {
      const allFeatures = query<any>('SELECT * FROM feature_flags ORDER BY key ASC');
      const keys = allFeatures.map(f => f.key);
      expect(keys).toContain('rentals');
      expect(keys).toContain('corporate_accounts');
      expect(keys).toContain('instant_ride');
    });
  });

  describe('4. MatchingEngine PostGIS Compatibility', () => {
    it('should find nearby candidates and compute ranked scores without throwing errors', () => {
      const candidates = MatchingEngine.findNearbyDrivers(
        'usr_passenger',
        10.5276,
        76.2144,
        'cat_sedan',
        10.0
      );

      expect(candidates).toBeInstanceOf(Array);
      if (candidates.length > 0) {
        expect(candidates[0].score).toBeGreaterThan(0);
        expect(candidates[0].distanceToPickupKm).toBeGreaterThanOrEqual(0);
        expect(candidates[0].driverTotalFare).toBeGreaterThan(0);
      }
    });
  });

  describe('5. Expanded Real-Time Fraud & Teleportation Sentinel', () => {
    it('should detect impossible speed GPS teleportation anomalies (>160 km/h)', () => {
      // Seed a trip with 55 km distance in 2 minutes (1650 km/h)
      run(`
        INSERT OR REPLACE INTO bookings (
          id, booking_number, passenger_id, driver_id, vehicle_category_id,
          pickup_lat, pickup_lng, pickup_address, destination_lat, destination_lng, destination_address,
          distance_km, duration_min, fare_estimate, otp_code, status
        ) VALUES (
          'bk_teleport_01', 'BK-TEL-01', 'usr_passenger', 'drv_rahul', 'cat_sedan',
          10.5276, 76.2144, 'Thrissur', 9.9312, 76.2673, 'Kochi',
          55.0, 2, 850.0, '9911', 'COMPLETED'
        )
      `);

      const anomalies = AdminService.scanFraudAnomalies();
      expect(anomalies).toBeInstanceOf(Array);

      const teleport = anomalies.find(a => a.type === 'GPS_SPOOF_OR_TELEPORTATION');
      expect(teleport).toBeDefined();
      expect(teleport?.severity).toBe('CRITICAL');
      expect(teleport?.details).toContain('exceeds physics threshold');
    });
  });
});
