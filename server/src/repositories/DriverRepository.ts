import { get, query, run } from '../db/index.js';
import { getPgPool, queryPg, getPg, runPg } from '../db/connection.js';
import { PostgresSpatialHelper } from '../db/postgres.js';
import { DriverProfile, Vehicle } from '../types/index.js';

export interface CandidateDriverRow {
  driver_id: string;
  user_id: string;
  driver_name: string;
  driver_phone: string;
  driver_avatar?: string;
  rating_avg: number;
  acceptance_rate: number;
  cancellation_rate: number;
  total_trips: number;
  accepts_favorite_requests: boolean;
  current_lat: number;
  current_lng: number;
  heading: number;
  vehicle_id: string;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_color: string;
  vehicle_plate: string;
  vehicle_category_id: string;
  distance_km?: number;
}

export class DriverRepository {
  public static async findById(id: string): Promise<DriverProfile | undefined> {
    if (getPgPool()) {
      return getPg<DriverProfile>('SELECT * FROM driver_profiles WHERE id = $1', [id]);
    }
    return get<DriverProfile>('SELECT * FROM driver_profiles WHERE id = ?', [id]);
  }

  public static async findByUserId(userId: string): Promise<DriverProfile | undefined> {
    if (getPgPool()) {
      return getPg<DriverProfile>('SELECT * FROM driver_profiles WHERE user_id = $1', [userId]);
    }
    return get<DriverProfile>('SELECT * FROM driver_profiles WHERE user_id = ?', [userId]);
  }

  /**
   * PostGIS-driven nearby driver spatial discovery using ST_DWithin and GiST indexing
   */
  public static async findNearbySpatial(
    lat: number,
    lng: number,
    radiusMeters: number,
    categoryId: string
  ): Promise<CandidateDriverRow[]> {
    if (getPgPool()) {
      const spatial = PostgresSpatialHelper.buildNearbyDriversQuery(lat, lng, radiusMeters, categoryId);
      return queryPg<CandidateDriverRow>(spatial.sql, spatial.values);
    }

    // Local / Test query fallback
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
    return query<CandidateDriverRow>(sql, [categoryId]);
  }

  public static async updateLocation(
    driverId: string,
    lat: number,
    lng: number,
    heading: number = 0
  ): Promise<void> {
    if (getPgPool()) {
      await runPg(
        `UPDATE driver_profiles 
         SET current_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
             current_lat = $2,
             current_lng = $1,
             heading = $3,
             last_location_update = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [lng, lat, heading, driverId]
      );
      return;
    }

    run(
      `UPDATE driver_profiles 
       SET current_lat = ?, current_lng = ?, heading = ?, last_location_update = datetime('now')
       WHERE id = ?`,
      [lat, lng, heading, driverId]
    );
  }
}
