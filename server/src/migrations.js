/* Прогон миграций. Каждый файл из ../migrations выполняется один раз,
   целиком в одной транзакции, в алфавитном порядке имён.

   Отсюда его зовут двое: команда `npm run migrate` и сам сервер при запуске.
   Второе появилось ради сервера: там команду набирать некому, обновление
   происходит само после коммита. Повторного применения бояться не нужно —
   применённое записано в schema_migrations и второй раз не выполняется.

   Одна оговорка — пересборка таблицы. В SQLite нельзя изменить ограничение
   CHECK у существующего столбца: таблицу создают заново, переливают строки,
   старую удаляют и переименовывают новую. Мешает этому проверка внешних
   ключей: DROP TABLE при включённой проверке ведёт себя как DELETE FROM
   и тянет за собой каскады, а строки с ON DELETE RESTRICT просто ломают
   удаление. Выключить проверку изнутри транзакции нельзя — PRAGMA
   foreign_keys внутри неё молча ничего не делает.

   Поэтому у миграции есть способ попросить особый режим: строка
   «-- ПЕРЕСБОРКА ТАБЛИЦЫ» в начале файла. Такая миграция выполняется по
   процедуре, описанной в документации SQLite: проверка выключается снаружи
   транзакции, внутри переливаются данные, перед фиксацией выполняется
   PRAGMA foreign_key_check, и если он что-то нашёл — всё откатывается. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { db, transaction } from './db.js';

const migrationsDir = join(import.meta.dirname, '..', 'migrations');

/**
 * Применяет непринятые миграции по порядку.
 *
 * @param {object} [options]
 * @param {(name: string, rebuildsTable: boolean) => void} [options.onEach]
 *        зовётся перед каждой миграцией — команде это нужно, чтобы печатать ход
 * @param {(name: string, rebuildsTable: boolean) => void} [options.onDone]
 *        зовётся после успешного применения миграции
 * @returns {{ applied: string[], total: number }} что применили и сколько всего
 */
export function applyMigrations({ onEach, onDone } = {}) {
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
  const done = [];

  for (const file of pending) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    const rebuildsTable = sql.slice(0, 400).includes('-- ПЕРЕСБОРКА ТАБЛИЦЫ');
    onEach?.(file, rebuildsTable);

    if (rebuildsTable) db.exec('PRAGMA foreign_keys = OFF');
    try {
      transaction((conn) => {
        conn.exec(sql);
        conn.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);

        /* Проверка отложена, но не отменена: связи должны сойтись до фиксации.
           Иначе выключенный на время внешний ключ превратился бы в способ
           тихо оставить в базе ссылки в никуда. */
        if (rebuildsTable) {
          const broken = conn.prepare('PRAGMA foreign_key_check').all();
          if (broken.length > 0) {
            throw new Error(
              `${file}: после пересборки ${broken.length} ссылок ведут в никуда `
              + `(${broken.slice(0, 3).map((b) => `${b.table}.${b.rowid} → ${b.parent}`).join(', ')})`
            );
          }
        }
      });
    } finally {
      if (rebuildsTable) db.exec('PRAGMA foreign_keys = ON');
    }

    onDone?.(file, rebuildsTable);
    done.push(file);
  }

  return { applied: done, total: files.length };
}
