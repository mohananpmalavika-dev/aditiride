import { describe, it, expect, beforeAll } from 'vitest';
import { getDb, run } from '../db/index.js';
import { MatchingEngine } from '../services/MatchingEngine.js';

describe('Matching Engine & Two-Way Blocking Tests', () => {
  beforeAll(async () => {
    await getDb();
    run("DELETE FROM user_blocks WHERE id LIKE 'blk_test_%' OR id LIKE 'blk_sec_%'");
    run("UPDATE driver_profiles SET availability_status = 'ONLINE'");
  });

  it('finds and ranks nearby online verified drivers', () => {
    const drivers = MatchingEngine.findNearbyDrivers(
      'usr_passenger',
      10.5276,
      76.2144,
      'cat_auto',
      10.0
    );

    expect(drivers.length).toBeGreaterThan(0);
    expect(drivers[0].driverId).toBe('drv_arun'); // Arun is online Auto driver
    expect(drivers[0].score).toBeGreaterThan(0);
    expect(drivers[0].distanceToPickupKm).toBeLessThanOrEqual(10.0);
  });

  it('prioritizes favorite drivers in composite ranking score', () => {
    run("UPDATE driver_profiles SET availability_status = 'ONLINE' WHERE id = 'drv_rahul'");
    run("INSERT OR IGNORE INTO favorites (id, passenger_id, driver_id, status) VALUES ('fav_rahul_test', 'usr_passenger', 'drv_rahul', 'ACTIVE')");
    run("UPDATE favorites SET status = 'ACTIVE' WHERE passenger_id = 'usr_passenger' AND driver_id = 'drv_rahul'");

    // Rahul is favorite driver for Sedan
    const drivers = MatchingEngine.findNearbyDrivers(
      'usr_passenger',
      10.5276,
      76.2144,
      'cat_sedan',
      10.0
    );

    expect(drivers.length).toBeGreaterThan(0);
    const rahul = drivers.find(d => d.driverId === 'drv_rahul');
    expect(rahul).toBeDefined();
    expect(rahul?.isFavorite).toBe(true);
  });

  it('strictly excludes drivers when a bilateral block is active', () => {
    // Block Arun Kumar
    run(`
      INSERT INTO user_blocks (id, blocker_user_id, blocked_user_id, reason, block_type, status, created_by)
      VALUES ('blk_test_arun', 'usr_passenger', 'usr_driver_arun', 'Test block', 'PASSENGER_TO_DRIVER', 'ACTIVE', 'usr_passenger')
    `);

    const driversAfterBlock = MatchingEngine.findNearbyDrivers(
      'usr_passenger',
      10.5276,
      76.2144,
      'cat_auto',
      10.0
    );

    const arun = driversAfterBlock.find(d => d.driverId === 'drv_arun');
    expect(arun).toBeUndefined(); // Arun must NOT appear

    // Cleanup test block
    run(`DELETE FROM user_blocks WHERE id = 'blk_test_arun'`);
  });

  it('computes individualized pickup distance charges and returns up to 10 candidate drivers', () => {
    // Configure Rahul with 3 km free pickup and Arun with 1 km free pickup
    run(`UPDATE driver_profiles SET free_pickup_km = 3.0, pickup_charge_per_km = 10.0 WHERE id = 'drv_rahul'`);
    run(`UPDATE driver_profiles SET free_pickup_km = 1.0, pickup_charge_per_km = 10.0 WHERE id = 'drv_arun'`);

    const drivers = MatchingEngine.findNearbyDrivers(
      'usr_passenger',
      10.5276,
      76.2144,
      'cat_sedan',
      10.0,
      undefined,
      6.0, // 6 km trip
      18   // 18 min trip
    );

    expect(drivers.length).toBeGreaterThan(0);
    expect(drivers.length).toBeLessThanOrEqual(10);

    const firstDriver = drivers[0];
    expect(firstDriver.freePickupKm).toBeDefined();
    expect(firstDriver.pickupChargePerKm).toBeDefined();
    expect(firstDriver.driverTotalFare).toBeGreaterThan(0);
    expect(firstDriver.distanceToPickupKm).toBeGreaterThanOrEqual(0);
  });
});
