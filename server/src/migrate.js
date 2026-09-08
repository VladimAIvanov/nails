/* Команда `npm run migrate`. Сама работа — в src/migrations.js: её же
   выполняет сервер при запуске, чтобы на сервере не требовалось набирать
   эту команду руками. Здесь остались только печать хода и закрытие базы. */
import { db, dbFile } from './db.js';
import { applyMigrations } from './migrations.js';

console.log(`База: ${dbFile}`);

const { applied, total } = applyMigrations({
  onEach: (file) => process.stdout.write(`  ${file} ... `),
  onDone: (_file, rebuildsTable) =>
    console.log(rebuildsTable ? 'готово (пересборка таблицы)' : 'готово')
});

if (applied.length === 0) {
  console.log(`Миграции: нечего применять, все ${total} уже накачены.`);
} else {
  console.log(`Применено миграций: ${applied.length}.`);
}

db.close();
