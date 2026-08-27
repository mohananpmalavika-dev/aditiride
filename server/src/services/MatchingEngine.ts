import { query, get } from '../db/index.js';
import { getPgPool, queryPg } from '../db/connection.js';
import { PostgresSpatialHelper } from '../db/postgres.js';
import { DriverProfile, Vehicle, User, FavoriteRelationship, UserBlock } from '../types/index.js';
import { LocationService } from './LocationService.js';

export interface MatchedDriver {
  driverId: string;
  userId: string;
  name: string;
  phone: string;
  avatarUrl?: string;
  ratingAvg: number;
  acceptanceRate: number;
  cancellationRate: number;
  totalTrips: number;
  currentLat: number;
  currentLng: number;
  heading: number;
  distanceToPickupKm: number;
  estimatedEtaMin: number;
  vehicleId: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
  vehicleColor: string;
  vehicleCategoryId: string;
  isFavorite: boolean;
  score: number;
}

export class MatchingEngine {
  /**
   * Find and rank candidate drivers for a ride request
   */
  public static findNearbyDrivers(
    passengerUserId: string,
    pickupLat: number,
    pickupLng: number,
    vehicleCategoryId: string,
    searchRadiusKm: number = 8.0,
    preferredDriverId?: string
  ): MatchedDriver[] {
    // 1. Fetch Two-Way Block List (Pass -> Driver OR Driver -> Pass)
    const blocks = query<UserBlock>(
      `SELECT * FROM user_blocks 
       WHERE status = 'ACTIVE' AND (blocker_user_id = ? OR blocked_user_id = ?)`,
      [passengerUserId, passengerUserId]
    );

    const blockedUserIds = new Set<string>();
    for (const b of blocks) {
      if (b.blocker_user_id === passengerUserId) blockedUserIds.add(b.blocked_user_id);
      if (b.blocked_user_id === passengerUserId) blockedUserIds.add(b.blocker_user_id);
    }

    // 2. Fetch Passenger's Favorite Drivers
    const favs = query<{ driver_id: string }>(
      `SELECT driver_id FROM favorites WHERE passenger_id = ? AND status = 'ACTIVE'`,
      [passengerUserId]
    );
    const favoriteDriverIds = new Set<string>(favs.map(f => f.driver_id));

    // 3. Query all ONLINE, VERIFIED drivers with matching vehicle category
    const sql = `
      SELECT 
        d.id as driver_id,
        d.user_id,
        d.current_lat,
        d.current_lng,
        d.heading,
        d.rating_avg,
        d.acceptance_rate,
        d.cancellation_rate,
        d.total_trips,
        d.accepts_favorite_requests,
        u.name as driver_name,
        u.phone as driver_phone,
        u.avatar_url as driver_avatar,
        v.id as vehicle_id,
        v.brand as vehicle_brand,
        v.model as vehicle_model,
        v.color as vehicle_color,
        v.plate_number as vehicle_plate,
        v.vehicle_category_id
      FROM driver_profiles d
      JOIN users u ON d.user_id = u.id
      JOIN vehicles v ON v.driver_id = d.id
      WHERE d.availability_status = 'ONLINE'
        AND d.verification_status = 'VERIFIED'
        AND v.vehicle_category_id = ?
        AND v.status = 'ACTIVE'
        AND u.status = 'ACTIVE'
    `;

    const candidates = query<any>(sql, [vehicleCategoryId]);
    const matched: MatchedDriver[] = [];

    for (const cand of candidates) {
      // Exclude two-way blocked users
      if (blockedUserIds.has(cand.user_id)) {
        continue;
      }

      // Check distance to pickup
      const dist = LocationService.haversine(pickupLat, pickupLng, cand.current_lat, cand.current_lng);
      if (dist > searchRadiusKm) {
        continue;
      }

      const isFav = favoriteDriverIds.has(cand.driver_id);
      const etaMin = Math.max(2, Math.round((dist / 30) * 60)); // ETA at ~30km/h

      // Compute composite ranking score S(d)
      // S = 0.40*(1 - dist/R) + 0.25*(rating/5) + 0.15*acceptance - 0.10*cancellation + 0.10*favorite + bonus for specific
      const normalizedDist = Math.max(0, 1 - (dist / searchRadiusKm));
      const normalizedRating = (cand.rating_avg || 4.5) / 5.0;
      const acceptance = cand.acceptance_rate || 0.9;
      const cancellation = cand.cancellation_rate || 0.05;
      const favBonus = isFav ? 0.10 : 0.0;
      const preferredBonus = (preferredDriverId && cand.driver_id === preferredDriverId) ? 1.0 : 0.0;

      const score =
        (0.40 * normalizedDist) +
        (0.25 * normalizedRating) +
        (0.15 * acceptance) -
        (0.10 * cancellation) +
        favBonus +
        preferredBonus;

      matched.push({
        driverId: cand.driver_id,
        userId: cand.user_id,
        name: cand.driver_name,
        phone: cand.driver_phone,
        avatarUrl: cand.driver_avatar,
        ratingAvg: cand.rating_avg,
        acceptanceRate: cand.acceptance_rate,
        cancellationRate: cand.cancellation_rate,
        totalTrips: cand.total_trips,
        currentLat: cand.current_lat,
        currentLng: cand.current_lng,
        heading: cand.heading,
        distanceToPickupKm: Math.round(dist * 10) / 10,
        estimatedEtaMin: etaMin,
        vehicleId: cand.vehicle_id,
        vehicleBrand: cand.vehicle_brand,
        vehicleModel: cand.vehicle_model,
        vehiclePlate: cand.vehicle_plate,
        vehicleColor: cand.vehicle_color,
        vehicleCategoryId: cand.vehicle_category_id,
        isFavorite: isFav,
        score: Math.round(score * 100) / 100
      });
    }

    // Sort descending by composite score
    matched.sort((a, b) => b.score - a.score);
    return matched;
  }

  /**
   * Check if passenger and driver have an active block between them
   */
  public static isBlocked(userAId: string, userBId: string): boolean {
    const block = get(
      `SELECT id FROM user_blocks 
       WHERE status = 'ACTIVE' 
         AND ((blocker_user_id = ? AND blocked_user_id = ?) 
           OR (blocker_user_id = ? AND blocked_user_id = ?))`,
      [userAId, userBId, userBId, userAId]
    );
    return !!block;
  }
}
