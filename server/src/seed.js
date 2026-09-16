/* Демонстрационные данные бьюти-студии «Ноготочки»: три мастера, шесть услуг,
   личные графики, блокировки для проверки расчёта окон, тексты лендинга.
   Скрипт идемпотентен — повторный запуск ничего не дублирует.

   Про пароли — см. комментарий ниже: у каждой учётной записи свой,
   случайный, и по умолчанию он нигде не показывается. */
import { db, transaction } from './db.js';
import { nowIso, toIso, localToUtc, utcToLocal, isoWeekday } from './time.js';
import { randomBytes } from 'node:crypto';
import { hashPassword } from './auth.js';
import * as env from './env.js';

/* Пароли демонстрационных учётных записей.

   Раньше здесь был один пароль на всех, и на локальном стенде это было
   удобно. Для опубликованного сервиса — нет: общий пароль, да ещё и
   напечатанный в README, означает, что войти администратором сможет любой,
   кто прочитал документацию.

   Теперь у каждой учётной записи свой случайный пароль. Он нигде не
   сохраняется и по умолчанию не печатается: на боевом сервере эти записи
   нужны как данные — мастера, к которым записываются, — а входить под ними
   не нужно никому.

   Для локального стенда список выводится по требованию:
   SEED_SHOW_PASSWORDS=true npm run seed
   Тогда пароли печатаются таблицей — их видно один раз, при загрузке. */
const showPasswords = env.flag('SEED_SHOW_PASSWORDS');

/* Пары «логин — пароль» для показа. Наполняется по ходу, печатается в конце
   и только если попросили. */
const issued = [];

/**
 * Случайный пароль для одной учётной записи.
 * @param {string} login по какому логину входить — телефон или почта
 */
function newPassword(login) {
  const value = randomBytes(12).toString('base64url');
  issued.push({ login, value });
  return hashPassword(value);
}


const CATEGORIES = [
  { slug: 'manicure',  title: 'Маникюр',     sort: 10 },
  { slug: 'pedicure',  title: 'Педикюр',     sort: 20 },
  { slug: 'extension', title: 'Наращивание', sort: 30 },
  { slug: 'design',    title: 'Дизайн',      sort: 40 },
  { slug: 'brows',     title: 'Брови',       sort: 50 }
];

/* Прайс студии. Цены в копейках, длительности в минутах — как в разделе 4.4
   схемы. Технический перерыв между записями не нужен, поэтому buffer: 0.

   Дизайн — дополнение к маникюру: 300 ₽ за два ногтя и 15–30 минут к визиту.
   В записи стоит верхняя граница, 30 минут: окно, рассчитанное с запасом,
   не наедет на следующую клиентку, а короткое — наехало бы. */
const SERVICES = [
  { slug: 'man-gel',    cat: 'manicure',  title: 'Маникюр с покрытием гель-лаком', desc: 'Покрытие гель-лаком',                     dur: 90,  price: 180000 },
  { slug: 'man-ped',    cat: 'pedicure',  title: 'Маникюр и педикюр',              desc: 'Маникюр и педикюр за один визит',         dur: 150, price: 320000 },
  { slug: 'ext',        cat: 'extension', title: 'Наращивание ногтей',             desc: null,                                      dur: 150, price: 280000 },
  { slug: 'design',     cat: 'design',    title: 'Дизайн ногтей',                  desc: '300 ₽ за два ногтя, добавляет к визиту 15–30 минут', dur: 30, price: 30000 },
  { slug: 'brow-tint',  cat: 'brows',     title: 'Коррекция и окрашивание бровей', desc: null,                                      dur: 40,  price: 120000 },
  { slug: 'brow-lam',   cat: 'brows',     title: 'Ламинирование бровей',           desc: null,                                      dur: 60,  price: 180000 }
];

/* Клиентки из тестовых данных проектной работы. Все три зарегистрированы:
   под двумя разными можно проверить конфликт за один слот. */
const CLIENTS = [
  { name: 'Ирина Петрова',  phone: '+79210000010', registered: true },
  { name: 'Ольга Соколова', phone: '+79210000011', registered: true },
  { name: 'Дарья Волкова',  phone: '+79210000012', registered: true }
];

/* Мастера. Специализации хранятся не текстом, а списком услуг — см. раздел 10.
   У каждого свой график: weekday по ISO, 1 — понедельник. */
