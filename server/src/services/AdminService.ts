import { v4 as uuidv4 } from 'uuid';
import { get, query, run } from '../db/index.js';
import {
  AuditLog,
  DriverDocument,
  DriverProfile,
  DriverVerificationStatus,
  Geofence,
  SOSEvent,
  UserBlock,
  UserRole,
  VehicleCategory
} from '../types/index.js';

export class AdminService {
  /**
   * Fetch high-level operational and financial KPIs
   */
  public static getDashboardMetrics() {
    const totalBookings = get<{ count: number }>('SELECT COUNT(*) as count FROM bookings')?.count || 0;
    const activeTrips = get<{ count: number }>(
      `SELECT COUNT(*) as count FROM bookings 
       WHERE status IN ('DRIVER_ASSIGNED', 'DRIVER_ACCEPTED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'TRIP_STARTED', 'TRIP_IN_PROGRESS')`
    )?.count || 0;
    const completedTrips = get<{ count: number }>('SELECT COUNT(*) as count FROM bookings WHERE status = "COMPLETED"')?.count || 0;
    const onlineDrivers = get<{ count: number }>('SELECT COUNT(*) as count FROM driver_profiles WHERE availability_status = "ONLINE"')?.count || 0;
    const totalDrivers = get<{ count: number }>('SELECT COUNT(*) as count FROM driver_profiles')?.count || 0;
    const totalPassengers = get<{ count: number }>('SELECT COUNT(*) as count FROM users WHERE role = "PASSENGER"')?.count || 0;

    const gmv = get<{ total: number }>('SELECT SUM(gross_fare) as total FROM driver_earnings')?.total || 0;
    const totalCommission = get<{ total: number }>('SELECT SUM(platform_commission) as total FROM driver_earnings')?.total || 0;
    const activeSOS = get<{ count: number }>('SELECT COUNT(*) as count FROM sos_events WHERE status = "ACTIVE"')?.count || 0;
    const pendingDocuments = get<{ count: number }>('SELECT COUNT(*) as count FROM driver_documents WHERE verification_status = "PENDING"')?.count || 0;

    return {
      totalBookings,
      activeTrips,
      completedTrips,
      onlineDrivers,
      totalDrivers,
      totalPassengers,
      grossMerchandiseValue: Math.round(gmv * 100) / 100,
      platformCommission: Math.round(totalCommission * 100) / 100,
      activeSOSAlerts: activeSOS,
      pendingDocumentReviews: pendingDocuments
    };
  }

