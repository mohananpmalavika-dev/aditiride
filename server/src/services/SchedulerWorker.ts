import { get, query, run } from '../db/index.js';
import { DispatchEngine } from './DispatchEngine.js';
import { LocationService } from './LocationService.js';
import { FareEngine } from './FareEngine.js';
import { SafetyService } from './SafetyService.js';
import { v4 as uuidv4 } from 'uuid';

export class SchedulerWorker {
  private static timer: NodeJS.Timeout | null = null;

  /**
   * Start the scheduler background process (polling every 30 seconds)
   */
  public static start(io?: any): void {
    if (this.timer) return;

    this.timer = setInterval(async () => {
      try {
        await this.processDueScheduledBookings(io);
      } catch (err) {
        console.error('[SchedulerWorker] Error processing scheduled rides:', err);
      }
    }, 30000);

    console.log('⏰ [SchedulerWorker] Background dispatch worker started.');
  }

  /**
   * Stop the scheduler worker
   */
  public static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Process all scheduled rides that are due within the next 15 minutes
   */
  public static async processDueScheduledBookings(io?: any): Promise<number> {
    const windowEnd = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const dueRides = query<any>(
      `SELECT * FROM scheduled_bookings 
       WHERE status = 'PENDING' AND scheduled_time <= ?`,
      [windowEnd]
    );

    let dispatchedCount = 0;

    for (const sched of dueRides) {
      try {
        const route = await LocationService.calculateRoute(
          { lat: sched.pickup_lat, lng: sched.pickup_lng },
          { lat: sched.destination_lat, lng: sched.destination_lng }
        );

        const quote = FareEngine.calculateFare({
          vehicleCategoryId: sched.vehicle_category_id,
          distanceKm: route.distanceKm,
          durationMin: route.durationMin,
          pickupLat: sched.pickup_lat,
          pickupLng: sched.pickup_lng,
          driverId: sched.specific_driver_id
        });

        const bookingId = `bk_sched_${uuidv4().substring(0, 8)}`;
        const bookingNumber = `SCHED-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const otpCode = SafetyService.generateTripOtp();

        // Use DispatchEngine for atomic driver reservation and expanding search
        const dispatchResult = DispatchEngine.dispatchBooking(
          sched.passenger_id,
          bookingId,
          sched.pickup_lat,
          sched.pickup_lng,
          sched.vehicle_category_id,
          sched.specific_driver_id
        );

        const assignedDriverId = dispatchResult.candidateDriver?.driverId || null;
        const initialStatus = assignedDriverId ? 'DRIVER_ASSIGNED' : 'SEARCHING';

        run(
          `INSERT INTO bookings (
            id, booking_number, passenger_id, driver_id, vehicle_category_id, booking_type,
            pickup_lat, pickup_lng, pickup_address, destination_lat, destination_lng, destination_address,
            scheduled_at, distance_km, duration_min, otp_code, fare_estimate, fare_source,
            fare_rule_version, surge_multiplier, payment_method, payment_status, status
          ) VALUES (
            ?, ?, ?, ?, ?, 'SCHEDULED',
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, 'UPI', 'PENDING', ?
          )`,
          [
            bookingId, bookingNumber, sched.passenger_id, assignedDriverId, sched.vehicle_category_id,
            sched.pickup_lat, sched.pickup_lng, sched.pickup_address, sched.destination_lat, sched.destination_lng, sched.destination_address,
            sched.scheduled_time, route.distanceKm, route.durationMin, otpCode, quote.total_fare, quote.fare_source,
            quote.fare_rule_version, quote.surge_multiplier, initialStatus
          ]
        );

        run(`UPDATE scheduled_bookings SET status = 'DISPATCHED' WHERE id = ?`, [sched.id]);

        if (io && dispatchResult.candidateDriver) {
          const offerPayload = {
            bookingId,
            bookingNumber,
            driverId: dispatchResult.candidateDriver.driverId,
            passengerId: sched.passenger_id,
            pickupAddress: sched.pickup_address,
            destinationAddress: sched.destination_address,
            fareEstimate: quote.total_fare,
            isScheduled: true
          };
          io.to(`user_${dispatchResult.candidateDriver.userId}`).emit('incoming_ride_offer', offerPayload);
        }

        dispatchedCount++;
      } catch (err) {
        console.error(`[SchedulerWorker] Failed to dispatch scheduled ride ${sched.id}:`, err);
      }
    }

    return dispatchedCount;
  }
}
