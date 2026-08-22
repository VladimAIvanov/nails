/* Отчёт о готовности окружения. Запускается на сервере до первого старта:
   npm run doctor */
import { statSync } from 'node:fs';
import { db, dbFile, environment } from './db.js';
import { NODE_MIN, NODE_RECOMMENDED_MAJOR, SQLITE_MIN } from './env-check.js';

const line = (name, value) => console.log(`  ${name.padEnd(28)} ${value}`);

console.log('\nОкружение');
line('Node.js', `${process.versions.node}  (минимум ${NODE_MIN}, рекомендуется ${NODE_RECOMMENDED_MAJOR} LTS)`);
line('Платформа', `${process.platform} ${process.arch}`);
line('SQLite', `${environment.sqlite}  (минимум ${SQLITE_MIN})`);

console.log('\nБаза');
line('Файл', dbFile);
try {
  const size = statSync(dbFile).size;
  line('Размер', `${(size / 1024).toFixed(0)} КБ`);
} catch {
  line('Размер', 'файла нет — выполните npm run migrate');
}
line('Журнал', environment.journal);
line('Внешние ключи', db.prepare('PRAGMA foreign_keys').get().foreign_keys === 1 ? 'включены' : 'ВЫКЛЮЧЕНЫ');
line('Ожидание блокировки', `${db.prepare('PRAGMA busy_timeout').get().timeout} мс`);

const applied = db.prepare(
  `SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='schema_migrations'`
).get().n
  ? db.prepare('SELECT name FROM schema_migrations ORDER BY name').all().map((r) => r.name)
  : [];
line('Применено миграций', applied.length ? applied.join(', ') : 'ни одной');

console.log('\nСодержимое');
const tables = db.prepare(
  `SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
).get().n;
line('Таблиц', String(tables));
line('Нарушений целостности', String(db.prepare('PRAGMA foreign_key_check').all().length));
const integrity = db.prepare('PRAGMA quick_check').get();
line('Проверка файла', Object.values(integrity)[0]);

console.log('');
db.close();
