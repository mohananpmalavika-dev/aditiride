import { query, get, run } from '../db/index.js';
import { Booking, BookingStatus, DriverProfile, VehicleCategory, User } from '../types/index.js';
import { FareEngine } from './FareEngine.js';
import { SafetyService } from './SafetyService.js';

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
   * Transition booking state with strict role verification, participant checks, and authoritative final calculations
   */
  public static transition(
    bookingId: string,
    newStatus: BookingStatus,
    triggeredByUserId: string,
    metadata: {
      otp?: string;
      cancellationReason?: string;
      finalDistanceKm?: number;
      finalDurationMin?: number;
    } = {}
  ): Booking {
    const booking = get<Booking>('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (!booking) {
      throw new Error(`Booking '${bookingId}' not found.`);
    }

    if (!this.canTransition(booking.status, newStatus)) {
      throw new Error(
        `Illegal state transition: Cannot change booking status from '${booking.status}' to '${newStatus}'.`
      );
    }

    const actor = get<User>('SELECT * FROM users WHERE id = ?', [triggeredByUserId]);
    if (!actor) {
      throw new Error(`Acting user '${triggeredByUserId}' not found.`);
    }

    const driverProfile = booking.driver_id
      ? get<DriverProfile>('SELECT * FROM driver_profiles WHERE id = ?', [booking.driver_id])
      : null;

    const isPassenger = booking.passenger_id === triggeredByUserId;
    const isAssignedDriver = driverProfile ? driverProfile.user_id === triggeredByUserId : false;
    const isAdmin = actor.role === 'SUPER_ADMIN' || actor.role === 'ADMIN';

    // 1. Strict Role & Participant Guardrails
    const driverActions: BookingStatus[] = [
      'DRIVER_ACCEPTED',
      'DRIVER_EN_ROUTE',
      'DRIVER_ARRIVED',
      'TRIP_STARTED',
      'TRIP_IN_PROGRESS',
      'COMPLETED'
    ];

    if (driverActions.includes(newStatus)) {
      if (actor.role !== 'DRIVER' && !isAdmin) {
        throw new Error(`Access forbidden: Only a verified driver or admin can transition booking to '${newStatus}'.`);
      }

      // If already assigned to a specific driver, ensure it's that driver
      if (booking.driver_id && !isAssignedDriver && !isAdmin) {
        throw new Error('Access forbidden: You are not the assigned driver for this booking.');
      }
    }

    if (newStatus === 'CANCELLED_BY_PASSENGER' && !isPassenger && !isAdmin) {
      throw new Error('Access forbidden: Only the passenger can cancel this ride.');
    }

    if (newStatus === 'CANCELLED_BY_DRIVER' && !isAssignedDriver && !isAdmin) {
      throw new Error('Access forbidden: Only the assigned driver can cancel this ride.');
    }

    const now = new Date().toISOString();

    // 2. Verification for Starting Trip: Mandatory 4-digit OTP
    if (newStatus === 'TRIP_STARTED') {
      if (!metadata.otp) {
        throw new Error('Invalid passenger OTP. Please enter the 4-digit OTP shown on the passenger screen.');
      }
      const isValid = SafetyService.verifyTripOtp(bookingId, metadata.otp.trim());
      if (!isValid) {
        throw new Error('Invalid passenger OTP. Please enter the correct 4-digit OTP shown on the passenger screen.');
      }
    }

    // 3. Cancellation Fee Logic
    let cancellationFee = 0.0;
    if (newStatus === 'CANCELLED_BY_PASSENGER') {
      const category = get<VehicleCategory>('SELECT * FROM vehicle_categories WHERE id = ?', [booking.vehicle_category_id]);
      if (booking.status === 'DRIVER_ARRIVED' || booking.status === 'DRIVER_EN_ROUTE') {
        cancellationFee = category?.cancellation_fee || 30.0;
      }
    }

    // 4. Driver Acceptance & State Changes
    if (newStatus === 'DRIVER_ACCEPTED') {
      let authoritativeDriverId = booking.driver_id;
      if (!authoritativeDriverId && actor.role === 'DRIVER') {
        const actorProfile = get<DriverProfile>('SELECT id, availability_status FROM driver_profiles WHERE user_id = ?', [actor.id]);
        if (!actorProfile) throw new Error('Driver profile not found.');
        if (actorProfile.availability_status === 'ON_TRIP') {
          throw new Error('Driver is currently on another active trip.');
        }
        authoritativeDriverId = actorProfile.id;
      }

      run(
        `UPDATE bookings SET driver_id = ?, status = ?, accepted_at = COALESCE(accepted_at, ?) WHERE id = ?`,
        [authoritativeDriverId, newStatus, now, bookingId]
      );
      if (authoritativeDriverId) {
        run(`UPDATE driver_profiles SET availability_status = 'ON_TRIP' WHERE id = ?`, [authoritativeDriverId]);
      }
    } else if (newStatus === 'DRIVER_ARRIVED') {
      run(`UPDATE bookings SET status = ?, arrived_at = ? WHERE id = ?`, [newStatus, now, bookingId]);
    } else if (newStatus === 'TRIP_STARTED') {
      run(`UPDATE bookings SET status = ?, started_at = ? WHERE id = ?`, [newStatus, now, bookingId]);
    } else if (newStatus === 'COMPLETED') {
      // Authoritative final fare calculation based on real distance & duration
      const actualDistance = metadata.finalDistanceKm || booking.distance_km || 4.5;
      const actualDuration = metadata.finalDurationMin || booking.duration_min || 15;

      let finalFare = booking.fare_estimate;
      try {
        const quote = FareEngine.calculateFare({
          vehicleCategoryId: booking.vehicle_category_id,
          distanceKm: actualDistance,
          durationMin: actualDuration,
          pickupLat: booking.pickup_lat,
          pickupLng: booking.pickup_lng,
          driverId: booking.driver_id || undefined
        });
        finalFare = quote.total_fare;
      } catch (err) {
        finalFare = booking.fare_estimate;
      }

      run(
        `UPDATE bookings SET status = ?, completed_at = ?, distance_km = ?, duration_min = ?, final_fare = ?, payment_status = 'COMPLETED' WHERE id = ?`,
        [newStatus, now, actualDistance, actualDuration, finalFare, bookingId]
      );

      if (booking.driver_id) {
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
