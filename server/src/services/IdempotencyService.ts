import crypto from 'crypto';
import { get, run } from '../db/index.js';

export interface IdempotencyRecord {
  key: string;
  user_id: string;
  operation: string;
  request_hash: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  response_code?: number;
  response_body?: string;
  expires_at: string;
}

export class IdempotencyService {
  /**
   * Compute a deterministic SHA-256 hash of the request payload
   */
  public static hashRequest(payload: any): string {
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Acquire or check an idempotency key.
   * If already completed, returns the cached response.
   * If in progress, throws a conflict error.
   */
  public static acquireKey(
    key: string,
    userId: string,
    operation: string,
    payload: any,
    ttlMinutes: number = 60
  ): { isExisting: boolean; cachedResponse?: { status: number; body: any } } {
    const requestHash = this.hashRequest(payload);
    const existing = get<IdempotencyRecord>(
      'SELECT * FROM idempotency_keys WHERE key = ? AND user_id = ?',
      [key, userId]
    );

    if (existing) {
      if (existing.status === 'COMPLETED' && existing.response_body) {
        return {
          isExisting: true,
          cachedResponse: {
            status: existing.response_code || 200,
            body: JSON.parse(existing.response_body)
          }
        };
      }

      if (existing.status === 'PROCESSING') {
        throw new Error('Concurrent request in progress with this Idempotency-Key. Please wait.');
      }
    }

    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
    run(
      `INSERT INTO idempotency_keys (key, user_id, operation, request_hash, status, expires_at)
       VALUES (?, ?, ?, ?, 'PROCESSING', ?)
       ON CONFLICT(key) DO UPDATE SET status = 'PROCESSING', request_hash = ?`,
      [key, userId, operation, requestHash, expiresAt, requestHash]
    );

    return { isExisting: false };
  }

  /**
   * Complete the idempotency record with the final response
   */
  public static completeKey(key: string, userId: string, statusCode: number, responseBody: any): void {
    const serialized = JSON.stringify(responseBody);
    run(
      `UPDATE idempotency_keys 
       SET status = 'COMPLETED', response_code = ?, response_body = ?
       WHERE key = ? AND user_id = ?`,
      [statusCode, serialized, key, userId]
    );
  }

  /**
   * Mark the idempotency record as failed so retry can proceed
   */
  public static failKey(key: string, userId: string): void {
    run(
      `UPDATE idempotency_keys SET status = 'FAILED' WHERE key = ? AND user_id = ?`,
      [key, userId]
    );
  }
}
