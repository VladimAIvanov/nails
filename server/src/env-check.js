/* Проверки окружения. Задача — упасть сразу и с внятным текстом,
   а не посреди работы с непонятной ошибкой.

   Требования зафиксированы здесь же, в константах ниже, и продублированы
   в docs/deployment.md и в поле engines файла package.json. */
import { accessSync, constants, mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';

/* Минимум определяется тремя вещами, каждая из которых нужна коду:
     22.5.0  — появился модуль node:sqlite
     22.9.0  — появился флаг --env-file-if-exists в npm-скриптах
     22.13.0 — node:sqlite перестал требовать --experimental-sqlite
   Итог: 22.13.0. Рекомендуем 24 LTS: на нём разработка и проверки. */
export const NODE_MIN = '22.13.0';
export const NODE_RECOMMENDED_MAJOR = 24;

/* Генерируемые столбцы появились в SQLite 3.31, на них держится ends_at. */
export const SQLITE_MIN = '3.31.0';

class EnvironmentError extends Error {
  constructor(message, hint) {
    super(hint ? `${message}\n\n  ${hint}` : message);
    this.name = 'EnvironmentError';
  }
}

function compare(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

/* Проверки, не требующие открытой базы. Вызываются до первого обращения к ней. */
export function checkRuntime() {
  const notes = [];
  const node = process.versions.node;

  if (compare(node, NODE_MIN) < 0) {
    throw new EnvironmentError(
      `Требуется Node.js ${NODE_MIN} или новее, установлен ${node}.`,
      'Модуль node:sqlite появился в 22.5.0 и перестал требовать флаг ' +
        '--experimental-sqlite только в 22.13.0. Рекомендуемая версия — 24 LTS, ' +
        'она указана в .nvmrc.'
    );
  }

  const major = Number(node.split('.')[0]);
  if (major !== NODE_RECOMMENDED_MAJOR) {
    notes.push(
      `Node ${node}: проект разрабатывался и проверялся на ${NODE_RECOMMENDED_MAJOR} LTS. ` +
        'Модуль node:sqlite имеет статус release candidate, его API может меняться между ' +
        'мажорными версиями — закрепите версию через .nvmrc или образ контейнера.'
    );
  }

  return notes;
}

/* node:sqlite можно собрать не во всякой сборке Node: официальные сборки его
   включают, но Node можно собрать с --without-sqlite, и некоторые пакеты
   дистрибутивов так и делают. Проверяем явно. */
export async function checkSqliteModule() {
  try {
    const mod = await import('node:sqlite');
    if (typeof mod.DatabaseSync !== 'function') {
      throw new EnvironmentError(
        'Модуль node:sqlite есть, но в нём нет DatabaseSync.',
        'Похоже на несовместимую версию Node. Требуется ' + NODE_MIN + ' или новее.'
      );
    }
    return mod;
  } catch (err) {
    if (err instanceof EnvironmentError) throw err;
    throw new EnvironmentError(
      'Модуль node:sqlite недоступен в этой сборке Node.js.',
      'Node можно собрать без поддержки SQLite (--without-sqlite), и часть пакетов ' +
        'дистрибутивов так собрана. Поставьте официальную сборку с nodejs.org ' +
        'или через nvm. Исходная ошибка: ' + err.message
    );
  }
}

/* Каталог базы должен существовать и быть доступен на запись: режиму WAL нужен
   не только сам файл, но и право создавать рядом файлы -wal и -shm. */
export function checkDataDirectory(file) {
  const dir = dirname(file);
  try {
    mkdirSync(dir, { recursive: true });
  } catch (err) {
    throw new EnvironmentError(
      `Не удалось создать каталог для базы: ${dir}`,
      'Проверьте права пользователя, от которого запущен сервис. Ошибка: ' + err.message
    );
  }

  try {
    accessSync(dir, constants.W_OK);
  } catch {
    throw new EnvironmentError(
      `Каталог базы недоступен на запись: ${dir}`,
      'Режиму WAL нужно создавать рядом с базой файлы -wal и -shm, поэтому права ' +
        'на запись нужны именно каталогу, а не только файлу базы. На файловой системе, ' +
        'смонтированной только для чтения, сервис работать не сможет.'
    );
  }

  try {
    if (statSync(file).size === 0) {
      return [`Файл базы ${file} пуст — схема появится при применении миграций.`];
    }
  } catch {
    return [`Файл базы ${file} ещё не создан — появится при применении миграций.`];
  }

  return [];
}

/* Проверки, требующие открытого соединения. */
export function checkConnection(db) {
  const notes = [];

  const sqlite = db.prepare('SELECT sqlite_version() AS v').get().v;
  if (compare(sqlite, SQLITE_MIN) < 0) {
    throw new EnvironmentError(
      `Требуется SQLite ${SQLITE_MIN} или новее, встроенная версия — ${sqlite}.`,
      'На генерируемых столбцах держится поле appointments.ends_at, а на нём — ' +
        'проверка пересечения записей.'
    );
  }

  if (db.prepare('PRAGMA foreign_keys').get().foreign_keys !== 1) {
    throw new EnvironmentError(
      'Не удалось включить проверку внешних ключей.',
      'В SQLite это настройка соединения, а не базы: без неё все ON DELETE ' +
        'и ссылочная целостность молча перестают работать.'
    );
  }

  const journal = db.prepare('PRAGMA journal_mode').get().journal_mode;
  if (journal !== 'wal') {
    notes.push(
      `Журнал в режиме ${journal}, а не WAL. Читатели будут блокировать писателя. ` +
        'Частая причина — база на сетевом диске: там WAL не включается и, что важнее, ' +
        'работать с базой по сети нельзя вовсе, файл повреждается.'
    );
  }

  return { sqlite, journal, notes };
}