  /**
   * Log an immutable administrative action with before/after diff
   */
  public static logAuditEvent(
    actorUserId: string,
    actorRole: UserRole,
    action: string,
    entityType: string,
    entityId: string,
    oldValues?: any,
    newValues?: any,
    reasonCode?: string,
    ipAddress: string = '127.0.0.1',
    userAgent: string = 'AditiRide Admin Control Center'
  ) {
    const id = `aud_${uuidv4().substring(0, 8)}`;
    run(`
      INSERT INTO audit_logs (id, actor_user_id, actor_role, action, entity_type, entity_id, old_values, new_values, reason_code, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      actorUserId,
      actorRole,
      action,
      entityType,
      entityId,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      reasonCode || null,
      ipAddress,
      userAgent
    ]);
  }

  /**
   * Review & update driver KYC document verification status
   */
  public static reviewDriverDocument(
    docId: string,
    adminUserId: string,
    status: DriverVerificationStatus,
    rejectionReason?: string
  ) {
    const oldDoc = get<DriverDocument>('SELECT * FROM driver_documents WHERE id = ?', [docId]);
    if (!oldDoc) throw new Error('Document not found');

    run(`
      UPDATE driver_documents 
      SET verification_status = ?, verified_by = ?, verified_at = datetime('now'), rejection_reason = ?
      WHERE id = ?
    `, [status, adminUserId, rejectionReason || null, docId]);

    // If all documents for driver are VERIFIED, verify the driver profile
    const unverifiedDocs = query<DriverDocument>(
      'SELECT * FROM driver_documents WHERE driver_id = ? AND verification_status != "VERIFIED"',
      [oldDoc.driver_id]
    );

    if (unverifiedDocs.length === 0 && status === 'VERIFIED') {
      run(`UPDATE driver_profiles SET verification_status = 'VERIFIED' WHERE id = ?`, [oldDoc.driver_id]);
    } else if (status === 'REJECTED' || status === 'BLOCKED') {
      run(`UPDATE driver_profiles SET verification_status = ? WHERE id = ?`, [status, oldDoc.driver_id]);
    }

    this.logAuditEvent(
      adminUserId,
      'ADMIN',
      `DOCUMENT_${status}`,
      'DRIVER_DOCUMENT',
      docId,
      { oldStatus: oldDoc.verification_status },
      { newStatus: status, rejectionReason },
      'KYC_REVIEW'
    );

    return get<DriverDocument>('SELECT * FROM driver_documents WHERE id = ?', [docId]);
  }

  /**
   * Run fraud and anomaly detection scans
   */
  public static scanFraudAnomalies() {
    const anomalies: any[] = [];

    // 1. Check for drivers with abnormally high cancellation rates (> 15%)
    const highCancelDrivers = query<DriverProfile>(
      `SELECT d.*, u.name as driver_name, u.phone as driver_phone 
       FROM driver_profiles d 
       JOIN users u ON d.user_id = u.id 
       WHERE d.cancellation_rate > 0.15 AND d.total_trips > 5`
    );
    for (const d of highCancelDrivers) {
      anomalies.push({
        id: `anom_cancel_${d.id}`,
        severity: 'HIGH',
        type: 'ABNORMAL_CANCELLATION_SPIKE',
        userId: d.user_id,
        userName: (d as any).driver_name,
        details: `Driver cancellation rate is ${((d.cancellation_rate || 0) * 100).toFixed(1)}% over ${d.total_trips} trips`,
        recommendedAction: 'Inspect recent cancellations and apply temporary timeout if abusive'
      });
    }

    // 2. Check for repeated passenger-driver pair bookings (possible collusion / coupon abuse)
    const repeatedPairs = query<{ passenger_id: string; driver_id: string; trip_count: number }>(
      `SELECT passenger_id, driver_id, COUNT(*) as trip_count 
       FROM bookings 
       WHERE status = 'COMPLETED' AND driver_id IS NOT NULL 
       GROUP BY passenger_id, driver_id 
       HAVING trip_count >= 5`
    );
    for (const p of repeatedPairs) {
      anomalies.push({
        id: `anom_collude_${p.passenger_id}_${p.driver_id}`,
        severity: 'HIGH',
        type: 'COLLUSION_OR_FREQUENT_PAIR',
        userId: p.passenger_id,
        details: `Passenger completed ${p.trip_count} rides with the exact same captain (${p.driver_id}) within monitored window`,
        recommendedAction: 'Inspect rides for zero-distance completions or promo/referral incentive laundering'
      });
    }

    // 3. Rapid Cancellation Abuse & Dispatch Manipulation
    const rapidCancels = query<{ passenger_id: string; cancel_count: number }>(
      `SELECT passenger_id, COUNT(*) as cancel_count
       FROM bookings
       WHERE status IN ('CANCELLED_BY_PASSENGER', 'EXPIRED')
       GROUP BY passenger_id
       HAVING cancel_count >= 3`
    );
    for (const rc of rapidCancels) {
      anomalies.push({
        id: `anom_rapid_cancel_${rc.passenger_id}`,
        severity: 'MEDIUM',
        type: 'RAPID_CANCELLATION_MANIPULATION',
        userId: rc.passenger_id,
        details: `Passenger generated ${rc.cancel_count} cancellations/expired searches in short interval`,
        recommendedAction: 'Apply temporary 15-minute dispatch cool-off lock'
      });
    }

    // 4. GPS Teleportation & Impossible Speed Sentinel (>160 km/h)
    const speedAnomalies = query<{ id: string; driver_id: string; distance_km: number; duration_min: number }>(
      `SELECT id, driver_id, distance_km, duration_min
       FROM bookings
       WHERE status = 'COMPLETED' AND duration_min > 0 AND (distance_km / (duration_min / 60.0)) > 160.0`
    );
    for (const sa of speedAnomalies) {
      anomalies.push({
        id: `anom_teleport_${sa.id}`,
        severity: 'CRITICAL',
        type: 'GPS_SPOOF_OR_TELEPORTATION',
        userId: sa.driver_id,
        details: `Trip #${sa.id} completed at calculated speed of ${Math.round(sa.distance_km / (sa.duration_min / 60.0))} km/h (exceeds physics threshold of 160 km/h)`,
        recommendedAction: 'Flag driver profile for immediate mock-location / fake GPS inspection'
      });
    }

    return anomalies;
  }
}
