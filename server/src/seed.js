/* Демонстрационные данные из прототипа: три мастера, десять услуг, портфолио,
   тексты лендинга. Скрипт идемпотентен — повторный запуск ничего не дублирует.

   Про пароли — см. комментарий ниже: у каждой учётной записи свой,
   случайный, и по умолчанию он нигде не показывается. */
import { db, transaction } from './db.js';
import { nowIso, toIso } from './time.js';
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
  { slug: 'manicure', title: 'Маникюр', sort: 10 },
  { slug: 'pedicure', title: 'Педикюр', sort: 20 },
  { slug: 'extension', title: 'Наращивание', sort: 30 },
  { slug: 'design', title: 'Дизайн', sort: 40 }
];

/* Цены в копейках, длительности в минутах — как в разделе 4.4 схемы.
   Значения взяты из site/assets/varvara-data.js. */
const SERVICES = [
  { slug: 'man-cover', cat: 'manicure',  title: 'Маникюр с покрытием',  desc: 'Аппаратный, гель-лак',          dur: 90,  price: 320000, buffer: 15 },
  { slug: 'man',       cat: 'manicure',  title: 'Маникюр без покрытия', desc: 'Аппаратный, уход за кутикулой', dur: 50,  price: 190000, buffer: 15 },
  { slug: 'ext',       cat: 'extension', title: 'Наращивание',          desc: 'Гель, форма и длина на выбор',  dur: 180, price: 550000, buffer: 20, priceFrom: 1, badge: 'хит' },
  { slug: 'ped',       cat: 'pedicure',  title: 'Педикюр с покрытием',  desc: 'Медицинский аппаратный',        dur: 100, price: 380000, buffer: 20 },
  { slug: 'design',    cat: 'design',    title: 'Дизайн ногтей',        desc: 'Френч, втирка, стемпинг',       dur: 20,  price: 60000,  buffer: 5,  priceFrom: 1, durFrom: 1 },
  { slug: 'repair',    cat: 'manicure',  title: 'Ремонт ногтя',         desc: null,                            dur: 15,  price: 40000,  buffer: 5,  online: 0 },
  { slug: 'removal',   cat: 'manicure',  title: 'Снятие покрытия',      desc: 'Аппаратное, без повреждения',   dur: 30,  price: 70000,  buffer: 10 },
  { slug: 'ped-clean', cat: 'pedicure',  title: 'Педикюр без покрытия', desc: 'Медицинский аппаратный',        dur: 70,  price: 290000, buffer: 20 },
  { slug: 'strength',  cat: 'manicure',  title: 'Укрепление гелем',     desc: 'Под гель-лак, для тонких ногтей', dur: 40, price: 120000, buffer: 10 },
  { slug: 'paraffin',  cat: 'pedicure',  title: 'Парафинотерапия',      desc: 'Руки или стопы, уход',          dur: 35,  price: 150000, buffer: 10 }
];

/* Клиентки из прототипа. Марина зарегистрирована и заходит в кабинет,
   Ольга и Ирина записались как гости — у них пароля нет вовсе. */
const CLIENTS = [
  { name: 'Марина Ковалёва', phone: '+79210000010', registered: true },
  { name: 'Ольга Петрова',   phone: '+79210000011', registered: false },
  { name: 'Ирина Соколова',  phone: '+79210000012', registered: false }
];

/* Блокировки времени: перерыв на обед и отпуск. Вычитаются из графика
   наравне с записями, но это не записи — клиента за ними нет. */
const TIME_OFF = [
  { master: 'varvara@varvara.studio', dayOffset: 2, time: '12:00', minutes: 45, kind: 'break',    reason: 'Обед' },
  { master: 'lena@varvara.studio',    dayOffset: 3, time: '12:30', minutes: 45, kind: 'break',    reason: 'Обед' },
  { master: 'aya@varvara.studio',     dayOffset: 5, time: '07:00', minutes: 720, kind: 'vacation', reason: 'Отпуск' }
];

/* Записи: ближайшие и история, разные мастера, статусы и источники.
   Времена разведены так, чтобы не сработал запрет пересечения. */
