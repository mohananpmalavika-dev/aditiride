import { get, query, run } from '../db/index.js';
import { DriverProfile } from '../types/index.js';

export type KYCStatus = 'REGISTERED' | 'DOCUMENTS_PENDING' | 'DOCUMENT_REVIEW' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';

export interface DriverDocument {
  id: string;
  driverId: string;
  documentType: 'DRIVING_LICENSE' | 'VEHICLE_RC' | 'INSURANCE' | 'POLICE_CLEARANCE' | 'PERMIT';
  documentNumber: string;
  documentUrl: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
  expiryDate?: string;
  verifiedBy?: string;
}

export class DriverKYCService {
  /**
   * Set driver KYC verification status with audit trail
   */
  public static updateVerificationStatus(
    driverId: string,
    newStatus: KYCStatus,
    adminUserId: string,
    reason?: string
  ): { driver: DriverProfile } {
    const driver = get<DriverProfile>('SELECT * FROM driver_profiles WHERE id = ?', [driverId]);
    if (!driver) {
      throw new Error(`Driver profile ${driverId} not found`);
    }

    // If driver is suspended/rejected, force availability status to OFFLINE
    const availabilityStatus = newStatus === 'VERIFIED' ? driver.availability_status : 'OFFLINE';

    run(
      `UPDATE driver_profiles 
       SET verification_status = ?, availability_status = ?
       WHERE id = ?`,
      [newStatus, availabilityStatus, driverId]
    );

    // Audit log entry
    run(
      `INSERT INTO audit_logs (id, actor_user_id, actor_role, action, entity_type, entity_id, new_values, reason_code, ip_address, user_agent)
       VALUES (?, ?, 'ADMIN', 'DRIVER_KYC_STATUS_UPDATE', 'DRIVER_PROFILE', ?, ?, ?, '127.0.0.1', 'AditiRide-Admin-Console')`,
      [
        `audit_${Date.now()}`,
        adminUserId,
        driverId,
        JSON.stringify({ previousStatus: driver.verification_status, newStatus, reason }),
        reason || 'Admin KYC verification review'
      ]
    );

    const updated = get<DriverProfile>('SELECT * FROM driver_profiles WHERE id = ?', [driverId]);
    return { driver: updated! };
  }

  /**
   * Ensure driver is legally verified before toggling ONLINE
   */
  public static assertCanGoOnline(driverId: string): void {
    const driver = get<DriverProfile>('SELECT * FROM driver_profiles WHERE id = ?', [driverId]);
    if (!driver) {
      throw new Error(`Driver ${driverId} not found`);
    }

    if (driver.verification_status !== 'VERIFIED') {
      throw new Error(
        `Cannot go ONLINE: Driver status is '${driver.verification_status}'. Complete KYC documentation and await admin verification.`
      );
    }
  }
}
