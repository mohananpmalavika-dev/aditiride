import { get, query, run } from '../db/index.js';
import { DispatchEngine } from './DispatchEngine.js';
import { LocationService } from './LocationService.js';
import { FareEngine } from './FareEngine.js';
import { SafetyService } from './SafetyService.js';
import { ReconciliationService } from './ReconciliationService.js';
import { RedisClient } from './redis/RedisClient.js';
import { v4 as uuidv4 } from 'uuid';

export class SchedulerWorker {
  private static timer: NodeJS.Timeout | null = null;
  private static tickCounter = 0;

  /**
   * Start the scheduler background process (polling every 30 seconds) with distributed leader locking
   */
  public static start(io?: any): void {
    if (this.timer) return;

    this.timer = setInterval(async () => {
      try {
        // Distributed Lock: Only one worker instance executes this cycle across the cluster
        const hasLock = await RedisClient.acquireWorkerLock('scheduler_tick', 25);
        if (!hasLock) {
          return; // Another worker replica is actively processing this interval
        }

        await this.processDueScheduledBookings(io);

        // Run automated reconciliation every 10 ticks (5 minutes)
        this.tickCounter++;
        if (this.tickCounter % 10 === 0) {
          const report = ReconciliationService.runFinancialReconciliation();
          if (!report.healthy) {
            console.warn('[Reconciliation Alert] Financial discrepancy detected in automated run:', report);
          }
        }
      } catch (err) {
        console.error('[SchedulerWorker] Error processing scheduled rides:', err);
      }
    }, 30000);

    console.log('⏰ [SchedulerWorker] Background distributed dispatch worker started.');
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
          destLat: sched.destination_lat,
          destLng: sched.destination_lng
        });

        const liveBookingId = `bk_${uuidv4().substring(0, 8)}`;
        const bookingNumber = `ADITI-${Date.now().toString().slice(-6)}`;
        const otpCode = SafetyService.generateTripOtp();

        // Dispatch via DispatchEngine
        const dispatchResult = DispatchEngine.dispatchBooking(
          sched.passenger_id,
          liveBookingId,
          sched.pickup_lat,
          sched.pickup_lng,
          sched.vehicle_category_id,
          sched.preferred_driver_id
        );

        const assignedDriverId = dispatchResult.candidateDriver?.driverId || null;
        const initialStatus = assignedDriverId ? 'DRIVER_ASSIGNED' : 'SEARCHING';

        run(`
          INSERT INTO bookings (
            id, booking_number, passenger_id, driver_id, vehicle_category_id, booking_type,
            pickup_lat, pickup_lng, pickup_address, destination_lat, destination_lng, destination_address,
            scheduled_at, distance_km, duration_min, otp_code, fare_estimate, fare_source,
            fare_rule_version, surge_multiplier, payment_method, payment_status, status
          ) VALUES (
            ?, ?, ?, ?, ?, 'SCHEDULED',
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, 'PENDING', ?
          )
        `, [
          liveBookingId, bookingNumber, sched.passenger_id, assignedDriverId, sched.vehicle_category_id,
          sched.pickup_lat, sched.pickup_lng, sched.pickup_address, sched.destination_lat, sched.destination_lng, sched.destination_address,
          sched.scheduled_time, route.distanceKm, route.durationMin, otpCode, quote.total_fare, quote.fare_source,
          quote.fare_rule_version, quote.surge_multiplier, sched.payment_method || 'UPI', initialStatus
        ]);

        // Register OTP in safety verifications
        SafetyService.registerTripOtp(liveBookingId, otpCode);

        // Update scheduled booking to DISPATCHED
        run(`UPDATE scheduled_bookings SET status = 'DISPATCHED' WHERE id = ?`, [sched.id]);

        dispatchedCount++;

        // Notify client via Socket.IO
        if (io) {
          io.to(`user_${sched.passenger_id}`).emit('scheduled_ride_dispatched', {
            scheduledBookingId: sched.id,
            bookingId: liveBookingId,
            bookingNumber,
            status: initialStatus
          });
        }
      } catch (err: any) {
        console.error(`[SchedulerWorker] Failed to dispatch scheduled booking ${sched.id}:`, err.message);
      }
    }

    return dispatchedCount;
  }
}
