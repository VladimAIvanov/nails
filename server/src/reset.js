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
  if (!existsSync(path)) continue;
  try {
    rmSync(path);
    console.log(`удалён ${path}`);
  } catch (err) {
    /* Windows не даёт удалить файл, открытый другим процессом.
       Почти всегда это работающий сервер: npm start в соседнем окне. */
    if (err.code === 'EPERM' || err.code === 'EBUSY') {
      console.error(
        `\nНе удалось удалить ${path}: файл занят другим процессом.\n` +
        '  Скорее всего запущен сервер (npm start). Остановите его и повторите.\n' +
        '  Пересоздавать базу под работающим сервером нельзя: он продолжит писать\n' +
        '  в старый файл, и данные разойдутся.\n'
      );
      process.exit(1);
    }
    throw err;
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
