import { Redis } from 'ioredis';

export interface RedisDriverPresence {
  driverId: string;
  lat: number;
  lng: number;
  heading: number;
  status: 'ONLINE' | 'OFFLINE' | 'ON_TRIP' | 'BUSY';
  updatedAt: number;
}

export class RedisClient {
  private static client: Redis | null = null;
  private static subClient: Redis | null = null;
  private static mockStore: Map<string, { value: string; expiresAt: number }> = new Map();
  private static presenceStore: Map<string, RedisDriverPresence> = new Map();

  /**
   * Initialize Redis Client connection pool
   */
  public static init(redisUrl?: string): Redis | null {
    const url = redisUrl || process.env.REDIS_URL;

    if (process.env.NODE_ENV === 'production' && !url) {
      throw new Error('CRITICAL PRODUCTION CONFIGURATION ERROR: REDIS_URL must be configured in production for distributed coordination.');
    }

    if (url) {
      this.client = new Redis(url, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false
      });

      this.client.on('connect', () => {
        console.log('[Redis] Connected successfully to distributed Redis instance.');
      });

      this.client.on('error', (err) => {
        console.error('[Redis Error]', err.message);
      });
    }

    return this.client;
  }

  public static getClient(): Redis | null {
    return this.client;
  }

  public static getSubClient(): Redis | null {
    if (!this.subClient && process.env.REDIS_URL) {
      this.subClient = new Redis(process.env.REDIS_URL);
    }
    return this.subClient;
  }

  /**
   * Atomic conditional lease acquisition: SET key value NX EX ttl
   * Returns true if lease was acquired, false if key already exists in Redis cluster.
   */
  public static async acquireDistributedLease(
    key: string,
    value: string,
    ttlSeconds: number
  ): Promise<boolean> {
    if (this.client) {
      const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    }

    // High-concurrency in-memory fallback for local dev & unit tests
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
   * Atomic compare-and-delete lease release using Lua script.
   * Ensures Booking A cannot accidentally release Booking B's lease.
   */
  public static async releaseDistributedLease(key: string, expectedValue?: string): Promise<boolean> {
    if (this.client) {
      if (expectedValue) {
        const luaScript = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        const res = await this.client.eval(luaScript, 1, key, expectedValue);
        return res === 1;
      } else {
        const res = await this.client.del(key);
        return res > 0;
      }
    }

    const existing = this.mockStore.get(key);
    if (!existing) return false;

    if (expectedValue && existing.value !== expectedValue) {
      return false; // Only release if held by caller
    }

    this.mockStore.delete(key);
    return true;
  }

  /**
   * Update driver realtime presence and GPS in Redis cluster
   */
  public static async updateDriverPresence(
    driverId: string,
    lat: number,
    lng: number,
    heading: number,
    status: 'ONLINE' | 'OFFLINE' | 'ON_TRIP' | 'BUSY'
  ): Promise<void> {
    const presenceData: RedisDriverPresence = {
      driverId,
      lat,
      lng,
      heading,
      status,
      updatedAt: Date.now()
    };

    if (this.client) {
      await this.client.set(
        `driver:presence:${driverId}`,
        JSON.stringify(presenceData),
        'EX',
        60 // 60s presence TTL
      );
    } else {
      this.presenceStore.set(driverId, presenceData);
    }
  }

  /**
   * Get latest cached driver presence from Redis cluster
   */
  public static async getDriverPresence(driverId: string): Promise<RedisDriverPresence | null> {
    if (this.client) {
      const data = await this.client.get(`driver:presence:${driverId}`);
      if (!data) return null;
      return JSON.parse(data) as RedisDriverPresence;
    }

    const presence = this.presenceStore.get(driverId);
    if (!presence) return null;

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
