/* Прогон миграций. Каждый файл из ../migrations выполняется один раз,
   целиком в одной транзакции, в алфавитном порядке имён. */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool, withTransaction } from './db.js';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

async function ensureRegistry() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text        PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function main() {
  await ensureRegistry();

  const { rows } = await pool.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log(`Миграции: нечего применять, все ${files.length} уже накачены.`);
    return;
  }

  for (const file of pending) {
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    process.stdout.write(`  ${file} ... `);
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    });
    console.log('готово');
  }

  console.log(`Применено миграций: ${pending.length}.`);
}

try {
  await main();
} finally {
  await pool.end();
}
