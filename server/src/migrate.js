/* Прогон миграций. Каждый файл из ../migrations выполняется один раз,
   целиком в одной транзакции, в алфавитном порядке имён. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { db, dbFile, transaction } from './db.js';

const migrationsDir = join(import.meta.dirname, '..', 'migrations');

db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name       TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  )
`);

const applied = new Set(
  db.prepare('SELECT name FROM schema_migrations').all().map((r) => r.name)
);

const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
const pending = files.filter((f) => !applied.has(f));

console.log(`База: ${dbFile}`);

if (pending.length === 0) {
  console.log(`Миграции: нечего применять, все ${files.length} уже накачены.`);
} else {
  for (const file of pending) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    process.stdout.write(`  ${file} ... `);
    transaction((conn) => {
      conn.exec(sql);
      conn.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
    });
    console.log('готово');
  }
  console.log(`Применено миграций: ${pending.length}.`);
}

db.close();