const APPOINTMENTS = [
  { client: 0, master: 'varvara@varvara.studio', service: 'man-cover', dayOffset: 2,  time: '10:00', status: 'confirmed', source: 'site' },
  { client: 1, master: 'varvara@varvara.studio', service: 'ext',       dayOffset: 2,  time: '13:00', status: 'pending',   source: 'telegram' },
  { client: 2, master: 'lena@varvara.studio',    service: 'ped',       dayOffset: 3,  time: '11:00', status: 'confirmed', source: 'site' },
  { client: 0, master: 'aya@varvara.studio',     service: 'design',    dayOffset: -7, time: '15:00', status: 'done',      source: 'telegram' },
  { client: 1, master: 'lena@varvara.studio',    service: 'man',       dayOffset: -3, time: '14:00', status: 'cancelled', source: 'admin' }
];

/* Специализации мастеров хранятся не текстом, а списком услуг — см. раздел 10.

   Каждая услуга прайса закреплена хотя бы за одним действующим мастером.
   Иначе она видна в каталоге, но записаться на неё не к кому: человек
   выбирает услугу и только на следующем шаге узнаёт, что её никто не делает.
   Прайс без исполнителя — законная ситуация для настоящей студии (мастер
   уволился, новый не нанят), но в демонстрационных данных это выглядит
   поломкой сервиса, а не жизнью студии. */
const MASTERS = [
  { email: 'varvara@varvara.studio', name: 'Варвара', phone: '+79210000001', sort: 10,
    alsoAdmin: true,
    services: ['man-cover', 'man', 'ext', 'design', 'repair', 'removal', 'strength'] },
  { email: 'lena@varvara.studio',    name: 'Лена',    phone: '+79210000002', sort: 20,
    services: ['ped', 'man-cover', 'man', 'ped-clean', 'paraffin', 'removal'] },
  { email: 'aya@varvara.studio',     name: 'Ая',      phone: '+79210000003', sort: 30,
    services: ['design', 'ext', 'strength'] }
];

const HIGHLIGHTS = [
  { slug: 'hl-sterility', icon: 'shield-check', title: 'Стерильность',      body: 'Автоклав, одноразовые файлы, всё вскрываем при вас' },
  { slug: 'hl-time',      icon: 'clock',        title: 'Честное время',     body: 'В записи стоит реальная длительность, без «подождите ещё час»' },
  { slug: 'hl-telegram',  icon: 'send',         title: 'Запись в Telegram', body: 'Бот подтверждает окно и напоминает за два часа' },
  { slug: 'hl-materials', icon: 'sparkles',     title: 'Свои материалы',    body: 'Гель-лаки и базы, с которыми носится 4 недели' }
];

const masterByEmailId = (conn, email) =>
  conn.prepare('SELECT id FROM users WHERE email = ?').get(email).id;

const WORKS = [
  'Нюд с втиркой', 'Френч', 'Матовое покрытие',
  'Наращивание, форма миндаль', 'Дизайн с фольгой', 'Педикюр'
];

