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

/* Сборка списка «столбец = $столбец» для UPDATE.

   Значения в запросах всегда передаются параметрами, но имена столбцов
   параметрами быть не могут — их приходится вставлять в текст запроса.
   Сегодня они берутся из литеральных списков в коде и потому безопасны;
   эта функция делает безопасность обязательной, а не случайной: имя, которого
   нет в списке разрешённых, до SQL не дойдёт. Без неё одна правка, подставившая
   сюда ключ из тела запроса, превратила бы место в инъекцию незаметно. */
export function setClause(updates, allowed) {
  const keys = Object.keys(updates);
  if (keys.length === 0) throw new Error('setClause: нечего обновлять');

  for (const key of keys) {
    if (!allowed.includes(key)) {
      throw new Error(`setClause: столбец «${key}» не разрешён к изменению`);
    }
    // вторая линия: даже разрешённое имя обязано выглядеть как имя столбца
    if (!/^[a-z_][a-z0-9_]*$/.test(key)) {
      throw new Error(`setClause: недопустимое имя столбца «${key}»`);
    }
  }

  return keys.map((k) => `${k} = $${k}`).join(', ');
}

export { toIso, nowIso } from './time.js';

