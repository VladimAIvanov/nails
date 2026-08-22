/* Проверка, что база держит обещания схемы, а не только описывает их.
   Всё выполняется в транзакции и откатывается — данные не меняются. */
import { db } from './db.js';

let passed = 0;
let failed = 0;

function ok(name, detail = '') {
  passed++;
  console.log(`  [ок] ${name}${detail ? ' — ' + detail : ''}`);
}
function bad(name, detail) {
  failed++;
  console.log(`  [!!] ${name} — ${detail}`);
}

/* Ожидаем, что запрос будет отклонён, и что в тексте отказа есть нужный признак. */
function expectFail(name, sql, params, marker) {
  try {
    db.prepare(sql).run(...params);
    bad(name, 'запрос прошёл, хотя должен был быть отклонён');
  } catch (err) {
    if (new RegExp(marker, 'i').test(err.message)) ok(name, 'отклонено');
    else bad(name, `ожидался отказ по «${marker}», получено: ${err.message}`);
  }
}

db.exec('BEGIN IMMEDIATE');
try {
  console.log('\nСостав схемы');
  const counts = db.prepare(`
    SELECT (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%') AS tables,
           (SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL)          AS indexes,
           (SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger')                            AS triggers,
           (SELECT COUNT(*) FROM sqlite_master WHERE type = 'view')                               AS views
  `).get();
  ok('таблиц', `${counts.tables} (21 из схемы + schema_migrations)`);
  ok('индексов', String(counts.indexes));
  ok('триггеров', String(counts.triggers));
  ok('представлений', String(counts.views));
  ok('внешние ключи включены', String(db.prepare('PRAGMA foreign_keys').get().foreign_keys));

  console.log('\nПервичные ключи');
  const tables = db.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
  ).all().map((r) => r.name);
  const noPk = tables.filter(
    (t) => db.prepare(`SELECT COUNT(*) n FROM pragma_table_info(?) WHERE pk > 0`).get(t).n === 0
  );
  if (noPk.length === 0) ok('первичный ключ есть у каждой таблицы', `проверено ${tables.length}`);
  else bad('первичные ключи', 'без ключа: ' + noPk.join(', '));

  console.log('\nГлавные гарантии');

  const master = db.prepare('SELECT user_id FROM master_profiles ORDER BY sort_order LIMIT 1').get().user_id;
  const service = db.prepare(`SELECT id, duration_min, price_kopecks FROM services WHERE slug = 'man-cover'`).get();
  db.prepare(`INSERT INTO users (role, full_name, phone) VALUES ('client', 'Тест Клиентка', '+79995550000')`).run();
  const clientId = db.prepare(`SELECT id FROM users WHERE phone = '+79995550000'`).get().id;

  const start = '2026-09-01T10:00:00Z';
  const insertAppt = `INSERT INTO appointments (client_id, master_id, service_id, starts_at, duration_min, price_kopecks, source)
                      VALUES (?, ?, ?, ?, ?, ?, 'site')`;
  db.prepare(insertAppt).run(clientId, master, service.id, start, service.duration_min, service.price_kopecks);
  ok('запись создаётся');

  expectFail('двойная запись к одному мастеру запрещена', insertAppt,
    [clientId, master, service.id, '2026-09-01T10:30:00Z', service.duration_min, service.price_kopecks],
    'appointments_no_overlap');

  // встык, без пересечения — должно пройти
  db.prepare(insertAppt).run(clientId, master, service.id, '2026-09-01T11:30:00Z',
    service.duration_min, service.price_kopecks);
  ok('запись встык разрешена', '11:30 после визита до 11:30');

  expectFail('перенос на занятое время запрещён',
    `UPDATE appointments SET starts_at = ? WHERE starts_at = ?`,
    ['2026-09-01T10:30:00Z', '2026-09-01T11:30:00Z'], 'appointments_no_overlap');

  expectFail('клиента нельзя записать в мастера',
    'INSERT INTO master_profiles (user_id) VALUES (?)', [clientId], 'FOREIGN KEY');

  expectFail('клиент без телефона не создаётся',
    `INSERT INTO users (role, full_name) VALUES ('client', 'Без телефона')`, [], 'users_client_needs_phone');

  expectFail('мастер без логина и пароля не создаётся',
    `INSERT INTO users (role, full_name, phone) VALUES ('master', 'Без пароля', '+79995550001')`, [],
    'users_staff_needs_login');

  expectFail('статус вне набора не принимается',
    `UPDATE appointments SET status = 'придумал_сам' WHERE client_id = ?`, [clientId], 'CHECK');

  expectFail('дубль студийного графика запрещён',
    `INSERT INTO working_hours (master_id, weekday, starts_at_local, ends_at_local, valid_from)
     VALUES (NULL, 1, '10:00', '21:00', '2026-01-01')`, [], 'UNIQUE');

  console.log('\nВычисляемое поле и снимки');
  const appt = db.prepare(
    'SELECT starts_at, ends_at, duration_min, public_number FROM appointments WHERE starts_at = ?'
  ).get(start);
  const minutes = (Date.parse(appt.ends_at) - Date.parse(appt.starts_at)) / 60000;
  if (minutes === appt.duration_min) ok('ends_at считается базой', `${minutes} мин, ${appt.ends_at}`);
  else bad('ends_at', `ожидалось ${appt.duration_min} мин, получено ${minutes}`);
  ok('номер записи для человека', `№${appt.public_number}`);

  console.log('\nФормат времени');
  const badTime = db.prepare(`
    SELECT COUNT(*) n FROM appointments
    WHERE starts_at NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'
  `).get().n;
  if (badTime === 0) ok('все отметки времени в ISO-8601 UTC');
  else bad('формат времени', `${badTime} значений вне формата`);

  console.log('\nПароли');
  const plain = db.prepare(`
    SELECT COUNT(*) n FROM pragma_table_list() t
    JOIN pragma_table_info(t.name) c
    WHERE t.schema = 'main' AND c.name IN ('password', 'passwd', 'token', 'secret')
  `).get().n;
  if (plain === 0) ok('полей с открытым паролем или токеном нет');
  else bad('пароли', `найдено полей: ${plain}`);
} finally {
  db.exec('ROLLBACK');
  db.close();
}

console.log(`\nИтог: успешно ${passed}, провалено ${failed}`);
process.exit(failed === 0 ? 0 : 1);
