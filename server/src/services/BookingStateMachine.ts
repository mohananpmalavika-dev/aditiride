import { query, get, run } from '../db/index.js';
import { Booking, BookingStatus, DriverProfile, VehicleCategory, UserRole } from '../types/index.js';
import { FareEngine } from './FareEngine.js';

export class BookingStateMachine {
  private static readonly VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
    CREATED: ['SEARCHING', 'CANCELLED_BY_PASSENGER', 'EXPIRED'],
    SEARCHING: ['OFFERED', 'DRIVER_ASSIGNED', 'NO_DRIVER', 'CANCELLED_BY_PASSENGER', 'EXPIRED'],
    OFFERED: ['DRIVER_ACCEPTED', 'SEARCHING', 'NO_DRIVER', 'CANCELLED_BY_PASSENGER', 'EXPIRED'],
    DRIVER_ASSIGNED: ['DRIVER_ACCEPTED', 'SEARCHING', 'NO_DRIVER', 'CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER'],
    DRIVER_ACCEPTED: ['DRIVER_EN_ROUTE', 'CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER', 'SAFETY_TERMINATED'],
    DRIVER_EN_ROUTE: ['DRIVER_ARRIVED', 'CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER', 'SAFETY_TERMINATED'],
    DRIVER_ARRIVED: ['TRIP_STARTED', 'CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER', 'SAFETY_TERMINATED'],
    TRIP_STARTED: ['TRIP_IN_PROGRESS', 'COMPLETED', 'SAFETY_TERMINATED'],
    TRIP_IN_PROGRESS: ['COMPLETED', 'SAFETY_TERMINATED'],
    COMPLETED: [],
    CANCELLED_BY_PASSENGER: [],
    CANCELLED_BY_DRIVER: [],
    EXPIRED: [],
    NO_DRIVER: [],
    SAFETY_TERMINATED: []
  };

  /**
   * Validate if a status transition is allowed
   */
  public static canTransition(currentStatus: BookingStatus, newStatus: BookingStatus): boolean {
    const allowed = this.VALID_TRANSITIONS[currentStatus];
    return allowed ? allowed.includes(newStatus) : false;
  }

  /**
   * Transition booking state with strict validations & side-effects
   */
  public static transition(
    bookingId: string,
    newStatus: BookingStatus,
    triggeredByUserId: string,
    metadata: {
      otp?: string;
      cancellationReason?: string;
      driverId?: string;
      finalDistanceKm?: number;
      finalDurationMin?: number;
    } = {}
  ): Booking {
    const booking = get<Booking>('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    if (!this.canTransition(booking.status, newStatus)) {
      throw new Error(
        `Illegal state transition: Cannot change booking status from '${booking.status}' to '${newStatus}'`
      );
    }

    const now = new Date().toISOString();

    // Verification for starting trip: OTP Check
    if (newStatus === 'TRIP_STARTED') {
      if (!metadata.otp || metadata.otp.trim() !== booking.otp_code.trim()) {
        throw new Error('Invalid passenger OTP. Please ask the passenger for the correct 4-digit OTP shown on their screen.');
      }
    }

    // Cancellation fee logic
    let cancellationFee = 0.0;
    if (newStatus === 'CANCELLED_BY_PASSENGER') {
      const category = get<VehicleCategory>('SELECT * FROM vehicle_categories WHERE id = ?', [booking.vehicle_category_id]);
      if (booking.status === 'DRIVER_ARRIVED' || booking.status === 'DRIVER_EN_ROUTE') {
        cancellationFee = category?.cancellation_fee || 30.0;
      }
    }

    // Update fields according to state
    if (newStatus === 'DRIVER_ASSIGNED' || newStatus === 'DRIVER_ACCEPTED') {
      const driverId = metadata.driverId || booking.driver_id;
      if (driverId) {
        // Concurrency check: Ensure driver is not already ON_TRIP
        const driver = get<DriverProfile>('SELECT * FROM driver_profiles WHERE id = ?', [driverId]);
        if (driver && driver.availability_status === 'ON_TRIP') {
          throw new Error('Driver is currently on another active trip.');
        }

        run(
          `UPDATE bookings SET driver_id = ?, status = ?, accepted_at = COALESCE(accepted_at, ?) WHERE id = ?`,
          [driverId, newStatus, now, bookingId]
        );
        run(`UPDATE driver_profiles SET availability_status = 'ON_TRIP' WHERE id = ?`, [driverId]);
      }
    } else if (newStatus === 'DRIVER_ARRIVED') {
      run(`UPDATE bookings SET status = ?, arrived_at = ? WHERE id = ?`, [newStatus, now, bookingId]);
    } else if (newStatus === 'TRIP_STARTED') {
      run(`UPDATE bookings SET status = ?, started_at = ? WHERE id = ?`, [newStatus, now, bookingId]);
    } else if (newStatus === 'COMPLETED') {
      const distance = metadata.finalDistanceKm || booking.distance_km;
      const duration = metadata.finalDurationMin || booking.duration_min;
      const finalFare = booking.fare_estimate; // Or recalibrated if deviation

      run(
        `UPDATE bookings SET status = ?, completed_at = ?, final_fare = ?, payment_status = 'COMPLETED' WHERE id = ?`,
        [newStatus, now, finalFare, bookingId]
      );

      if (booking.driver_id) {
        // Free driver back to ONLINE
        run(`UPDATE driver_profiles SET availability_status = 'ONLINE', total_trips = total_trips + 1 WHERE id = ?`, [booking.driver_id]);
      }
    } else if (newStatus === 'CANCELLED_BY_PASSENGER' || newStatus === 'CANCELLED_BY_DRIVER') {
      run(
        `UPDATE bookings SET status = ?, cancelled_at = ?, cancellation_reason = ?, cancellation_fee = ? WHERE id = ?`,
        [newStatus, now, metadata.cancellationReason || 'User cancelled', cancellationFee, bookingId]
      );

      if (booking.driver_id) {
        run(`UPDATE driver_profiles SET availability_status = 'ONLINE' WHERE id = ?`, [booking.driver_id]);
      }
    } else {
      run(`UPDATE bookings SET status = ? WHERE id = ?`, [newStatus, bookingId]);
    }

    // Fetch updated snapshot
    const updated = get<Booking>(`
      SELECT 
        b.*,
        pu.name as passenger_name, pu.phone as passenger_phone,
        du.name as driver_name, du.phone as driver_phone, du.avatar_url as driver_avatar,
        d.current_lat as driver_lat, d.current_lng as driver_lng, d.heading as driver_heading, d.rating_avg as driver_rating,
        v.brand as vehicle_brand, v.model as vehicle_model, v.color as vehicle_color, v.plate_number as vehicle_plate,
        vc.name as vehicle_category_name
      FROM bookings b
      JOIN users pu ON b.passenger_id = pu.id
      LEFT JOIN driver_profiles d ON b.driver_id = d.id
      LEFT JOIN users du ON d.user_id = du.id
      LEFT JOIN vehicles v ON v.driver_id = d.id
      JOIN vehicle_categories vc ON b.vehicle_category_id = vc.id
      WHERE b.id = ?
    `, [bookingId]);

    return updated!;
  }
}
