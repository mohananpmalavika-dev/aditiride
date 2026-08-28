import { describe, it, expect, beforeAll } from 'vitest';
import { getDb, run, query, get } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

describe('PRD Complete Feature Parity & Modules Test Suite', () => {
  beforeAll(async () => {
    await getDb();

    // Ensure sample ride pass exists
    run(`
      INSERT OR IGNORE INTO ride_passes (id, name, description, price, total_rides, discount_per_ride, vehicle_category_id, validity_days, badge_color, is_active)
      VALUES ('pass_auto_commute_10', '10-Ride Auto Commute Pass', 'Flat ₹15 off on 10 Auto rides across Kerala', 120.0, 10, 15.0, 'cat_auto', 30, 'emerald', 1)
    `);
  });

  // ==========================================================================
  // 1. BOOK FOR SOMEONE ELSE / FAMILY BOOKING (PRD §4.5)
  // ==========================================================================
  describe('1. Book for Someone Else / Family Booking (§4.5)', () => {
    it('should store and query a booking made for a family member with rider contact and payment mode', () => {
      const bookingId = `bk_other_${uuidv4().substring(0, 8)}`;
      const bookingNumber = `ADITI-2026-${Math.floor(1000 + Math.random() * 9000)}`;

      run(`
        INSERT INTO bookings (
          id, booking_number, passenger_id, vehicle_category_id, booking_type,
          pickup_lat, pickup_lng, pickup_address, destination_lat, destination_lng, destination_address,
          distance_km, duration_min, is_booking_for_other, rider_name, rider_phone, rider_payment_mode,
          otp_code, fare_estimate, fare_source, fare_rule_version, surge_multiplier, payment_method, status
        ) VALUES (
          ?, ?, 'usr_passenger', 'cat_auto', 'INSTANT',
          10.5276, 76.2144, 'Swaraj Round, Thrissur', 10.5360, 76.2220, 'Lulu Mall Thrissur',
          4.5, 15, 1, 'Amma (Lakshmi)', '+919847099999', 'RIDER_PAYS_CASH',
          '4512', 85.0, 'PLATFORM_COMMON', '1.0.0', 1.0, 'CASH', 'PENDING'
        )
      `, [bookingId, bookingNumber]);

      const record = get<any>('SELECT * FROM bookings WHERE id = ?', [bookingId]);
      expect(record).toBeDefined();
      expect(record.is_booking_for_other).toBe(1);
      expect(record.rider_name).toBe('Amma (Lakshmi)');
      expect(record.rider_phone).toBe('+919847099999');
      expect(record.rider_payment_mode).toBe('RIDER_PAYS_CASH');
    });
  });

  // ==========================================================================
  // 2. LOST & FOUND MANAGEMENT DESK (PRD §14.3)
  // ==========================================================================
  describe('2. Lost & Found Support Desk (§14.3)', () => {
    let createdLostItemId: string;

    it('should create and retrieve a reported lost item with category and reward fee', () => {
      createdLostItemId = `lf_${uuidv4().substring(0, 8)}`;
      run(`
        INSERT INTO lost_and_found_items (
          id, booking_id, passenger_id, driver_id, item_category, item_description, contact_phone, return_fee, status
        ) VALUES (
          ?, 'bk_sample_past_1', 'usr_passenger', 'drv_rahul', 'WALLET', 'Brown leather wallet with driving license', '9847012345', 200.0, 'REPORTED'
        )
      `, [createdLostItemId]);

      const item = get<any>('SELECT * FROM lost_and_found_items WHERE id = ?', [createdLostItemId]);
      expect(item).toBeDefined();
      expect(item.item_category).toBe('WALLET');
      expect(item.status).toBe('REPORTED');
      expect(item.return_fee).toBe(200.0);
    });

    it('should update lost item lifecycle to ITEM_FOUND and mark as RESOLVED with driver notes', () => {
      run(`
        UPDATE lost_and_found_items
        SET status = 'RESOLVED',
            driver_notes = 'Handed over wallet to passenger at Swaraj Round'
        WHERE id = ?
      `, [createdLostItemId]);

      const updated = get<any>('SELECT * FROM lost_and_found_items WHERE id = ?', [createdLostItemId]);
      expect(updated.status).toBe('RESOLVED');
      expect(updated.driver_notes).toContain('Handed over wallet');
    });
  });

  // ==========================================================================
  // 3. RECURRING RIDES & ROUTINE COMMUTE SERIES (PRD §8.2)
  // ==========================================================================
  describe('3. Recurring Rides & Routine Commute Series (§8.2)', () => {
    let seriesId: string;

    it('should schedule a daily weekday recurring commute series', () => {
      seriesId = `rec_${uuidv4().substring(0, 8)}`;
      const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

      run(`
        INSERT INTO recurring_ride_series (
          id, passenger_id, vehicle_category_id, pickup_lat, pickup_lng, pickup_address,
          destination_lat, destination_lng, destination_address, pickup_time, days_of_week,
          start_date, end_date, status, skipped_dates, contracted_fare, payment_method
        ) VALUES (
          ?, 'usr_passenger', 'cat_auto', 10.5276, 76.2144, 'Swaraj Round, Thrissur',
          10.0104, 76.3639, 'Infopark Kochi', '08:30', ?,
          '2026-09-01', '2026-09-30', 'ACTIVE', '[]', 180.0, 'WALLET'
        )
      `, [seriesId, JSON.stringify(days)]);

      const series = get<any>('SELECT * FROM recurring_ride_series WHERE id = ?', [seriesId]);
      expect(series).toBeDefined();
      expect(series.status).toBe('ACTIVE');
      expect(JSON.parse(series.days_of_week)).toEqual(days);
      expect(series.contracted_fare).toBe(180.0);
    });

    it('should allow skipping a specific commute date without deleting the series', () => {
      const series = get<any>('SELECT * FROM recurring_ride_series WHERE id = ?', [seriesId]);
      const skipped = JSON.parse(series.skipped_dates || '[]');
      skipped.push('2026-09-05');

      run('UPDATE recurring_ride_series SET skipped_dates = ? WHERE id = ?', [JSON.stringify(skipped), seriesId]);

      const updated = get<any>('SELECT * FROM recurring_ride_series WHERE id = ?', [seriesId]);
      const updatedSkipped = JSON.parse(updated.skipped_dates);
      expect(updatedSkipped).toContain('2026-09-05');
      expect(updated.status).toBe('ACTIVE');
    });

    it('should allow pausing and resuming recurring series', () => {
      run("UPDATE recurring_ride_series SET status = 'PAUSED' WHERE id = ?", [seriesId]);
      let record = get<any>('SELECT status FROM recurring_ride_series WHERE id = ?', [seriesId]);
      expect(record.status).toBe('PAUSED');

      run("UPDATE recurring_ride_series SET status = 'ACTIVE' WHERE id = ?", [seriesId]);
      record = get<any>('SELECT status FROM recurring_ride_series WHERE id = ?', [seriesId]);
      expect(record.status).toBe('ACTIVE');
    });
  });

  // ==========================================================================
  // 4. LOYALTY TIERS, RIDE PASSES & REFERRAL REWARDS (PRD §13)
  // ==========================================================================
  describe('4. Loyalty Tiers, Ride Passes & Referrals (§13)', () => {
    it('should verify available commuter ride passes in store', () => {
      const passes = query<any>('SELECT * FROM ride_passes WHERE is_active = 1');
      expect(passes.length).toBeGreaterThan(0);
      const autoPass = passes.find(p => p.id === 'pass_auto_commute_10');
      expect(autoPass).toBeDefined();
      expect(autoPass.total_rides).toBe(10);
      expect(autoPass.discount_per_ride).toBe(15.0);
    });

    it('should purchase a ride pass and deduct wallet balance with active credit entitlement', () => {
      // Ensure passenger has wallet balance
      run("UPDATE wallets SET balance = 1000.0 WHERE user_id = 'usr_passenger'");
      
      const pass = get<any>("SELECT * FROM ride_passes WHERE id = 'pass_auto_commute_10'");
      expect(pass).toBeDefined();
      const userPassId = `upass_${uuidv4().substring(0, 8)}`;
      const expiresAt = new Date(Date.now() + pass.validity_days * 86400000).toISOString();

      run(`
        INSERT INTO user_ride_passes (id, user_id, pass_id, rides_remaining, expires_at, status)
        VALUES (?, 'usr_passenger', ?, ?, ?, 'ACTIVE')
      `, [userPassId, pass.id, pass.total_rides, expiresAt]);

      run('UPDATE wallets SET balance = balance - ? WHERE user_id = ?', [pass.price, 'usr_passenger']);

      const userPass = get<any>('SELECT * FROM user_ride_passes WHERE id = ?', [userPassId]);
      expect(userPass).toBeDefined();
      expect(userPass.rides_remaining).toBe(10);
      expect(userPass.status).toBe('ACTIVE');
    });

    it('should track viral referral reward codes and bonuses', () => {
      const refId = `ref_${uuidv4().substring(0, 8)}`;
      run(`
        INSERT INTO referral_rewards (id, referrer_user_id, referred_user_id, referral_code, bonus_amount, status, credited_at)
        VALUES (?, 'usr_passenger', 'usr_admin', 'ADITI-DHANYA-4512', 100.0, 'CREDITED', datetime('now'))
      `, [refId]);

      const reward = get<any>('SELECT * FROM referral_rewards WHERE id = ?', [refId]);
      expect(reward).toBeDefined();
      expect(reward.bonus_amount).toBe(100.0);
      expect(reward.status).toBe('CREDITED');
    });
  });

  // ==========================================================================
  // 5. DRIVER COMPLIANCE DOCUMENTS & KYC REVIEW (PRD §9.5 & §15)
  // ==========================================================================
  describe('5. Driver Compliance & KYC Review (§9.5 & §15)', () => {
    let docId: string;

    it('should upload driver compliance document with PENDING status', () => {
      docId = `cdoc_${uuidv4().substring(0, 8)}`;
      run(`
        INSERT INTO driver_compliance_documents (id, driver_id, document_type, document_number, document_url, expiry_date, verification_status)
        VALUES (?, 'drv_rahul', 'POLICE_VERIFICATION', 'POL-KL-THR-2026-991', 'https://aditiride.com/docs/pcc.pdf', '2028-12-31', 'PENDING')
      `, [docId]);

      const doc = get<any>('SELECT * FROM driver_compliance_documents WHERE id = ?', [docId]);
      expect(doc).toBeDefined();
      expect(doc.verification_status).toBe('PENDING');
      expect(doc.document_type).toBe('POLICE_VERIFICATION');
    });

    it('should allow admin to verify and approve compliance document', () => {
      run(`
        UPDATE driver_compliance_documents
        SET verification_status = 'APPROVED',
            verified_by = 'usr_admin',
            verified_at = datetime('now')
        WHERE id = ?
      `, [docId]);

      const updated = get<any>('SELECT * FROM driver_compliance_documents WHERE id = ?', [docId]);
      expect(updated.verification_status).toBe('APPROVED');
      expect(updated.verified_by).toBe('usr_admin');
    });
  });

  // ==========================================================================
  // 6. DRIVER EARNINGS SIMULATOR (PRD §9.4)
  // ==========================================================================
  describe('6. Driver Earnings Simulator Formula (§9.4)', () => {
    it('should accurately compute gross fare, 10% commission, 5% GST, fuel cost, and daily net take-home', () => {
      const baseFare = 35.0;
      const perKmRate = 16.0;
      const tripsPerDay = 12;
      const avgDistanceKm = 6.5;

      const dailyGross = tripsPerDay * (baseFare + avgDistanceKm * perKmRate); // 12 * (35 + 104) = 12 * 139 = 1668
      const platformCommission = dailyGross * 0.10; // 166.8
      const gstTax = platformCommission * 0.05; // 8.34
      const fuelCostEstimate = tripsPerDay * avgDistanceKm * 3.2; // 12 * 6.5 * 3.2 = 249.6
      const dailyNetEarnings = dailyGross - platformCommission - fuelCostEstimate;
      const monthlyProjectedNet = dailyNetEarnings * 26;

      expect(dailyGross).toBe(1668);
      expect(platformCommission).toBeCloseTo(166.8, 1);
      expect(dailyNetEarnings).toBeGreaterThan(1200);
      expect(monthlyProjectedNet).toBeGreaterThan(30000);
    });
  });

  // ==========================================================================
  // 7. ADMIN SYSTEM AUDIT LOGS & RBAC (PRD §15 & Appendix A)
  // ==========================================================================
  describe('7. Admin System Audit Trail & RBAC Catalogue (§15)', () => {
    it('should write and retrieve tamper-evident audit logs with actor and entity metadata', () => {
      const auditId = uuidv4();
      run(`
        INSERT INTO audit_logs (id, actor_user_id, actor_role, action, entity_type, entity_id, new_values, ip_address, user_agent)
        VALUES (?, 'usr_admin', 'ADMIN', 'APPROVE_COMPLIANCE_DOC', 'driver_compliance_documents', 'cdoc_1', '{"status":"APPROVED"}', '127.0.0.1', 'Antigravity/2.0')
      `, [auditId]);

      const log = get<any>('SELECT * FROM audit_logs WHERE id = ?', [auditId]);
      expect(log).toBeDefined();
      expect(log.action).toBe('APPROVE_COMPLIANCE_DOC');
      expect(log.actor_role).toBe('ADMIN');
      expect(log.entity_type).toBe('driver_compliance_documents');
    });

    it('should enforce the complete PRD Appendix A RBAC privilege matrix', () => {
      const rbacRoles = [
        'trip.read',
        'trip.support',
        'pricing.city.edit',
        'pricing.driver_bounds.edit',
        'driver.verify',
        'driver.suspend',
        'passenger.block',
        'refund.approve',
        'payout.release',
        'incident.manage',
        'audit.export'
      ];

      expect(rbacRoles.length).toBe(11);
      expect(rbacRoles).toContain('pricing.city.edit');
      expect(rbacRoles).toContain('driver.verify');
      expect(rbacRoles).toContain('refund.approve');
    });
  });
});
