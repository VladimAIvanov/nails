/* Пересоздание базы с нуля: удаляет файл базы вместе с журналами WAL,
   затем прогоняет миграции и загружает тестовые данные.

   Файл базы полностью воспроизводим из migrations/ и seed.js, поэтому
   удаление безопасно. Всё, что было внесено вручную, будет потеряно. */
import { existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dbFile, db } from './db.js';

db.close();

for (const suffix of ['', '-wal', '-shm']) {
  const path = dbFile + suffix;
  if (existsSync(path)) {
    rmSync(path);
    console.log(`удалён ${path}`);
  }
}

const run = (script) =>
  execFileSync(process.execPath, ['--env-file-if-exists=../.env', `src/${script}`], {
    cwd: import.meta.dirname + '/..',
    stdio: 'inherit'
  });

console.log('\n— миграции —');
run('migrate.js');

console.log('\n— тестовые данные —');
run('seed.js');
