import fs from 'fs';
import path from 'path';
import pg from 'pg';

export class DatabaseMigrator {
  /**
   * Run all pending versioned SQL migrations against PostgreSQL
   */
  public static async runMigrations(pool: pg.Pool): Promise<string[]> {
    const client = await pool.connect();
    const executedMigrations: string[] = [];

    try {
      // 1. Ensure migrations tracking table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version VARCHAR(128) PRIMARY KEY,
          executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const res = await client.query('SELECT version FROM schema_migrations');
      const applied = new Set(res.rows.map((r: any) => r.version));

      const possibleDirs = [
        path.resolve(process.cwd(), 'src/db/migrations'),
        path.resolve(process.cwd(), 'dist/db/migrations'),
        path.resolve(__dirname, 'migrations'),
        path.resolve(__dirname, '../db/migrations')
      ];

      const migrationsDir = possibleDirs.find((d) => fs.existsSync(d));
      if (!migrationsDir) {
        return [];
      }

      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      for (const file of files) {
        if (!applied.has(file)) {
          console.log(`[DatabaseMigrator] Applying migration: ${file}...`);
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

          await client.query('BEGIN');
          try {
            await client.query(sql);
            await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
            await client.query('COMMIT');
            executedMigrations.push(file);
            console.log(`[DatabaseMigrator] Successfully applied ${file}`);
          } catch (err) {
            await client.query('ROLLBACK');
            throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
          }
        }
      }

      return executedMigrations;
    } finally {
      client.release();
    }
  }
}