const MASTERS = [
  { email: 'anna@nogotochkee.ru',   name: 'Анна Ковалева',  phone: '+79210000001', sort: 10,
    services: ['man-gel', 'man-ped', 'ext', 'design'],
    hours: { days: [2, 3, 4, 5], from: '10:00', to: '18:00' } },
  { email: 'marina@nogotochkee.ru', name: 'Марина Орлова',  phone: '+79210000002', sort: 20,
    services: ['brow-tint', 'brow-lam'],
    hours: { days: [3, 4, 5, 6], from: '11:00', to: '20:00' } },
  { email: 'elena@nogotochkee.ru',  name: 'Елена Смирнова', phone: '+79210000003', sort: 30,
    services: ['man-gel', 'ext', 'brow-tint', 'brow-lam'],
    hours: { days: [2, 4, 6], from: '10:00', to: '19:00' } }
];

/* Блокировки для проверки расчёта окон. Кладутся на ближайший такой день
   недели после сегодняшнего — повторный запуск сидов сдвигает их вперёд.
   Время местное, по часам студии. */
const TIME_OFF = [
  { master: 'anna@nogotochkee.ru',   weekday: 4, from: '13:00', to: '14:00', kind: 'break', reason: 'Обед' },
  { master: 'marina@nogotochkee.ru', weekday: 5, from: '15:00', to: '17:00', kind: 'other', reason: 'Личное время' },
  { master: 'elena@nogotochkee.ru',  weekday: 6, from: '00:00', to: '23:59', kind: 'other', reason: 'Выходной' }
];

/* Записи из тестовых данных проектной работы. week: 0 — ближайший такой день
   недели после сегодняшнего. Все подтверждены.
   Запись Ирины к Анне в 10:00 нужна для первого контрольного сценария:
   в этот день у Анны не должно быть окон, пересекающихся с 10:00–11:30. */
const APPOINTMENTS = [
  { client: 0, master: 'anna@nogotochkee.ru',   service: 'man-gel',  weekday: 3, week: 0, time: '10:00', status: 'confirmed', source: 'site' },
  { client: 1, master: 'marina@nogotochkee.ru', service: 'brow-lam', weekday: 4, week: 0, time: '12:00', status: 'confirmed', source: 'site' },
  { client: 2, master: 'elena@nogotochkee.ru',  service: 'ext',      weekday: 2, week: 0, time: '14:00', status: 'confirmed', source: 'site' }
];

/* Учётные записи сотрудников, которые заводят сиды. Всё остальное из демо-данных
   прежних версий — мастера и услуги не из этих списков — убирается. */
const ADMIN = { email: 'admin@nogotochkee.ru', phone: '+79210000000' };
const HIGHLIGHTS = [
  { slug: 'hl-sterility', icon: 'shield-check', title: 'Стерильность',       body: 'Инструмент проходит полную обработку, одноразовое вскрываем при вас' },
  { slug: 'hl-time',      icon: 'clock',        title: 'Только по записи',   body: 'Никаких очередей: время визита закреплено за вами' },
  { slug: 'hl-telegram',  icon: 'send',         title: 'Запись онлайн',      body: 'Услуга, мастер и свободное время — выбираете сами' },
  { slug: 'hl-materials', icon: 'sparkles',     title: 'Ногти и брови',      body: 'Маникюр, педикюр, наращивание и оформление бровей в одной студии' }
];

const masterByEmailId = (conn, email) =>
  conn.prepare('SELECT id FROM users WHERE email = ?').get(email).id;

/* Работы в портфолио. Фото — стоковые снимки с Unsplash под лицензией
   Unsplash, файлы в web/img/works по порядку списка; источники и авторы —
   web/img/CREDITS.md. Работа закреплена за мастером, который делает услугу. */
const WORKS = [
  { title: 'Нюд с втиркой',                  master: 'anna@nogotochkee.ru' },
  { title: 'Френч',                          master: 'elena@nogotochkee.ru' },
  { title: 'Матовое покрытие',               master: 'anna@nogotochkee.ru' },
  { title: 'Наращивание, форма миндаль',     master: 'elena@nogotochkee.ru' },
  { title: 'Дизайн с фольгой',               master: 'anna@nogotochkee.ru' },
  { title: 'Маникюр с покрытием гель-лаком', master: 'anna@nogotochkee.ru' },
  { title: 'Ламинирование бровей',           master: 'marina@nogotochkee.ru' },
  { title: 'Коррекция и окрашивание бровей', master: 'elena@nogotochkee.ru' },
  { title: 'Нюдовый маникюр',                master: 'elena@nogotochkee.ru' }
];

