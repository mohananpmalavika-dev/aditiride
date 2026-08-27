import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// 1. CORS Configuration with Allowlist
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : [
      'http://localhost:5180',
      'http://localhost:3000',
      'http://127.0.0.1:5180',
      'http://127.0.0.1:3000'
    ];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow non-browser agents (mobile apps, postman, curl) or allowed origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS Error: Origin '${origin}' is not in the authorized domain allowlist.`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Requested-With']
});

// 2. Helmet Security Headers
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://images.unsplash.com', 'https://*.tile.openstreetmap.org'],
      connectSrc: ["'self'", 'ws:', 'wss:', 'https://*.tile.openstreetmap.org', 'https://nominatim.openstreetmap.org', 'https://router.project-osrm.org']
    }
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' }
});

// 3. Granular Rate Limiters
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 login/register attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' }
});

export const bookingRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // max 10 booking actions per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Booking rate limit exceeded. Please wait a moment before trying again.' }
});

export const sosRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'SOS rate limit exceeded. Contact emergency helpline 112 directly.' }
});

export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'API rate limit exceeded. Please throttle requests.' }
});
