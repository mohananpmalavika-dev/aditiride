import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from '../db/index.js';
import { FareEngine } from '../services/FareEngine.js';

describe('Authoritative FareEngine Tests', () => {
  beforeAll(async () => {
    await getDb();
  });

  it('calculates standard admin common fare for Auto correctly', () => {
    const quote = FareEngine.calculateFare({
      vehicleCategoryId: 'cat_auto',
      distanceKm: 5.0,
      durationMin: 15,
      pickupLat: 10.5276,
      pickupLng: 76.2144
    });

    expect(quote).toBeDefined();
    expect(quote.vehicle_category_id).toBe('cat_auto');
    expect(quote.base_fare).toBe(35.0);
    // distanceFare = 5.0 * 14.0 = 70.0
    expect(quote.distance_fare).toBe(70.0);
    // timeFare = 15 * 2.0 = 30.0
    expect(quote.time_fare).toBe(30.0);
    expect(quote.total_fare).toBeGreaterThanOrEqual(50.0); // Above minimum fare
    expect(quote.platform_commission).toBeGreaterThan(0);
    expect(quote.driver_payout).toBeGreaterThan(0);
  });

  it('enforces minimum fare when calculated fare is below threshold', () => {
    const quote = FareEngine.calculateFare({
      vehicleCategoryId: 'cat_sedan',
      distanceKm: 0.2, // Very short trip
      durationMin: 2,
      pickupLat: 10.5276,
      pickupLng: 76.2144
    });

    expect(quote.total_fare).toBeGreaterThanOrEqual(120.0); // Min fare for Sedan is 120
  });

  it('validates driver custom pricing bounds within admin max deviation (+/-20%)', () => {
    // Admin Sedan per_km_rate is 20.0, max_deviation is 20% -> allowed [16.0, 24.0]
    const valid = FareEngine.validateDriverPricing('cat_sedan', 22.0);
    expect(valid.valid).toBe(true);

    const tooHigh = FareEngine.validateDriverPricing('cat_sedan', 30.0);
    expect(tooHigh.valid).toBe(false);
    expect(tooHigh.message).toContain('Admin limit ±20%');

    const tooLow = FareEngine.validateDriverPricing('cat_sedan', 12.0);
    expect(tooLow.valid).toBe(false);
  });

  it('applies driver custom pricing when driver has approved custom rates', () => {
    const quote = FareEngine.calculateFare({
      vehicleCategoryId: 'cat_sedan',
      distanceKm: 10.0,
      durationMin: 30,
      driverId: 'drv_rahul' // Rahul has custom rate ₹22/km
    });

    expect(quote.fare_source).toBe('DRIVER_CUSTOM');
    // distanceFare = 10.0 * 22.0 = 220.0
    expect(quote.distance_fare).toBe(220.0);
  });

  it('calculates multi-stop surcharge correctly', () => {
    const directQuote = FareEngine.calculateFare({
      vehicleCategoryId: 'cat_auto',
      distanceKm: 6.0,
      durationMin: 20
    });

    const multiStopQuote = FareEngine.calculateFare({
      vehicleCategoryId: 'cat_auto',
      distanceKm: 6.0,
      durationMin: 20,
      numberOfStops: 2 // 2 stops * ₹20 = ₹40 extra
    });

    expect(multiStopQuote.total_fare).toBeGreaterThan(directQuote.total_fare);
  });
});
