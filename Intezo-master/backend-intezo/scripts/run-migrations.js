import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sequelize from '../config/database.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.resolve(currentDirectory, '../migrations');

async function runMigrations() {
  await sequelize.authenticate();
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS public.app_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const [existing] = await sequelize.query(
      'SELECT name FROM public.app_migrations WHERE name = $1',
      { bind: [file] }
    );
    if (existing.length > 0) continue;

    const sql = await readFile(path.join(migrationsDirectory, file), 'utf8');
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(sql, { transaction });
      await sequelize.query(
        'INSERT INTO public.app_migrations (name) VALUES ($1)',
        { bind: [file], transaction }
      );
    });

    console.log(`Applied database migration: ${file}`);
  }
}

try {
  await runMigrations();
  console.log('Database migrations are up to date');
} catch (error) {
  console.error('Database migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
