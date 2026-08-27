import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { get, run, transaction } from '../db/index.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../middleware/auth.js';
import { User } from '../types/index.js';

export interface AuthSessionRecord {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  device_id?: string;
  device_name?: string;
  ip: string;
  user_agent: string;
  created_at: string;
  expires_at: string;
  last_used_at?: string;
  revoked_at?: string;
  rotated_from?: string;
}

export class AuthSessionService {
  private static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Issue access token and persistent refresh token session
   */
  public static createSession(
    user: User,
    ip: string,
    userAgent: string,
    deviceId?: string,
    deviceName?: string
  ): { accessToken: string; refreshToken: string; sessionId: string; expiresAt: string } {
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const tokenHash = this.hashToken(refreshToken);

    const sessionId = `sess_${uuidv4().substring(0, 8)}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    run(
      `INSERT INTO auth_sessions (id, user_id, refresh_token_hash, device_id, device_name, ip, user_agent, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, user.id, tokenHash, deviceId || null, deviceName || null, ip || '127.0.0.1', userAgent || 'AditiRide Mobile/Web Client', expiresAt]
    );

    return { accessToken, refreshToken, sessionId, expiresAt };
  }

  /**
   * Rotate refresh token and issue new token pair.
   * If a revoked/already-rotated token is presented, trigger token reuse detection and revoke entire session family.
   */
  public static rotateSession(
    presentedRefreshToken: string,
    ip: string,
    userAgent: string
  ): { accessToken: string; refreshToken: string; sessionId: string } {
    const verifiedPayload = verifyRefreshToken(presentedRefreshToken);
    if (!verifiedPayload) {
      throw new Error('Invalid or expired refresh token signature.');
    }

    const tokenHash = this.hashToken(presentedRefreshToken);
    const existingSession = get<AuthSessionRecord>(
      'SELECT * FROM auth_sessions WHERE refresh_token_hash = ?',
      [tokenHash]
    );

    if (!existingSession) {
      throw new Error('Refresh token session not found.');
    }

    // Token reuse attack detection
    if (existingSession.revoked_at) {
      // Revoke all sessions for this user immediately
      run(`UPDATE auth_sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL`, [
        existingSession.user_id
      ]);

      throw new Error('Security Alert: Refresh token reuse detected! All active sessions have been revoked for your safety.');
    }

    // Check expiry
    if (new Date() > new Date(existingSession.expires_at)) {
      run(`UPDATE auth_sessions SET revoked_at = datetime('now') WHERE id = ?`, [existingSession.id]);
      throw new Error('Refresh token session has expired. Please log in again.');
    }

    const user = get<User>('SELECT * FROM users WHERE id = ?', [existingSession.user_id]);
    if (!user) {
      throw new Error('User account not found.');
    }

    return transaction(() => {
      const now = new Date().toISOString();

      // Revoke current session
      run(`UPDATE auth_sessions SET revoked_at = ?, last_used_at = ? WHERE id = ?`, [now, now, existingSession.id]);

      // Generate new pair
      const newAccessToken = generateAccessToken(user);
      const newRefreshToken = generateRefreshToken(user);
      const newTokenHash = this.hashToken(newRefreshToken);

      const newSessionId = `sess_${uuidv4().substring(0, 8)}`;
      const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      run(
        `INSERT INTO auth_sessions (id, user_id, refresh_token_hash, device_id, device_name, ip, user_agent, expires_at, rotated_from)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newSessionId,
          user.id,
          newTokenHash,
          existingSession.device_id || null,
          existingSession.device_name || null,
          ip || '127.0.0.1',
          userAgent || 'AditiRide Client',
          newExpiresAt,
          existingSession.id
        ]
      );

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        sessionId: newSessionId
      };
    });
  }

  /**
   * Revoke a single active refresh token session (Logout)
   */
  public static revokeSession(refreshToken: string): boolean {
    const tokenHash = this.hashToken(refreshToken);
    const result = run(
      `UPDATE auth_sessions SET revoked_at = datetime('now') WHERE refresh_token_hash = ? AND revoked_at IS NULL`,
      [tokenHash]
    );
    return result.changes > 0;
  }

  /**
   * Revoke all active sessions for a user (Logout All Devices)
   */
  public static revokeAllUserSessions(userId: string): number {
    const result = run(
      `UPDATE auth_sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL`,
      [userId]
    );
    return result.changes;
  }
}
