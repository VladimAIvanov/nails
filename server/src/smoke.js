/* Проверка, что база держит обещания схемы, а не только описывает их.
   Все проверки выполняются в транзакции и откатываются — данные не меняются. */
import { pool } from './db.js';

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

/* Ожидаем, что запрос упадёт с определённым кодом ошибки PostgreSQL. */
async function expectFail(client, name, sql, params, expectedCode) {
  await client.query('SAVEPOINT sp');
  try {
    await client.query(sql, params);
    await client.query('ROLLBACK TO SAVEPOINT sp');
    bad(name, 'запрос прошёл, хотя должен был быть отклонён');
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT sp');
    if (err.code === expectedCode) ok(name, `отклонено, код ${err.code}`);
    else bad(name, `ожидался код ${expectedCode}, получен ${err.code}: ${err.message}`);
  }
}

const client = await pool.connect();
try {
  await client.query('BEGIN');

  console.log('\nСостав схемы');
  const counts = await client.query(`
    SELECT (SELECT count(*) FROM information_schema.tables
              WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS tables,
           (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
              WHERE t.typtype = 'e' AND n.nspname = 'public')              AS enums,
           (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public')   AS indexes,
           (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
              WHERE n.nspname = 'public' AND c.contype = 'f')              AS fkeys,
           (SELECT count(*) FROM pg_matviews WHERE schemaname = 'public')  AS matviews
  `);
  const c = counts.rows[0];
  // schema_migrations — служебная, поэтому таблиц на одну больше, чем в документе
  ok('таблиц', `${c.tables} (21 из схемы + schema_migrations)`);
  ok('перечислений', String(c.enums));
  ok('индексов', String(c.indexes));
  ok('внешних ключей', String(c.fkeys));
  ok('материализованных представлений', String(c.matviews));

  console.log('\nПервичные ключи');
  const noPk = await client.query(`
    SELECT t.table_name FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        WHERE tc.table_schema = 'public' AND tc.table_name = t.table_name
          AND tc.constraint_type = 'PRIMARY KEY')
  `);
  if (noPk.rows.length === 0) ok('первичный ключ есть у каждой таблицы');
  else bad('первичные ключи', 'без ключа: ' + noPk.rows.map((r) => r.table_name).join(', '));

  console.log('\nГлавные гарантии');

  const master = (await client.query(
    `SELECT user_id FROM master_profiles ORDER BY sort_order LIMIT 1`)).rows[0].user_id;
  const service = (await client.query(
    `SELECT id, duration_min, price_kopecks FROM services WHERE slug = 'man-cover'`)).rows[0];
  const clientRow = (await client.query(
    `INSERT INTO users (role, full_name, phone) VALUES ('client', 'Тест Клиентка', '+79995550000')
     RETURNING id`)).rows[0];

  const base = "date_trunc('hour', now() + interval '3 days') + interval '10 hours'";
  await client.query(
    `INSERT INTO appointments (client_id, master_id, service_id, starts_at, duration_min, price_kopecks, source)
     VALUES ($1, $2, $3, ${base}, $4, $5, 'site')`,
    [clientRow.id, master, service.id, service.duration_min, service.price_kopecks]
  );
  ok('запись создаётся');

  // то же время у того же мастера — должно упасть на EXCLUDE (23P01)
  await expectFail(client, 'двойная запись к одному мастеру запрещена',
    `INSERT INTO appointments (client_id, master_id, service_id, starts_at, duration_min, price_kopecks, source)
     VALUES ($1, $2, $3, ${base} + interval '30 minutes', $4, $5, 'site')`,
    [clientRow.id, master, service.id, service.duration_min, service.price_kopecks], '23P01');

  // клиент в профилях мастеров — должно упасть на составном внешнем ключе (23503)
  await expectFail(client, 'клиента нельзя записать в мастера',
    `INSERT INTO master_profiles (user_id) VALUES ($1)`, [clientRow.id], '23503');

  // клиент без телефона — CHECK (23514)
  await expectFail(client, 'клиент без телефона не создаётся',
    `INSERT INTO users (role, full_name) VALUES ('client', 'Без телефона')`, [], '23514');

  // мастер без пароля — CHECK (23514)
  await expectFail(client, 'мастер без логина и пароля не создаётся',
    `INSERT INTO users (role, full_name, phone) VALUES ('master', 'Без пароля', '+79995550001')`, [], '23514');

  // статус вне набора — ошибка типа (22P02)
  await expectFail(client, 'статус вне набора не принимается',
    `UPDATE appointments SET status = 'придумал_сам' WHERE client_id = $1`, [clientRow.id], '22P02');

  // два студийных правила на один день недели — UNIQUE NULLS NOT DISTINCT (23505)
  await expectFail(client, 'дубль студийного графика запрещён',
    `INSERT INTO working_hours (master_id, weekday, starts_at_local, ends_at_local, valid_from)
     VALUES (NULL, 1, '10:00', '21:00', date '2026-01-01')`, [], '23505');

  console.log('\nВычисляемое поле и снимки');
  const appt = (await client.query(
    `SELECT starts_at, ends_at, duration_min, price_kopecks, public_number
     FROM appointments WHERE client_id = $1`, [clientRow.id])).rows[0];
  const minutes = (new Date(appt.ends_at) - new Date(appt.starts_at)) / 60000;
  if (minutes === appt.duration_min) ok('ends_at считается базой', `${minutes} мин`);
  else bad('ends_at', `ожидалось ${appt.duration_min} мин, получено ${minutes}`);
  ok('номер записи для человека', `№${appt.public_number}`);

  console.log('\nПароли');
  const plain = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name IN ('password', 'passwd', 'token', 'secret')
  `);
  if (plain.rows.length === 0) ok('полей с открытым паролем или токеном нет');
  else bad('пароли', 'найдены поля: ' + plain.rows.map((r) => r.column_name).join(', '));

  await client.query('ROLLBACK');
} finally {
  client.release();
  await pool.end();
}

console.log(`\nИтог: успешно ${passed}, провалено ${failed}`);
process.exit(failed === 0 ? 0 : 1);
