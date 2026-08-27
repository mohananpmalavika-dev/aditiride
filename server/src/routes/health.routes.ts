import { Router, Request, Response } from 'express';
import { get } from '../db/index.js';

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
      return res.status(503).json({ status: 'NOT_READY', reason: 'Database probe failed' });
    }

    const memoryUsage = process.memoryUsage();
    res.json({
      status: 'READY',
      uptimeSeconds: Math.floor(process.uptime()),
      database: 'HEALTHY',
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
