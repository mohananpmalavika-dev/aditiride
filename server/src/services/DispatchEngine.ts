import { v4 as uuidv4 } from 'uuid';
import { get, query, run, transaction } from '../db/index.js';
import { MatchingEngine, MatchedDriver } from './MatchingEngine.js';
import { Booking, DriverProfile } from '../types/index.js';

export interface DispatchOffer {
  offerId: string;
  bookingId: string;
  driverId: string;
  driverUserId: string;
  driverName: string;
  radiusKm: number;
  stage: 'FAVORITE_DIRECT' | 'NEARBY_EXPANDING' | 'FALLBACK';
  expiresAt: string;
}

export class DispatchEngine {
  public static readonly LEASE_DURATION_SECONDS = 20;

  /**
   * Record an immutable state transition event in booking_state_events
   */
  public static recordStateEvent(
    bookingId: string,
    previousState: string,
    newState: string,
    actorId: string,
    actorRole: string,
    reason?: string,
    metadata?: any
  ): void {
    const eventId = `bse_${uuidv4().substring(0, 8)}`;
    run(
      `INSERT INTO booking_state_events (
        id, booking_id, previous_state, new_state, actor_id, actor_role, reason, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        bookingId,
        previousState,
        newState,
        actorId,
        actorRole,
        reason || 'State transition',
        metadata ? JSON.stringify(metadata) : null
      ]
    );
  }

  /**
   * Attempt atomic driver availability lease reservation.
   * Ensures two bookings cannot lease the same driver simultaneously.
   */
  public static acquireDriverLease(
    driverId: string,
    bookingId: string,
    leaseDurationSec: number = DispatchEngine.LEASE_DURATION_SECONDS
  ): boolean {
    return transaction(() => {
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + leaseDurationSec * 1000).toISOString();

      // Check if driver is currently leased or active on trip
      const existingLease = get<{ driver_id: string; lease_expires_at: string; status: string }>(
        `SELECT * FROM driver_leases WHERE driver_id = ? AND status = 'OFFERED' AND lease_expires_at > ?`,
        [driverId, now]
      );

      if (existingLease) {
        return false; // Driver already in active offer lease
      }

      const driverProfile = get<DriverProfile>(
        `SELECT * FROM driver_profiles WHERE id = ? AND availability_status = 'ONLINE' AND verification_status = 'VERIFIED'`,
        [driverId]
      );

      if (!driverProfile) {
        return false;
      }

      // Atomically upsert lease
      run(
        `INSERT INTO driver_leases (driver_id, booking_id, status, lease_expires_at)
         VALUES (?, ?, 'OFFERED', ?)
         ON CONFLICT(driver_id) DO UPDATE SET booking_id = ?, status = 'OFFERED', lease_expires_at = ?`,
        [driverId, bookingId, expiresAt, bookingId, expiresAt]
      );

      return true;
    });
  }

  /**
   * Release driver lease (e.g. on offer decline or timeout)
   */
  public static releaseDriverLease(driverId: string): void {
    run(`DELETE FROM driver_leases WHERE driver_id = ?`, [driverId]);
  }

  /**
   * Execute dispatch matching pipeline with expanding search rings and favorite-first priority
   */
  public static dispatchBooking(
    passengerUserId: string,
    bookingId: string,
    pickupLat: number,
    pickupLng: number,
    vehicleCategoryId: string,
    preferredDriverId?: string
  ): { candidateDriver: MatchedDriver | null; dispatchStage: string; offerExpiresAt: string | null } {
    // 1. Direct Favorite Driver Request Stage
    if (preferredDriverId) {
      const isLeased = this.acquireDriverLease(preferredDriverId, bookingId, 25);
      if (isLeased) {
        const candidate = MatchingEngine.findNearbyDrivers(
          passengerUserId,
          pickupLat,
          pickupLng,
          vehicleCategoryId,
          15.0,
          preferredDriverId
        ).find(d => d.driverId === preferredDriverId);

        if (candidate) {
          const expiresAt = new Date(Date.now() + 25 * 1000).toISOString();
          this.recordStateEvent(
            bookingId,
            'CREATED',
            'OFFERED',
            passengerUserId,
            'PASSENGER',
            'Favorite driver direct offer sent',
            { driverId: preferredDriverId, stage: 'FAVORITE_DIRECT' }
          );
          return { candidateDriver: candidate, dispatchStage: 'FAVORITE_DIRECT', offerExpiresAt: expiresAt };
        }
      }
    }

    // 2. Expanding Search Rings: Ring 1 (0–3 km), Ring 2 (3–6 km), Ring 3 (6–10 km)
    const searchRings = [3.0, 6.0, 10.0];

    for (const radius of searchRings) {
      const candidates = MatchingEngine.findNearbyDrivers(
        passengerUserId,
        pickupLat,
        pickupLng,
        vehicleCategoryId,
        radius
      );

      for (const cand of candidates) {
        const isLeased = this.acquireDriverLease(cand.driverId, bookingId, this.LEASE_DURATION_SECONDS);
        if (isLeased) {
          const expiresAt = new Date(Date.now() + this.LEASE_DURATION_SECONDS * 1000).toISOString();
          this.recordStateEvent(
            bookingId,
            'SEARCHING',
            'OFFERED',
            passengerUserId,
            'PASSENGER',
            `Candidate offered at radius ring ${radius}km`,
            { driverId: cand.driverId, radiusKm: radius }
          );
          return { candidateDriver: cand, dispatchStage: `RING_${radius}KM`, offerExpiresAt: expiresAt };
        }
      }
    }

    return { candidateDriver: null, dispatchStage: 'NO_CANDIDATES_AVAILABLE', offerExpiresAt: null };
  }
}
