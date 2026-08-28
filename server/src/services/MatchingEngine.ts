import { query, get } from '../db/index.js';
import { getPgPool, queryPg } from '../db/connection.js';
import { PostgresSpatialHelper } from '../db/postgres.js';
import { DriverProfile, Vehicle, User, FavoriteRelationship, UserBlock } from '../types/index.js';
import { LocationService } from './LocationService.js';
import { FareEngine } from './FareEngine.js';

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
  // Personalized Pickup & Route Pricing
  freePickupKm: number;
  pickupChargePerKm: number;
  extraPickupKm: number;
  pickupDistanceCharge: number;
  tripFare: number;
  driverTotalFare: number;
}

export class MatchingEngine {
  /**
   * Find and rank candidate drivers (up to 10) with individualized fare calculations
   */
  public static findNearbyDrivers(
    passengerUserId: string,
    pickupLat: number,
    pickupLng: number,
    vehicleCategoryId: string,
    searchRadiusKm: number = 8.0,
    preferredDriverId?: string,
    routeDistanceKm: number = 5.0,
    routeDurationMin: number = 15
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
    const favoriteDriverIds = new Set<string>(favs.map((f) => f.driver_id));

    // 3. Candidate discovery (Local in-memory SQLite runtime vs PostgreSQL)
    const candidates = query<any>(
      `SELECT 
         d.id as driver_id, d.user_id, d.current_lat, d.current_lng, d.heading,
         d.rating_avg, d.acceptance_rate, d.cancellation_rate, d.total_trips, d.accepts_favorite_requests,
         d.free_pickup_km, d.pickup_charge_per_km,
         u.name as driver_name, u.phone as driver_phone, u.avatar_url as driver_avatar,
         v.id as vehicle_id, v.brand as vehicle_brand, v.model as vehicle_model,
         v.color as vehicle_color, v.plate_number as vehicle_plate, v.vehicle_category_id
       FROM driver_profiles d
       JOIN users u ON d.user_id = u.id
       JOIN vehicles v ON v.driver_id = d.id
       WHERE d.availability_status = 'ONLINE'
         AND d.verification_status = 'VERIFIED'
         AND v.vehicle_category_id = ?
         AND v.status = 'ACTIVE'
         AND u.status = 'ACTIVE'`,
      [vehicleCategoryId]
    );

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

      // Calculate Driver-Specific Pricing with Pickup Distance Surcharge
      const freePickupKm = cand.free_pickup_km !== undefined && cand.free_pickup_km !== null ? Number(cand.free_pickup_km) : 2.0;
      const pickupChargePerKm = cand.pickup_charge_per_km !== undefined && cand.pickup_charge_per_km !== null ? Number(cand.pickup_charge_per_km) : 10.0;
      const extraPickupKm = Math.max(0, Math.round((dist - freePickupKm) * 10) / 10);
      const pickupDistanceCharge = Math.round(extraPickupKm * pickupChargePerKm * 100) / 100;

      let driverTotalFare = 100;
      let tripFare = 100;
      try {
        const quote = FareEngine.calculateFare({
          vehicleCategoryId,
          distanceKm: routeDistanceKm,
          durationMin: routeDurationMin,
          pickupLat,
          pickupLng,
          driverId: cand.driver_id,
          driverDistanceToPickupKm: dist
        });
        driverTotalFare = quote.total_fare;
        tripFare = quote.total_fare - (quote.pickup_distance_charge || 0);
      } catch {
        // Fallback default if category not configured
      }

      // Compute composite ranking score S(d)
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
        ratingAvg: cand.rating_avg || 5.0,
        acceptanceRate: cand.acceptance_rate || 100.0,
        cancellationRate: cand.cancellation_rate || 0.0,
        totalTrips: cand.total_trips || 0,
        currentLat: cand.current_lat,
        currentLng: cand.current_lng,
        heading: cand.heading || 0,
        distanceToPickupKm: Math.round(dist * 10) / 10,
        estimatedEtaMin: etaMin,
        vehicleId: cand.vehicle_id,
        vehicleBrand: cand.vehicle_brand,
        vehicleModel: cand.vehicle_model,
        vehiclePlate: cand.vehicle_plate,
        vehicleColor: cand.vehicle_color,
        vehicleCategoryId: cand.vehicle_category_id,
        isFavorite: isFav,
        score: Math.round(score * 100) / 100,
        freePickupKm,
        pickupChargePerKm,
        extraPickupKm,
        pickupDistanceCharge,
        tripFare,
        driverTotalFare
      });
    }

    // Sort descending by score and limit to top 10 candidate drivers
    matched.sort((a, b) => b.score - a.score);

    return matched.slice(0, 10);
  }

  /**
   * Production PostgreSQL + PostGIS Spatial Matching Execution
   * Uses native ST_DWithin geography spatial indices with connection pooling
   */
  public static async findNearbyDriversPg(
    passengerUserId: string,
    pickupLat: number,
    pickupLng: number,
    vehicleCategoryId: string,
    searchRadiusKm: number = 8.0,
    preferredDriverId?: string,
    routeDistanceKm: number = 5.0,
    routeDurationMin: number = 15
  ): Promise<MatchedDriver[]> {
    const pgPool = getPgPool();
    if (!pgPool) {
      return this.findNearbyDrivers(
        passengerUserId,
        pickupLat,
        pickupLng,
        vehicleCategoryId,
        searchRadiusKm,
        preferredDriverId,
        routeDistanceKm,
        routeDurationMin
      );
    }

    // 1. PostGIS ST_DWithin spatial query execution via queryPg
    const spatial = PostgresSpatialHelper.buildNearbyDriversQuery(
      pickupLat,
      pickupLng,
      searchRadiusKm * 1000,
      vehicleCategoryId
    );

    const candidates = await queryPg<any>(spatial.sql, spatial.values);

    // 2. Fetch Two-Way Block List in PostgreSQL
    const blocks = await queryPg<UserBlock>(
      `SELECT * FROM user_blocks WHERE status = 'ACTIVE' AND (blocker_user_id = $1 OR blocked_user_id = $2)`,
      [passengerUserId, passengerUserId]
    );

    const blockedUserIds = new Set<string>();
    for (const b of blocks) {
      if (b.blocker_user_id === passengerUserId) blockedUserIds.add(b.blocked_user_id);
      if (b.blocked_user_id === passengerUserId) blockedUserIds.add(b.blocker_user_id);
    }

    // 3. Fetch Passenger's Favorite Drivers in PostgreSQL
    const favs = await queryPg<{ driver_id: string }>(
      `SELECT driver_id FROM favorites WHERE passenger_id = $1 AND status = 'ACTIVE'`,
      [passengerUserId]
    );
    const favoriteDriverIds = new Set<string>(favs.map((f) => f.driver_id));

    const matched: MatchedDriver[] = [];

    for (const cand of candidates) {
      if (blockedUserIds.has(cand.user_id)) continue;

      const dist = cand.distance_km || LocationService.haversine(pickupLat, pickupLng, cand.current_lat, cand.current_lng);
      if (dist > searchRadiusKm) continue;

      const isFav = favoriteDriverIds.has(cand.driver_id);
      const etaMin = Math.max(2, Math.round((dist / 30) * 60));

      const ratingWeight = (cand.rating_avg / 5.0) * 40;
      const proximityWeight = Math.max(0, (1 - dist / searchRadiusKm) * 40);
      const acceptanceWeight = ((cand.acceptance_rate || 95) / 100.0) * 10;
      const favoriteBonus = isFav ? 20 : 0;
      const preferredBonus = preferredDriverId && cand.driver_id === preferredDriverId ? 50 : 0;

      const score = ratingWeight + proximityWeight + acceptanceWeight + favoriteBonus + preferredBonus;

      const freePickupKm = Number(cand.free_pickup_km ?? 3.0);
      const pickupChargePerKm = Number(cand.pickup_charge_per_km ?? 10.0);
      const extraPickupKm = dist > freePickupKm ? Math.round((dist - freePickupKm) * 10) / 10 : 0.0;
      const pickupDistanceCharge = Math.round(extraPickupKm * pickupChargePerKm * 100) / 100;

      const personalizedQuote = FareEngine.calculateFare({
        vehicleCategoryId: cand.vehicle_category_id || vehicleCategoryId,
        distanceKm: routeDistanceKm,
        durationMin: routeDurationMin,
        pickupLat,
        pickupLng,
        driverId: cand.driver_id,
        driverDistanceToPickupKm: dist
      });

      const tripFare = personalizedQuote.total_fare;
      const driverTotalFare = tripFare;

      matched.push({
        driverId: cand.driver_id,
        userId: cand.user_id,
        name: cand.driver_name,
        phone: cand.driver_phone || '+919847000000',
        avatarUrl: cand.driver_avatar,
        ratingAvg: Number(cand.rating_avg),
        acceptanceRate: Number(cand.acceptance_rate || 95),
        cancellationRate: Number(cand.cancellation_rate || 2),
        totalTrips: Number(cand.total_trips || 0),
        currentLat: Number(cand.current_lat),
        currentLng: Number(cand.current_lng),
        heading: Number(cand.heading || 0),
        distanceToPickupKm: Math.round(dist * 10) / 10,
        estimatedEtaMin: etaMin,
        vehicleId: cand.vehicle_id || 'veh_default',
        vehicleBrand: cand.vehicle_brand || cand.brand || 'Vehicle',
        vehicleModel: cand.vehicle_model || cand.model || 'Standard',
        vehiclePlate: cand.vehicle_plate || cand.plate_number || 'KL-08',
        vehicleColor: cand.vehicle_color || 'White',
        vehicleCategoryId: cand.vehicle_category_id || vehicleCategoryId,
        isFavorite: isFav,
        score: Math.round(score * 100) / 100,
        freePickupKm,
        pickupChargePerKm,
        extraPickupKm,
        pickupDistanceCharge,
        tripFare,
        driverTotalFare
      });
    }

    matched.sort((a, b) => b.score - a.score);
    return matched.slice(0, 10);
  }
}
