import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import { apiRouter } from '../routes/index.js';
import { getDb, get, query, run } from '../db/index.js';
import { comparePassword, verifyAccessToken } from '../middleware/auth.js';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);
app.use((err: any, req: any, res: any, next: any) => {
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// Helper to make mock express requests using fetch / supertest-like invocation
async function makeRequest(path: string, options: { method: string; body?: any; headers?: any }) {
  return new Promise<{ status: number; body: any }>((resolve) => {
    const req: any = {
      method: options.method,
      url: path,
      headers: options.headers || {},
      body: options.body || {},
      socket: { remoteAddress: '127.0.0.1' }
    };
    const res: any = {
      statusCode: 200,
      headers: {},
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(data: any) {
        resolve({ status: this.statusCode, body: data });
        return this;
      },
      setHeader(k: string, v: string) {
        this.headers[k] = v;
      }
    };
    app.handle(req, res, () => {
      resolve({ status: 404, body: { error: 'Not Found' } });
    });
  });
}

describe('Authentication Pathways: Google Login & Email/Password Suite', () => {
  beforeAll(async () => {
    await getDb();
  });

  describe('1. Email and Password Registration & Validation', () => {
    it('should successfully register a new passenger using email and password', async () => {
      const email = `rider_${Date.now()}@example.com`;
      const res = await makeRequest('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Priya Nambiar',
          email,
          password: 'SecurePassword@2026',
          role: 'PASSENGER'
        }
      });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(email);
      expect(res.body.user.name).toBe('Priya Nambiar');
      expect(res.body.user.role).toBe('PASSENGER');
      expect(res.body.user.auth_provider).toBe('LOCAL');
      expect(res.body.token).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();

      // Verify password was hashed and not stored in plaintext
      const dbUser = get<any>('SELECT * FROM users WHERE id = ?', [res.body.user.id]);
      expect(dbUser.password_hash).not.toBe('SecurePassword@2026');
      expect(comparePassword('SecurePassword@2026', dbUser.password_hash)).toBe(true);

      // Verify ₹500 welcome credit for new passenger
      const profile = get<any>('SELECT * FROM passenger_profiles WHERE user_id = ?', [res.body.user.id]);
      expect(profile).toBeDefined();
      expect(profile.wallet_balance).toBe(500.0);

      const wallet = get<any>('SELECT * FROM wallets WHERE user_id = ?', [res.body.user.id]);
      expect(wallet).toBeDefined();
      expect(wallet.balance).toBe(500.0);
    });

    it('should reject registration if email is invalid', async () => {
      const res = await makeRequest('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Invalid Email User',
          email: 'not-an-email',
          password: 'Password123!',
          role: 'PASSENGER'
        }
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/valid email/i);
    });

    it('should reject registration if password is shorter than 6 characters', async () => {
      const res = await makeRequest('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Short Pass User',
          email: `short_${Date.now()}@example.com`,
          password: '123',
          role: 'PASSENGER'
        }
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/at least 6 characters/i);
    });

    it('should reject registration if email is already taken', async () => {
      const email = `duplicate_${Date.now()}@example.com`;
      await makeRequest('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'First User',
          email,
          password: 'Password123!',
          role: 'PASSENGER'
        }
      });

      const res2 = await makeRequest('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Second User',
          email,
          password: 'DifferentPassword123!',
          role: 'PASSENGER'
        }
      });

      expect(res2.status).toBe(409);
      expect(res2.body.error).toMatch(/already exists/i);
    });
  });

  describe('2. Email and Password Login', () => {
    const testEmail = `login_test_${Date.now()}@example.com`;
    const testPassword = 'MySecretPassWord123#';

    beforeAll(async () => {
      await makeRequest('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Login Tester',
          email: testEmail,
          password: testPassword,
          role: 'PASSENGER'
        }
      });
    });

    it('should successfully log in with email and password', async () => {
      const res = await makeRequest('/api/auth/login', {
        method: 'POST',
        body: {
          email: testEmail,
          password: testPassword
        }
      });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.token).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();

      const decoded = verifyAccessToken(res.body.token);
      expect(decoded).not.toBeNull();
      expect(decoded?.email).toBe(testEmail);
    });

    it('should reject login with wrong password', async () => {
      const res = await makeRequest('/api/auth/login', {
        method: 'POST',
        body: {
          email: testEmail,
          password: 'WrongPassword999!'
        }
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/incorrect password/i);
    });

    it('should reject login for non-existent email', async () => {
      const res = await makeRequest('/api/auth/login', {
        method: 'POST',
        body: {
          email: 'non_existent_account_987654@aditiride.com',
          password: 'SomePassword123!'
        }
      });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/account not found/i);
    });
  });

  describe('3. Google Authentication (Sign In & Sign Up)', () => {
    it('should automatically create and authenticate a new passenger via Google OAuth', async () => {
      const googleId = `gid_${Date.now()}`;
      const googleEmail = `google_rider_${Date.now()}@gmail.com`;

      const res = await makeRequest('/api/auth/google', {
        method: 'POST',
        body: {
          googleId,
          email: googleEmail,
          name: 'Google Passenger User',
          avatarUrl: 'https://lh3.googleusercontent.com/a/mock_avatar',
          role: 'PASSENGER'
        }
      });

      if (res.status !== 200) {
        console.error('Google Auth test failure response:', res.body);
      }
      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(googleEmail);
      expect(res.body.user.name).toBe('Google Passenger User');
      expect(res.body.user.auth_provider).toBe('GOOGLE');
      expect(res.body.user.google_id).toBe(googleId);
      expect(res.body.token).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();

      // Verify wallet credit
      const wallet = get<any>('SELECT * FROM wallets WHERE user_id = ?', [res.body.user.id]);
      expect(wallet).toBeDefined();
      expect(wallet.balance).toBe(500.0);
    });

    it('should successfully log in existing Google OAuth user', async () => {
      const googleId = `gid_repeat_${Date.now()}`;
      const googleEmail = `repeat_google_${Date.now()}@gmail.com`;

      // First time: sign up
      const res1 = await makeRequest('/api/auth/google', {
        method: 'POST',
        body: {
          googleId,
          email: googleEmail,
          name: 'Repeat Google User',
          role: 'PASSENGER'
        }
      });
      expect(res1.status).toBe(200);

      // Second time: sign in
      const res2 = await makeRequest('/api/auth/google', {
        method: 'POST',
        body: {
          googleId,
          email: googleEmail
        }
      });

      expect(res2.status).toBe(200);
      expect(res2.body.user.id).toBe(res1.body.user.id);
      expect(res2.body.token).toBeDefined();
    });

    it('should link Google ID if user previously registered with the same email', async () => {
      const sharedEmail = `link_account_${Date.now()}@example.com`;
      const pass = 'LocalPassword123#';

      // Register with email and password first
      const localReg = await makeRequest('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Linked Account User',
          email: sharedEmail,
          password: pass,
          role: 'PASSENGER'
        }
      });
      expect(localReg.status).toBe(201);
      const originalUserId = localReg.body.user.id;

      // Sign in with Google using matching email
      const newGoogleId = `gid_linked_${Date.now()}`;
      const googleRes = await makeRequest('/api/auth/google', {
        method: 'POST',
        body: {
          googleId: newGoogleId,
          email: sharedEmail,
          name: 'Linked Account User (Google)'
        }
      });

      expect(googleRes.status).toBe(200);
      expect(googleRes.body.user.id).toBe(originalUserId);

      // Verify in DB that google_id is linked
      const updatedUser = get<any>('SELECT * FROM users WHERE id = ?', [originalUserId]);
      expect(updatedUser.google_id).toBe(newGoogleId);
    });

    it('should decode Google JWT credential token payload when provided', async () => {
      const mockPayload = {
        email: `jwt_google_${Date.now()}@gmail.com`,
        name: 'GIS Credential User',
        sub: `sub_gid_${Date.now()}`,
        picture: 'https://lh3.googleusercontent.com/gis/pic'
      };

      const headerBase64 = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64');
      const payloadBase64 = Buffer.from(JSON.stringify(mockPayload)).toString('base64');
      const mockJwt = `${headerBase64}.${payloadBase64}.mock_signature`;

      const res = await makeRequest('/api/auth/google', {
        method: 'POST',
        body: {
          credential: mockJwt,
          role: 'PASSENGER'
        }
      });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(mockPayload.email);
      expect(res.body.user.name).toBe('GIS Credential User');
      expect(res.body.user.google_id).toBe(mockPayload.sub);
      expect(res.body.user.avatar_url).toBe(mockPayload.picture);
    });
  });
});
