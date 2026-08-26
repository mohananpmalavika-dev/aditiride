import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { getDb } from './db/index.js';
import { apiRouter } from './routes/index.js';
import { setupSocketHandlers } from './realtime/socketHandler.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  }
});

app.use(cors());
app.use(express.json());

// Attach Socket.IO to requests if needed
app.use((req, _res, next) => {
  (req as any).io = io;
  next();
});

// Health Checks
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'AditiRide Platform API', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api', apiRouter);

// Initialize Realtime Handlers
setupSocketHandlers(io);

const PORT = process.env.PORT || 5099;

// Initialize Database before listening
getDb().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 AditiRide Server listening on http://localhost:${PORT}`);
    console.log(`📡 Real-Time Socket.IO Server active on port ${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to initialize AditiRide database:', err);
  process.exit(1);
});
