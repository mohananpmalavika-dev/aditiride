import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export const JWT_SECRET = process.env.JWT_SECRET || 'aditiride_production_jwt_sec_2026_x89f4b9a1c';
export const JWT_EXPIRES_IN = '7d';

export interface AuthUserPayload {
  id: string;
  role: string;
  email?: string;
  phone?: string;
  name?: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUserPayload;
}

export function generateToken(user: { id: string; role: string; email?: string; phone?: string; name?: string }): string {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      email: user.email,
      phone: user.phone,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token: string): AuthUserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUserPayload;
  } catch (err) {
    return null;
  }
}

export function hashPassword(plainPassword: string): string {
  return bcrypt.hashSync(plainPassword, 10);
}

export function comparePassword(plainPassword: string, passwordHash: string): boolean {
  return bcrypt.compareSync(plainPassword, passwordHash);
}

/**
 * Express Middleware: Authenticates JWT Bearer Token
 * Attaches verified req.user = { id, role, email, phone, name }
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No Bearer token provided.' });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(403).json({ error: 'Invalid, expired, or tampered authentication token.' });
  }

  (req as AuthenticatedRequest).user = user;
  next();
}

/**
 * Optional Authentication Middleware:
 * If a valid token is present, attaches req.user; otherwise proceeds without error.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (token) {
    const user = verifyToken(token);
    if (user) {
      (req as AuthenticatedRequest).user = user;
    }
  }
  next();
}

/**
 * RBAC Middleware: Enforces specific role access
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
