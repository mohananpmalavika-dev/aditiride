import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { getDb } from './db/index.js';
import { apiRouter } from './routes/index.js';
import { healthRouter } from './routes/health.routes.js';
import { setupSocketHandlers } from './realtime/socketHandler.js';
import {
  corsMiddleware,
  helmetMiddleware,
  generalApiLimiter,
  authRateLimiter
} from './middleware/security.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5180', 'http://localhost:3000', 'http://127.0.0.1:5180'];

import { createAdapter } from '@socket.io/redis-adapter';
import { RedisClient } from './services/redis/RedisClient.js';

RedisClient.init();

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true
  }
});

// Mount Redis Adapter if Redis is connected
const pubClient = RedisClient.getClient();
const subClient = RedisClient.getSubClient();
if (pubClient && subClient) {
  io.adapter(createAdapter(pubClient, subClient));
  console.log('[Socket.IO] Mounted Redis Adapter for multi-node clustering.');
}

// Security & Parsing Middlewares
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// General Rate Limiter
app.use(generalApiLimiter);

// Attach Socket.IO to requests
app.use((req, _res, next) => {
  (req as any).io = io;
  next();
});

// Health Checks & Probes
app.use('/health', healthRouter);
app.use('/', healthRouter);

// API Routes with Versioning
app.use('/api/v1', apiRouter);
app.use('/api', apiRouter); // Backward compatibility fallback

// Initialize Realtime Handlers
setupSocketHandlers(io);

// Global Error Handler Middleware
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message || err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred.',
      timestamp: new Date().toISOString()
    }
  });
});

const PORT = process.env.PORT || 5099;

import { getDbConfig, initPostgresPool } from './db/connection.js';
import { DatabaseMigrator } from './db/migrator.js';
import { SchedulerWorker } from './services/SchedulerWorker.js';

async function bootstrap() {
  const dbConfig = getDbConfig();
  console.log(`[Bootstrap] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[Bootstrap] Database engine: ${dbConfig.isPostgres ? 'PostgreSQL + PostGIS (Production Connection Pool)' : 'Local Embedded SQL'}`);

  if (dbConfig.isPostgres) {
    const pool = await initPostgresPool(dbConfig.connectionString);
    await DatabaseMigrator.runMigrations(pool);
  } else {
    await getDb();
  }

  // Start background distributed scheduler worker
  SchedulerWorker.start(io);

  server.listen(PORT, () => {
    console.log(`🚀 AditiRide Pilot Server listening on http://localhost:${PORT}`);
    console.log(`📡 Real-Time Socket.IO Server active on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('FATAL APPLICATION BOOTSTRAP ERROR:', err.message || err);
  process.exit(1);
});
