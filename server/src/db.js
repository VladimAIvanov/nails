/* Подключение к SQLite через встроенный в Node 24 модуль node:sqlite —
   без внешних зависимостей и нативной сборки. */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const file = process.env.SQLITE_PATH
  ? resolve(process.env.SQLITE_PATH)
  : resolve(import.meta.dirname, '..', 'data', 'varvara.db');

mkdirSync(dirname(file), { recursive: true });

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
   в расчёте свободного времени: пока транзакция открыта, второй писатель ждёт. */
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
