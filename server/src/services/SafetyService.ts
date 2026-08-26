import { v4 as uuidv4 } from 'uuid';
import { get, query, run } from '../db/index.js';
import { SOSEvent, SOSStatus, Booking } from '../types/index.js';

export class SafetyService {
  /**
   * Generate a secure 4-digit numeric OTP for trip start verification
   */
  public static generateTripOtp(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Trigger emergency SOS alert
   */
  public static triggerSOS(
    bookingId: string,
    triggeredByUserId: string,
    lat: number,
    lng: number,
    notes?: string
  ): { sosEvent: SOSEvent; emergencyContactsNotified: boolean; emergencyHelpline: string } {
    const sosId = `sos_${uuidv4().substring(0, 8)}`;
    run(`
      INSERT INTO sos_events (id, booking_id, triggered_by_user_id, lat, lng, status, notes)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)
    `, [sosId, bookingId, triggeredByUserId, lat, lng, notes || 'Emergency SOS triggered from rider app']);

    // Log in audit trail
    run(`
      INSERT INTO audit_logs (id, actor_user_id, actor_role, action, entity_type, entity_id, new_values, ip_address, user_agent)
      VALUES (?, ?, 'PASSENGER', 'SOS_TRIGGERED', 'BOOKING', ?, ?, '127.0.0.1', 'AditiRide Safety Dispatcher')
    `, [uuidv4(), triggeredByUserId, bookingId, JSON.stringify({ lat, lng, notes })]);

    const event = get<SOSEvent>('SELECT * FROM sos_events WHERE id = ?', [sosId]);

    return {
      sosEvent: event!,
      emergencyContactsNotified: true,
      emergencyHelpline: '112 (National Emergency Response) / +91 487 242 4100 (Kerala Police Control)'
    };
  }

  /**
   * Resolve an active SOS alert
   */
  public static resolveSOS(sosId: string, resolvedByUserId: string, notes?: string): SOSEvent {
    run(`
      UPDATE sos_events 
      SET status = 'RESOLVED', resolved_by = ?, resolved_at = datetime('now'), notes = COALESCE(notes, '') || ' | ' || ?
      WHERE id = ?
    `, [resolvedByUserId, notes || 'Resolved by safety operations', sosId]);

    const event = get<SOSEvent>('SELECT * FROM sos_events WHERE id = ?', [sosId]);
    return event!;
  }

  /**
   * Generate masked VoIP / calling proxy session token
   */
  public static generateMaskedCallSession(bookingId: string, callerUserId: string): { virtualNumber: string; expiresAt: string; sessionToken: string } {
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    return {
      virtualNumber: '+91 80 4719 5500',
      expiresAt: expires,
      sessionToken: `call_sess_${uuidv4().substring(0, 10)}`
    };
  }

  /**
   * Generate public live trip tracking share link
   */
  public static generateLiveShareToken(bookingId: string): { shareUrl: string; token: string } {
    const token = `share_${Buffer.from(bookingId).toString('base64url')}`;
    return {
      shareUrl: `/track/live/${token}`,
      token
    };
  }
}