transaction((conn) => {
  const upsertCategory = conn.prepare(`
    INSERT INTO service_categories (slug, title, sort_order) VALUES (?, ?, ?)
    ON CONFLICT (slug) DO UPDATE SET title = excluded.title, sort_order = excluded.sort_order
  `);
  for (const c of CATEGORIES) upsertCategory.run(c.slug, c.title, c.sort);

  const upsertService = conn.prepare(`
    INSERT INTO services (category_id, slug, title, description, duration_min, duration_is_from,
                          price_kopecks, price_is_from, buffer_after_min, badge,
                          is_online_bookable, sort_order)
    VALUES ((SELECT id FROM service_categories WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (slug) DO UPDATE SET
      title = excluded.title, description = excluded.description,
      duration_min = excluded.duration_min, price_kopecks = excluded.price_kopecks,
      buffer_after_min = excluded.buffer_after_min, updated_at = excluded.updated_at
  `);
  for (const [i, s] of SERVICES.entries()) {
    upsertService.run(s.cat, s.slug, s.title, s.desc, s.dur, s.durFrom ?? 0,
      s.price, s.priceFrom ?? 0, s.buffer, s.badge ?? null, s.online ?? 1, (i + 1) * 10);
  }
  conn.prepare('UPDATE services SET updated_at = ?').run(nowIso());

  const upsertUser = conn.prepare(`
    INSERT INTO users (role, full_name, email, phone, password_hash, password_changed_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (email) DO UPDATE SET
      full_name = excluded.full_name,
      /* Пароль перезаписывается и при повторном запуске — иначе список,
         который печатает SEED_SHOW_PASSWORDS, врал бы: пароли сгенерированы,
         показаны, но в базу не попали. Напечатанное должно работать. */
      password_hash = excluded.password_hash,
      password_changed_at = excluded.password_changed_at
  `);
  const findUser = conn.prepare('SELECT id FROM users WHERE email = ?');

  // Владелица: роль admin, отдельный профиль мастера ей не заводится.
  upsertUser.run('admin', 'Варвара Администратор', 'admin@varvara.studio',
    '+79210000000', newPassword('admin@varvara.studio'), nowIso());
  const ownerId = findUser.get('admin@varvara.studio').id;
  conn.prepare('UPDATE studio_settings SET owner_user_id = ? WHERE id = 1').run(ownerId);

  const upsertProfile = conn.prepare(`
    INSERT INTO master_profiles (user_id, sort_order, uses_studio_hours) VALUES (?, ?, 1)
    ON CONFLICT (user_id) DO UPDATE SET sort_order = excluded.sort_order
  `);
  const clearServices = conn.prepare('DELETE FROM master_services WHERE master_id = ?');
  const linkService = conn.prepare(`
    INSERT INTO master_services (master_id, service_id)
    VALUES (?, (SELECT id FROM services WHERE slug = ?))
  `);

  /* Ровно тот случай, ради которого заведена таблица user_roles: владелица
     студии сама принимает клиенток. Основная роль остаётся master — на неё
     опирается внешний ключ master_profiles, — а admin добавляется списком.
     Без этой строки демо-данные показывали обратное тому, что написано
     в миграции 007: двух разных людей вместо одного с двумя ролями. */
  const grantRole = conn.prepare(`
    INSERT INTO user_roles (user_id, role) VALUES (?, ?) ON CONFLICT DO NOTHING
  `);

  for (const m of MASTERS) {
    upsertUser.run('master', m.name, m.email, m.phone, newPassword(m.email), nowIso());
    const id = findUser.get(m.email).id;
    if (m.alsoAdmin) grantRole.run(id, 'admin');
    upsertProfile.run(id, m.sort);
    clearServices.run(id);
    for (const slug of m.services) linkService.run(id, slug);
  }

  const upsertBlock = conn.prepare(`
    INSERT INTO content_blocks (slug, section, icon, title, body, image_url, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (slug) DO UPDATE SET
      title = excluded.title, body = excluded.body, updated_at = excluded.updated_at
  `);
  for (const [i, h] of HIGHLIGHTS.entries()) {
    upsertBlock.run(h.slug, 'highlights', h.icon, h.title, h.body, null, (i + 1) * 10);
  }
  upsertBlock.run('hero-photo', 'hero', null, 'Аккуратные ногти без спешки',
    'Маникюр, педикюр и наращивание в маленькой студии на четыре кресла.',
    '/img/hero.jpg', 10);
  conn.prepare('UPDATE content_blocks SET updated_at = ?').run(nowIso());

  const masterIds = conn.prepare(
    'SELECT user_id FROM master_profiles ORDER BY sort_order'
  ).all().map((r) => r.user_id);

  conn.prepare('DELETE FROM portfolio_works').run();
  const addWork = conn.prepare(`
    INSERT INTO portfolio_works (master_id, image_url, title, sort_order) VALUES (?, ?, ?, ?)
  `);
  for (const [i, title] of WORKS.entries()) {
    addWork.run(masterIds[i % masterIds.length], `/img/works/${i + 1}.jpg`, title, (i + 1) * 10);
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
    const day = new Date();
    day.setUTCDate(day.getUTCDate() + t.dayOffset);
    const [h, m] = t.time.split(':');
    day.setUTCHours(Number(h), Number(m), 0, 0);
    const startsAt = toIso(day);
    addTimeOff.run(
      masterByEmailId(conn, t.master), startsAt,
      toIso(new Date(day.getTime() + t.minutes * 60_000)),
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
  conn.prepare('DELETE FROM appointment_status_log').run();
  conn.prepare('DELETE FROM appointments').run();

  const masterByEmail = conn.prepare('SELECT id FROM users WHERE email = ?');
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
    const day = new Date();
    day.setUTCDate(day.getUTCDate() + a.dayOffset);
    const [h, m] = a.time.split(':');
    day.setUTCHours(Number(h), Number(m), 0, 0);

    const svc = serviceBySlug.get(a.service);
    const masterId = masterByEmail.get(a.master).id;

    addAppointment.run(clientIds[a.client], masterId, svc.id, toIso(day),
      svc.duration_min, svc.price_kopecks, a.status, a.source);
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
console.log(`  пользователей ${c.users} (клиентов ${c.clients}, мастеров ${c.masters}, владелица 1)`);
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




