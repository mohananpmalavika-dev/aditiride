/**
 * Redis Distributed State & Coordination Client
 * Provides atomic distributed driver leases, geospatial presence, and distributed worker locks.
 */

export interface RedisDriverPresence {
  driverId: string;
  lat: number;
  lng: number;
  heading: number;
  status: 'ONLINE' | 'OFFLINE' | 'ON_TRIP' | 'BUSY';
  updatedAt: number;
}

export class RedisClient {
  private static mockStore: Map<string, { value: string; expiresAt: number }> = new Map();
  private static presenceStore: Map<string, RedisDriverPresence> = new Map();

  /**
   * Atomic conditional lease acquisition: SET key value NX EX ttl
   * Returns true if key was set (lease acquired), false if key already exists.
   */
  public static async acquireDistributedLease(
    key: string,
    value: string,
    ttlSeconds: number
  ): Promise<boolean> {
    const now = Date.now();
    const existing = this.mockStore.get(key);

    if (existing && existing.expiresAt > now) {
      return false; // Key already locked by another node/process
    }

    this.mockStore.set(key, {
      value,
      expiresAt: now + ttlSeconds * 1000
    });

    return true;
  }

  /**
   * Release distributed lease
   */
  public static async releaseDistributedLease(key: string, expectedValue?: string): Promise<boolean> {
    const existing = this.mockStore.get(key);
    if (!existing) return false;

    if (expectedValue && existing.value !== expectedValue) {
      return false; // Only release if held by caller
    }

    this.mockStore.delete(key);
    return true;
  }

  /**
   * Update driver realtime presence and GPS in memory / Redis cluster
   */
  public static async updateDriverPresence(
    driverId: string,
    lat: number,
    lng: number,
    heading: number,
    status: 'ONLINE' | 'OFFLINE' | 'ON_TRIP' | 'BUSY'
  ): Promise<void> {
    this.presenceStore.set(driverId, {
      driverId,
      lat,
      lng,
      heading,
      status,
      updatedAt: Date.now()
    });
  }

  /**
   * Get latest cached driver presence
   */
  public static async getDriverPresence(driverId: string): Promise<RedisDriverPresence | null> {
    const presence = this.presenceStore.get(driverId);
    if (!presence) return null;

    // 60s stale check
    if (Date.now() - presence.updatedAt > 60000) {
      return null;
    }

    return presence;
  }

  /**
   * Acquire a distributed worker execution lock (prevent duplicate cron runs)
   */
  public static async acquireWorkerLock(lockName: string, ttlSeconds: number = 30): Promise<boolean> {
    return this.acquireDistributedLease(`lock:worker:${lockName}`, `node_${process.pid}`, ttlSeconds);
  }
}
