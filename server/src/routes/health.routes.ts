import { Router, Request, Response } from 'express';
import { get } from '../db/index.js';
import { getPgPool } from '../db/connection.js';
import { RedisClient } from '../services/redis/RedisClient.js';

export const healthRouter = Router();

healthRouter.get('/live', (_req: Request, res: Response) => {
  res.json({
    status: 'LIVE',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

healthRouter.get('/ready', async (_req: Request, res: Response) => {
  try {
    const dbTest = get<{ test: number }>('SELECT 1 as test');
    if (!dbTest || dbTest.test !== 1) {
      return res.status(503).json({ status: 'NOT_READY', reason: 'Primary database probe failed' });
    }

    const pgPool = getPgPool();
    let pgStatus = 'INACTIVE_OR_DEV';
    if (pgPool) {
      const pgRes = await pgPool.query('SELECT 1 as test');
      if (!pgRes || pgRes.rows[0]?.test !== 1) {
        return res.status(503).json({ status: 'NOT_READY', reason: 'PostgreSQL connection pool failed' });
      }
      pgStatus = 'CONNECTED';
    }

    const redis = RedisClient.getClient();
    let redisStatus = 'INACTIVE_OR_DEV';
    if (redis) {
      const pong = await redis.ping();
      if (pong !== 'PONG') {
        return res.status(503).json({ status: 'NOT_READY', reason: 'Redis cluster ping failed' });
      }
      redisStatus = 'CONNECTED';
    }

    const memoryUsage = process.memoryUsage();
    res.json({
      status: 'READY',
      uptimeSeconds: Math.floor(process.uptime()),
      database: 'HEALTHY',
      postgres: pgStatus,
      redis: redisStatus,
      memory: {
        rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
        heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024)
      },
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(503).json({ status: 'NOT_READY', error: err.message });
  }
});
