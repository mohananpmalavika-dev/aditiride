import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { run, get, query } from '../db/index.js';

export interface AuditEntryInput {
  actorUserId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: any;
  newValues?: any;
  reasonCode?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  public static readonly GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

  /**
   * Appends an immutable cryptographically hash-chained audit log entry
   */
  public static log(input: AuditEntryInput): { id: string; sequenceNumber: number; eventHash: string } {
    const id = `audit_${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();

    // 1. Get previous record to chain hashes
    const lastRecord = get<{ sequence_number: number; event_hash: string }>(
      'SELECT sequence_number, event_hash FROM audit_logs WHERE sequence_number IS NOT NULL ORDER BY sequence_number DESC LIMIT 1'
    );

    const seq = lastRecord ? (lastRecord.sequence_number + 1) : 1;
    const prevHash = lastRecord?.event_hash || this.GENESIS_HASH;

    // 2. Compute payload hash
    const payloadStr = JSON.stringify({
      old: input.oldValues || null,
      new: input.newValues || null,
      reason: input.reasonCode || null
    });
    const payloadHash = createHash('sha256').update(payloadStr).digest('hex');

    // 3. Compute Event Hash: H(prevHash || seq || now || actor || action || entityType || entityId || payloadHash)
    const preimage = `${prevHash}|${seq}|${now}|${input.actorUserId}|${input.actorRole}|${input.action}|${input.entityType}|${input.entityId}|${payloadHash}`;
    const eventHash = createHash('sha256').update(preimage).digest('hex');

    run(`
      INSERT INTO audit_logs (
        id, sequence_number, previous_event_hash, event_hash, payload_hash,
        actor_user_id, actor_role, action, entity_type, entity_id,
        old_values, new_values, reason_code, ip_address, user_agent, created_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
    `, [
      id, seq, prevHash, eventHash, payloadHash,
      input.actorUserId, input.actorRole, input.action, input.entityType, input.entityId,
      input.oldValues ? JSON.stringify(input.oldValues) : null,
      input.newValues ? JSON.stringify(input.newValues) : null,
      input.reasonCode || null,
      input.ipAddress || '127.0.0.1',
      input.userAgent || 'AditiRide-Core/2.0',
      now
    ]);

    return { id, sequenceNumber: seq, eventHash };
  }

  /**
   * Cryptographic integrity verifier: walks the entire hash chain from genesis to head
   */
  public static verifyChainIntegrity(): { isValid: boolean; checkedCount: number; brokenSequence?: number } {
    const logs = query<any>('SELECT * FROM audit_logs WHERE sequence_number IS NOT NULL ORDER BY sequence_number ASC');
    if (!logs || logs.length === 0) return { isValid: true, checkedCount: 0 };

    let expectedPrevHash = this.GENESIS_HASH;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      if (log.previous_event_hash !== expectedPrevHash) {
        return { isValid: false, checkedCount: i, brokenSequence: log.sequence_number };
      }

      // Recompute payload hash
      const payloadStr = JSON.stringify({
        old: log.old_values ? JSON.parse(log.old_values) : null,
        new: log.new_values ? JSON.parse(log.new_values) : null,
        reason: log.reason_code || null
      });
      const payloadHash = createHash('sha256').update(payloadStr).digest('hex');

      // Recompute event hash
      const preimage = `${log.previous_event_hash}|${log.sequence_number}|${log.created_at}|${log.actor_user_id}|${log.actor_role}|${log.action}|${log.entity_type}|${log.entity_id}|${payloadHash}`;
      const computedHash = createHash('sha256').update(preimage).digest('hex');

      if (computedHash !== log.event_hash) {
        return { isValid: false, checkedCount: i, brokenSequence: log.sequence_number };
      }

      expectedPrevHash = log.event_hash;
    }

    return { isValid: true, checkedCount: logs.length };
  }
}