/* Дата ближайшего дня недели после сегодняшнего, по календарю студии.
   week сдвигает результат на целые недели. */
function nextWeekday(weekday, week, tz) {
  const today = utcToLocal(new Date(), tz).date;
  const day = new Date(`${today}T00:00:00Z`);
  do day.setUTCDate(day.getUTCDate() + 1);
  while (isoWeekday(day.toISOString().slice(0, 10)) !== weekday);
  day.setUTCDate(day.getUTCDate() + 7 * week);
  return day.toISOString().slice(0, 10);
}

transaction((conn) => {
  const tz = conn.prepare('SELECT timezone FROM studio_settings WHERE id = 1').get().timezone;

  /* Записи уходят первыми: на услуги и мастеров прошлой версии они ссылаются
     с запретом удаления, и чистка ниже иначе упёрлась бы в них. */
  conn.prepare('DELETE FROM appointment_status_log').run();
  conn.prepare('DELETE FROM appointments').run();

  const upsertCategory = conn.prepare(`
    INSERT INTO service_categories (slug, title, sort_order) VALUES (?, ?, ?)
    ON CONFLICT (slug) DO UPDATE SET title = excluded.title, sort_order = excluded.sort_order
  `);
  for (const c of CATEGORIES) upsertCategory.run(c.slug, c.title, c.sort);

  const upsertService = conn.prepare(`
    INSERT INTO services (category_id, slug, title, description, duration_min, duration_is_from,
                          price_kopecks, price_is_from, buffer_after_min, badge,
                          is_online_bookable, sort_order)
    VALUES ((SELECT id FROM service_categories WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, 0, NULL, 1, ?)
    ON CONFLICT (slug) DO UPDATE SET
      category_id = excluded.category_id, title = excluded.title,
      description = excluded.description, duration_min = excluded.duration_min,
      duration_is_from = excluded.duration_is_from, price_kopecks = excluded.price_kopecks,
      price_is_from = excluded.price_is_from, buffer_after_min = 0, badge = NULL,
      is_active = 1, is_online_bookable = 1, sort_order = excluded.sort_order
  `);
  for (const [i, s] of SERVICES.entries()) {
    upsertService.run(s.cat, s.slug, s.title, s.desc, s.dur, s.durFrom ?? 0,
      s.price, s.priceFrom ?? 0, (i + 1) * 10);
  }
  conn.prepare('UPDATE services SET updated_at = ?').run(nowIso());

  const upsertUser = conn.prepare(`
    INSERT INTO users (role, full_name, email, phone, password_hash, password_changed_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (email) DO UPDATE SET
      full_name = excluded.full_name,
      phone = excluded.phone,
      is_active = 1,
      /* Пароль перезаписывается и при повторном запуске — иначе список,
         который печатает SEED_SHOW_PASSWORDS, врал бы: пароли сгенерированы,
         показаны, но в базу не попали. Напечатанное должно работать. */
      password_hash = excluded.password_hash,
      password_changed_at = excluded.password_changed_at
  `);
  const findUser = conn.prepare('SELECT id FROM users WHERE email = ?');

  // ── Демо-данные прежних версий ────────────────────────────────────────────
  /* Удаление по одной строке: неудача одной не должна мешать остальным.
     Отказ внешнего ключа в SQLite отменяет только эту инструкцию. Где удалить
     нельзя — на строку ссылаются данные, созданные вручную, — она отключается:
     при записи её не видно, а в истории она сохраняется. */
  const retire = (table, where, value) => {
    try {
      conn.prepare(`DELETE FROM ${table} WHERE ${where} = ?`).run(value);
    } catch {
      conn.prepare(`UPDATE ${table} SET is_active = 0 WHERE ${where} = ?`).run(value);
    }
  };

  const serviceSlugs = new Set(SERVICES.map((s) => s.slug));
  for (const { slug } of conn.prepare('SELECT slug FROM services').all()) {
    if (!serviceSlugs.has(slug)) retire('services', 'slug', slug);
  }

  const staff = [ADMIN, ...MASTERS];
  const staffEmails = new Set(staff.map((s) => s.email));
  const stale = conn.prepare(`
    SELECT u.id FROM master_profiles mp JOIN users u ON u.id = mp.user_id
     WHERE u.email IS NULL OR u.email NOT IN (${staff.map(() => '?').join(', ')})
  `).all(...staffEmails);
  /* Телефоны сотрудников уникальны: если номер из сидов занят чужой служебной
     учётной записью, это прежний демо-сотрудник, и он тоже уходит. */
  const phoneTaken = conn.prepare(`
    SELECT id FROM users WHERE phone = ? AND role IN ('admin', 'master') AND (email IS NULL OR email <> ?)
  `);
  for (const s of staff) stale.push(...phoneTaken.all(s.phone, s.email));

  for (const { id } of stale) {
    conn.prepare('UPDATE users SET phone = NULL WHERE id = ?').run(id);
    retire('users', 'id', id);
  }
  // Администратор студии: роль admin, профиль мастера ему не заводится.
  upsertUser.run('admin', 'Администратор студии', ADMIN.email,
    ADMIN.phone, newPassword(ADMIN.email), nowIso());
  const ownerId = findUser.get(ADMIN.email).id;
  conn.prepare('UPDATE studio_settings SET owner_user_id = ? WHERE id = 1').run(ownerId);

  /* Мастера работают по личному графику, а не по часам студии: у каждого
     свои дни и своё время внутри вторника–субботы 10:00–20:00. */
  const upsertProfile = conn.prepare(`
    INSERT INTO master_profiles (user_id, sort_order, uses_studio_hours) VALUES (?, ?, 0)
    ON CONFLICT (user_id) DO UPDATE SET sort_order = excluded.sort_order, uses_studio_hours = 0,
                                        accepts_online_booking = 1
  `);
  const clearServices = conn.prepare('DELETE FROM master_services WHERE master_id = ?');
  const linkService = conn.prepare(`
    INSERT INTO master_services (master_id, service_id)
    VALUES (?, (SELECT id FROM services WHERE slug = ?))
  `);
  const clearHours = conn.prepare('DELETE FROM working_hours WHERE master_id = ?');
  const addHours = conn.prepare(`
    INSERT INTO working_hours (master_id, weekday, starts_at_local, ends_at_local, valid_from)
    VALUES (?, ?, ?, ?, '2026-01-01')
  `);

  for (const m of MASTERS) {
    upsertUser.run('master', m.name, m.email, m.phone, newPassword(m.email), nowIso());
    const id = findUser.get(m.email).id;
    upsertProfile.run(id, m.sort);
    clearServices.run(id);
    for (const slug of m.services) linkService.run(id, slug);
    clearHours.run(id);
    for (const day of m.hours.days) addHours.run(id, day, m.hours.from, m.hours.to);
  }

  const upsertBlock = conn.prepare(`
    INSERT INTO content_blocks (slug, section, icon, title, body, image_url, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (slug) DO UPDATE SET
      title = excluded.title, body = excluded.body, image_url = excluded.image_url,
      updated_at = excluded.updated_at
  `);
  for (const [i, h] of HIGHLIGHTS.entries()) {
    upsertBlock.run(h.slug, 'highlights', h.icon, h.title, h.body, null, (i + 1) * 10);
  }
  upsertBlock.run('hero-photo', 'hero', null, 'Маникюр и брови по записи',
    'Небольшая студия маникюра и оформления бровей. Работаем со вторника по субботу, с 10:00 до 20:00.',
    '/img/hero.jpg', 10);
  conn.prepare('UPDATE content_blocks SET updated_at = ?').run(nowIso());

  conn.prepare('DELETE FROM portfolio_works').run();
  const addWork = conn.prepare(`
    INSERT INTO portfolio_works (master_id, image_url, title, sort_order) VALUES (?, ?, ?, ?)
  `);
  for (const [i, w] of WORKS.entries()) {
    addWork.run(masterByEmailId(conn, w.master), `/img/works/${i + 1}.jpg`, w.title, (i + 1) * 10);
  }

  // ── Клиентки ──────────────────────────────────────────────────────────────
  const upsertClient = conn.prepare(`
    INSERT INTO users (role, full_name, phone, password_hash, password_changed_at)
    VALUES ('client', ?, ?, ?, ?)
    ON CONFLICT (phone) DO UPDATE SET
      full_name = excluded.full_name,
      password_hash = excluded.password_hash,
      password_changed_at = excluded.password_changed_at
  `);
  const findByPhone = conn.prepare('SELECT id FROM users WHERE phone = ?');
  const addPrefs = conn.prepare(
    'INSERT INTO notification_prefs (user_id) VALUES (?) ON CONFLICT (user_id) DO NOTHING'
  );
  const clientIds = [];
  for (const c of CLIENTS) {
    upsertClient.run(c.name, c.phone, c.registered ? newPassword(c.phone) : null,
      c.registered ? nowIso() : null);
    const id = findByPhone.get(c.phone).id;
    addPrefs.run(id); // как после регистрации: иначе каналы связи не определены
    clientIds.push(id);
  }

  // Согласие на обработку данных даётся при первой записи
  conn.prepare('DELETE FROM consents').run();
  const addConsent = conn.prepare(`
    INSERT INTO consents (user_id, kind, is_granted, document_version, source)
    VALUES (?, 'personal_data', 1, 'v1', 'site')
  `);
  for (const id of clientIds) addConsent.run(id);

  // ── Блокировки времени ────────────────────────────────────────────────────
  conn.prepare('DELETE FROM time_off').run();
  const addTimeOff = conn.prepare(`
    INSERT INTO time_off (master_id, starts_at, ends_at, kind, reason, created_by_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const t of TIME_OFF) {
    const date = nextWeekday(t.weekday, 0, tz);
    addTimeOff.run(
      masterByEmailId(conn, t.master),
      toIso(localToUtc(date, t.from, tz)), toIso(localToUtc(date, t.to, tz)),
      t.kind, t.reason, ownerId
    );
  }

  /* ── Записи ────────────────────────────────────────────────────────────────
     Единственное место вне services/appointments.js, где записи попадают
     в базу напрямую, и это сделано осознанно: сиды создают историю —
     состоявшиеся и отменённые визиты в прошлом. Через обычное создание записи
     такие строки не завести, оно справедливо не пускает в прошлое.

     Защита при этом не обходится: триггеры в базе срабатывают и здесь,
     проверено прямой вставкой поверх занятого времени. */
  const serviceBySlug = conn.prepare(
    'SELECT id, duration_min, price_kopecks FROM services WHERE slug = ?'
  );
  const addAppointment = conn.prepare(`
    INSERT INTO appointments (client_id, master_id, service_id, starts_at,
                              duration_min, price_kopecks, status, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const addLog = conn.prepare(`
    INSERT INTO appointment_status_log (appointment_id, from_status, to_status, comment)
    VALUES (?, NULL, ?, 'создано при загрузке тестовых данных')
  `);

  for (const a of APPOINTMENTS) {
    const startsAt = localToUtc(nextWeekday(a.weekday, a.week, tz), a.time, tz);
    const svc = serviceBySlug.get(a.service);

    addAppointment.run(clientIds[a.client], masterByEmailId(conn, a.master), svc.id,
      toIso(startsAt), svc.duration_min, svc.price_kopecks, a.status, a.source);
    const id = conn.prepare('SELECT last_insert_rowid() AS id').get().id;
    addLog.run(id, a.status);
  }
});

const c = db.prepare(`
  SELECT (SELECT COUNT(*) FROM users)           AS users,
         (SELECT COUNT(*) FROM master_profiles) AS masters,
         (SELECT COUNT(*) FROM services)        AS services,
         (SELECT COUNT(*) FROM master_services) AS links,
         (SELECT COUNT(*) FROM working_hours)   AS hours,
         (SELECT COUNT(*) FROM content_blocks)  AS blocks,
         (SELECT COUNT(*) FROM portfolio_works) AS works,
         (SELECT COUNT(*) FROM appointments)    AS appts,
         (SELECT COUNT(*) FROM users WHERE role = 'client') AS clients
`).get();

console.log('Сиды загружены:');
console.log(`  пользователей ${c.users} (клиентов ${c.clients}, мастеров ${c.masters}, администратор 1)`);
console.log(`  услуг ${c.services}, связей мастер-услуга ${c.links}, интервалов графика ${c.hours}`);
console.log(`  записей ${c.appts}, блоков лендинга ${c.blocks}, работ в портфолио ${c.works}`);
if (showPasswords) {
  console.log('\n  Пароли учётных записей стенда — у каждой свой, показываются один раз:');
  const pad = Math.max(...issued.map((i) => i.login.length));
  for (const { login, value } of issued) console.log(`    ${login.padEnd(pad)}  ${value}`);
} else {
  console.log('\n  У каждой учётной записи свой случайный пароль, он нигде не сохранён.');
  console.log('  Войти под демо-записями нельзя — для боевого сервера так и нужно.');
  console.log('  Для локального стенда: SEED_SHOW_PASSWORDS=true npm run seed');
}

db.close();




