import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET)) {
  throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET and JWT_REFRESH_SECRET must be explicitly configured in production environment.');
}

export const JWT_SECRET = process.env.JWT_SECRET || 'aditiride_dev_jwt_sec_2026_x89f4b9a1c';
export const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'aditiride_dev_refresh_sec_2026_d7a2e5c';
export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL = '30d';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'DRIVER' | 'PASSENGER' | 'FLEET_MANAGER';

export type Permission =
  | 'ride.create'
  | 'ride.cancel.own'
  | 'ride.accept'
  | 'ride.start'
  | 'ride.complete'
  | 'driver.location.update.own'
  | 'driver.pricing.update.own'
  | 'driver.status.manage'
  | 'fare.category.read'
  | 'fare.category.manage'
  | 'wallet.read.own'
  | 'wallet.topup.own'
  | 'wallet.pay.own'
  | 'sos.trigger'
  | 'sos.resolve'
  | 'user.block'
  | 'favorite.manage'
  | 'admin.driver.verify'
  | 'admin.user.suspend'
  | 'admin.surge.manage'
  | 'admin.pricing.manage'
  | 'admin.audit.read'
  | 'fleet.driver.manage'
  | 'fleet.vehicle.manage'
  | 'fleet.analytics.read';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    'ride.create', 'ride.cancel.own', 'ride.accept', 'ride.start', 'ride.complete',
    'driver.location.update.own', 'driver.pricing.update.own', 'driver.status.manage',
    'fare.category.read', 'fare.category.manage',
    'wallet.read.own', 'wallet.topup.own', 'wallet.pay.own',
    'sos.trigger', 'sos.resolve', 'user.block', 'favorite.manage',
    'admin.driver.verify', 'admin.user.suspend', 'admin.surge.manage', 'admin.pricing.manage', 'admin.audit.read',
    'fleet.driver.manage', 'fleet.vehicle.manage', 'fleet.analytics.read'
  ],
  ADMIN: [
    'ride.create', 'ride.cancel.own', 'fare.category.read', 'fare.category.manage',
    'wallet.read.own', 'wallet.topup.own', 'wallet.pay.own',
    'sos.trigger', 'sos.resolve', 'user.block', 'favorite.manage',
    'admin.driver.verify', 'admin.user.suspend', 'admin.surge.manage', 'admin.pricing.manage', 'admin.audit.read',
    'fleet.driver.manage', 'fleet.vehicle.manage', 'fleet.analytics.read'
  ],
  DRIVER: [
    'ride.accept', 'ride.start', 'ride.complete', 'ride.cancel.own',
    'driver.location.update.own', 'driver.pricing.update.own', 'driver.status.manage',
    'fare.category.read', 'wallet.read.own', 'wallet.topup.own',
    'sos.trigger', 'user.block'
  ],
  PASSENGER: [
    'ride.create', 'ride.cancel.own',
    'fare.category.read',
    'wallet.read.own', 'wallet.topup.own', 'wallet.pay.own',
    'sos.trigger', 'user.block', 'favorite.manage'
  ],
  FLEET_MANAGER: [
    'fare.category.read',
    'fleet.driver.manage', 'fleet.vehicle.manage', 'fleet.analytics.read',
    'wallet.read.own', 'wallet.topup.own'
  ]
};

export interface AuthUserPayload {
  id: string;
  role: UserRole;
  email?: string;
  phone?: string;
  name?: string;
  permissions?: Permission[];
}

export interface AuthenticatedRequest extends Request {
  user: AuthUserPayload;
}

export function generateAccessToken(user: { id: string; role: UserRole; email?: string; phone?: string; name?: string }): string {
  const permissions = ROLE_PERMISSIONS[user.role] || [];
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      email: user.email,
      phone: user.phone,
      name: user.name,
      permissions
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

export function generateRefreshToken(user: { id: string; role: UserRole }): string {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      type: 'REFRESH'
    },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL }
  );
}

export function generateToken(user: { id: string; role: string; email?: string; phone?: string; name?: string }): string {
  return generateAccessToken(user as any);
}

export function verifyAccessToken(token: string): AuthUserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUserPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): { id: string; role: UserRole } | null {
  try {
    const payload = jwt.verify(token, JWT_REFRESH_SECRET) as any;
    if (payload.type !== 'REFRESH') return null;
    return { id: payload.id, role: payload.role };
  } catch {
    return null;
  }
}

export function verifyToken(token: string): AuthUserPayload | null {
  return verifyAccessToken(token);
}

export function hashPassword(plainPassword: string): string {
  return bcrypt.hashSync(plainPassword, 12);
}

export function comparePassword(plainPassword: string, passwordHash: string): boolean {
  return bcrypt.compareSync(plainPassword, passwordHash);
}

/**
 * Express Middleware: Authenticates JWT Access Token
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No Bearer token provided.' });
  }

  const user = verifyAccessToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired authentication token. Please refresh token.' });
  }

  (req as AuthenticatedRequest).user = user;
  next();
}

/**
 * Optional Authentication Middleware
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (token) {
    const user = verifyAccessToken(token);
    if (user) {
      (req as AuthenticatedRequest).user = user;
    }
  }
  next();
}

/**
 * RBAC Role Check Middleware
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        error: `Access forbidden: Role '${user.role}' is not authorized. Allowed roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
}

/**
 * Granular Permission Check Middleware
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const permissions = user.permissions || ROLE_PERMISSIONS[user.role] || [];
    if (!permissions.includes(permission)) {
      return res.status(403).json({
        error: `Access forbidden: Missing required permission '${permission}'.`
      });
    }

    next();
  };
}
