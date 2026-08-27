import { get, query, run } from '../db/index.js';
import { getPgPool, queryPg, getPg, runPg } from '../db/connection.js';
import { User } from '../types/index.js';

export class UserRepository {
  public static async findById(id: string): Promise<User | undefined> {
    if (getPgPool()) {
      return getPg<User>('SELECT * FROM users WHERE id = $1', [id]);
    }
    return get<User>('SELECT * FROM users WHERE id = ?', [id]);
  }

  public static async findByIdentifier(identifier: string): Promise<User | undefined> {
    if (getPgPool()) {
      return getPg<User>(
        'SELECT * FROM users WHERE username = $1 OR email = $1 OR phone = $1 OR id = $1',
        [identifier]
      );
    }
    return get<User>(
      'SELECT * FROM users WHERE username = ? OR email = ? OR phone = ? OR id = ?',
      [identifier, identifier, identifier, identifier]
    );
  }

  public static async create(user: Partial<User> & { password_hash: string }): Promise<void> {
    if (getPgPool()) {
      await runPg(
        `INSERT INTO users (id, username, phone, email, name, role, password_hash, preferred_language, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          user.id,
          user.username || null,
          user.phone,
          user.email || null,
          user.name,
          user.role,
          user.password_hash,
          user.preferred_language || 'en',
          user.status || 'ACTIVE'
        ]
      );
      return;
    }

    run(
      `INSERT INTO users (id, username, phone, email, name, role, password_hash, preferred_language, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.username || null,
        user.phone,
        user.email || null,
        user.name,
        user.role,
        user.password_hash,
        user.preferred_language || 'en',
        user.status || 'ACTIVE'
      ]
    );
  }
}
