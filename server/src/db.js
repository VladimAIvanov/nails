/* Подключение к SQLite через встроенный в Node 24 модуль node:sqlite —
   без внешних зависимостей и нативной сборки.

   Перед открытием базы проверяется окружение: версия Node, наличие самого
   модуля в сборке, права на каталог. Требования — в src/env-check.js. */
import { resolve } from 'node:path';
import {
  checkRuntime,
  checkSqliteModule,
  checkDataDirectory,
  checkConnection
} from './env-check.js';

const runtimeNotes = checkRuntime();
const { DatabaseSync } = await checkSqliteModule();

/* SQLITE_PATH задаётся относительно корня проекта, а не текущей папки:
   скрипты запускаются из server/, и путь «server/data/varvara.db» иначе
   разворачивался бы в server/server/data/varvara.db. */
const projectRoot = resolve(import.meta.dirname, '..', '..');

const file = process.env.SQLITE_PATH
  ? resolve(projectRoot, process.env.SQLITE_PATH)
  : resolve(import.meta.dirname, '..', 'data', 'varvara.db');

const dirNotes = checkDataDirectory(file);

export const dbFile = file;
export const db = new DatabaseSync(file);

/* foreign_keys выключены в SQLite по умолчанию и включаются на каждое
   подключение отдельно — без этой строки все ON DELETE и ссылочная
   целостность молча не работают. */
db.exec('PRAGMA foreign_keys = ON');
/* WAL: читатели не блокируют писателя. Писатель всё равно один — на этом
   и держится защита от двойной записи, см. transaction() ниже. */
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA busy_timeout = 5000');
db.exec('PRAGMA synchronous = NORMAL');

export const environment = checkConnection(db);

/* Замечания не мешают работе, но должны быть видны в логе запуска. */
for (const note of [...runtimeNotes, ...dirNotes, ...environment.notes]) {
  console.warn(`[окружение] ${note}`);
}

export function all(sql, params = {}) {
  return db.prepare(sql).all(params);
}

export function get(sql, params = {}) {
  return db.prepare(sql).get(params);
}

export function run(sql, params = {}) {
  return db.prepare(sql).run(params);
}

/* BEGIN IMMEDIATE, а не обычный BEGIN: блокировка записи берётся сразу,
   а не при первой записи. Именно это закрывает гонку «проверили — вставили»
   в расчёте свободного времени: пока транзакция открыта, второй писатель ждёт.
   Работает и между процессами — блокировка живёт на уровне файла. */
export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn(db);
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/* Единый формат времени в базе: строка ISO-8601 в UTC с суффиксом Z.
   Такие строки сравниваются и сортируются как обычный текст. */
export function toIso(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function nowIso() {
  return toIso(new Date());
}
