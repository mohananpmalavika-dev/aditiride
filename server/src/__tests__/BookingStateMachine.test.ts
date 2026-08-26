import { describe, it, expect, beforeAll } from 'vitest';
import { getDb, run, get } from '../db/index.js';
import { BookingStateMachine } from '../services/BookingStateMachine.js';
import { Booking } from '../types/index.js';

describe('Booking State Machine & Lifecycle Tests', () => {
  beforeAll(async () => {
    await getDb();
  });

  it('enforces legal transitions and prevents illegal transitions', () => {
    expect(BookingStateMachine.canTransition('CREATED', 'SEARCHING')).toBe(true);
    expect(BookingStateMachine.canTransition('SEARCHING', 'DRIVER_ASSIGNED')).toBe(true);
    expect(BookingStateMachine.canTransition('DRIVER_ASSIGNED', 'DRIVER_ACCEPTED')).toBe(true);
    expect(BookingStateMachine.canTransition('DRIVER_ACCEPTED', 'DRIVER_EN_ROUTE')).toBe(true);
    expect(BookingStateMachine.canTransition('DRIVER_EN_ROUTE', 'DRIVER_ARRIVED')).toBe(true);
    expect(BookingStateMachine.canTransition('DRIVER_ARRIVED', 'TRIP_STARTED')).toBe(true);
    expect(BookingStateMachine.canTransition('TRIP_STARTED', 'COMPLETED')).toBe(true);

    // Illegal transitions
    expect(BookingStateMachine.canTransition('CREATED', 'COMPLETED')).toBe(false);
    expect(BookingStateMachine.canTransition('CREATED', 'TRIP_STARTED')).toBe(false);
    expect(BookingStateMachine.canTransition('COMPLETED', 'SEARCHING')).toBe(false);
  });

  it('requires valid 4-digit OTP to transition to TRIP_STARTED', () => {
    // Create test booking
    run(`
      INSERT INTO bookings (
        id, booking_number, passenger_id, driver_id, vehicle_category_id,
        pickup_lat, pickup_lng, pickup_address, destination_lat, destination_lng, destination_address,
        distance_km, duration_min, otp_code, fare_estimate, status
      ) VALUES (
        'bk_test_otp_1', 'ADITI-TEST-1', 'usr_passenger', 'drv_rahul', 'cat_sedan',
        10.52, 76.21, 'Pickup', 10.53, 76.22, 'Dest',
        4.0, 12, '7788', 150.0, 'DRIVER_ARRIVED'
      )
    `);

    // Invalid OTP should throw error
    expect(() => {
      BookingStateMachine.transition('bk_test_otp_1', 'TRIP_STARTED', 'usr_driver_rahul', {
        otp: '0000'
      });
    }).toThrow(/Invalid passenger OTP/);

    // Correct OTP should succeed
    const started = BookingStateMachine.transition('bk_test_otp_1', 'TRIP_STARTED', 'usr_driver_rahul', {
      otp: '7788'
    });
    expect(started.status).toBe('TRIP_STARTED');

    // Complete trip
    const completed = BookingStateMachine.transition('bk_test_otp_1', 'COMPLETED', 'usr_driver_rahul');
    expect(completed.status).toBe('COMPLETED');
    expect(completed.payment_status).toBe('COMPLETED');

    // Cleanup test booking
    run(`DELETE FROM bookings WHERE id = 'bk_test_otp_1'`);
  });
});
