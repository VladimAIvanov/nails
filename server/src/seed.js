/* Демонстрационные данные из прототипа: три мастера, шесть услуг, портфолио,
   тексты лендинга. Скрипт идемпотентен — повторный запуск ничего не дублирует.

   Пароли мастеров и администратора здесь демонстрационные и заданы одной
   константой ниже: это локальный стенд, а не рабочая установка. */
import { scrypt as scryptCb, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { pool, withTransaction } from './db.js';

const scrypt = promisify(scryptCb);
const DEMO_PASSWORD = 'varvara-demo';

async function hashPassword(plain) {
  const salt = randomBytes(16);
  const key = await scrypt(plain, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
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
  { slug: 'man-cover', cat: 'manicure',  title: 'Маникюр с покрытием',   desc: 'Аппаратный, гель-лак',            dur: 90,  price: 320000, buffer: 15 },
  { slug: 'man',       cat: 'manicure',  title: 'Маникюр без покрытия',  desc: 'Аппаратный, уход за кутикулой',   dur: 50,  price: 190000, buffer: 15 },
  { slug: 'ext',       cat: 'extension', title: 'Наращивание',           desc: 'Гель, форма и длина на выбор',    dur: 180, price: 550000, buffer: 20, priceFrom: true, badge: 'хит' },
  { slug: 'ped',       cat: 'pedicure',  title: 'Педикюр с покрытием',   desc: 'Медицинский аппаратный',          dur: 100, price: 380000, buffer: 20 },
  { slug: 'design',    cat: 'design',    title: 'Дизайн ногтей',         desc: 'Френч, втирка, стемпинг',         dur: 20,  price: 60000,  buffer: 5, priceFrom: true, durFrom: true },
  { slug: 'repair',    cat: 'manicure',  title: 'Ремонт ногтя',          desc: null,                              dur: 15,  price: 40000,  buffer: 5, online: false }
];

/* Специализации мастеров хранятся не текстом, а списком услуг — см. раздел 10. */
const MASTERS = [
  { email: 'varvara@varvara.studio', name: 'Варвара', phone: '+79210000001', sort: 10, services: ['man-cover', 'man', 'ext', 'design', 'repair'] },
  { email: 'lena@varvara.studio',    name: 'Лена',    phone: '+79210000002', sort: 20, services: ['ped', 'man-cover', 'man'] },
  { email: 'aya@varvara.studio',     name: 'Ая',      phone: '+79210000003', sort: 30, services: ['design', 'ext'] }
];

const HIGHLIGHTS = [
  { slug: 'hl-sterility', icon: 'shield-check', title: 'Стерильность',      body: 'Автоклав, одноразовые файлы, всё вскрываем при вас' },
  { slug: 'hl-time',      icon: 'clock',        title: 'Честное время',     body: 'В записи стоит реальная длительность, без «подождите ещё час»' },
  { slug: 'hl-telegram',  icon: 'send',         title: 'Запись в Telegram', body: 'Бот подтверждает окно и напоминает за два часа' },
  { slug: 'hl-materials', icon: 'sparkles',     title: 'Свои материалы',    body: 'Гель-лаки и базы, с которыми носится 4 недели' }
];

const WORKS = [
  'Нюд с втиркой', 'Френч', 'Матовое покрытие',
  'Наращивание, форма миндаль', 'Дизайн с фольгой', 'Педикюр'
];

async function seed(db) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const c of CATEGORIES) {
    await db.query(
      `INSERT INTO service_categories (slug, title, sort_order) VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, sort_order = EXCLUDED.sort_order`,
      [c.slug, c.title, c.sort]
    );
  }

  for (const [i, s] of SERVICES.entries()) {
    await db.query(
      `INSERT INTO services (category_id, slug, title, description, duration_min, duration_is_from,
                             price_kopecks, price_is_from, buffer_after_min, badge,
                             is_online_bookable, sort_order)
       VALUES ((SELECT id FROM service_categories WHERE slug = $1),
               $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title, description = EXCLUDED.description,
         duration_min = EXCLUDED.duration_min, price_kopecks = EXCLUDED.price_kopecks,
         buffer_after_min = EXCLUDED.buffer_after_min, updated_at = now()`,
      [s.cat, s.slug, s.title, s.desc, s.dur, Boolean(s.durFrom), s.price,
       Boolean(s.priceFrom), s.buffer, s.badge ?? null, s.online !== false, (i + 1) * 10]
    );
  }

  // Владелица: у неё роль admin и отдельный профиль мастера не заводится.
  const owner = await db.query(
    `INSERT INTO users (role, full_name, email, phone, password_hash, password_changed_at)
     VALUES ('admin', 'Варвара Администратор', 'admin@varvara.studio', '+79210000000', $1, now())
     ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
     RETURNING id`,
    [passwordHash]
  );
  await db.query('UPDATE studio_settings SET owner_user_id = $1 WHERE id = 1', [owner.rows[0].id]);

  for (const m of MASTERS) {
    const u = await db.query(
      `INSERT INTO users (role, full_name, email, phone, password_hash, password_changed_at)
       VALUES ('master', $1, $2, $3, $4, now())
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id`,
      [m.name, m.email, m.phone, passwordHash]
    );
    const id = u.rows[0].id;

    await db.query(
      `INSERT INTO master_profiles (user_id, sort_order, uses_studio_hours)
       VALUES ($1, $2, true)
       ON CONFLICT (user_id) DO UPDATE SET sort_order = EXCLUDED.sort_order`,
      [id, m.sort]
    );

    await db.query('DELETE FROM master_services WHERE master_id = $1', [id]);
    for (const slug of m.services) {
      await db.query(
        `INSERT INTO master_services (master_id, service_id)
         VALUES ($1, (SELECT id FROM services WHERE slug = $2))`,
        [id, slug]
      );
    }
  }

  for (const [i, h] of HIGHLIGHTS.entries()) {
    await db.query(
      `INSERT INTO content_blocks (slug, section, icon, title, body, sort_order)
       VALUES ($1, 'highlights', $2, $3, $4, $5)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title, body = EXCLUDED.body, updated_at = now()`,
      [h.slug, h.icon, h.title, h.body, (i + 1) * 10]
    );
  }

  await db.query(
    `INSERT INTO content_blocks (slug, section, title, body, image_url, sort_order)
     VALUES ('hero-photo', 'hero', 'Аккуратные ногти без спешки',
             'Маникюр, педикюр и наращивание в маленькой студии на четыре кресла.',
             '/img/hero.jpg', 10)
     ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, updated_at = now()`
  );

  const masterIds = (await db.query(
    `SELECT mp.user_id FROM master_profiles mp JOIN users u ON u.id = mp.user_id ORDER BY mp.sort_order`
  )).rows.map((r) => r.user_id);

  await db.query('DELETE FROM portfolio_works');
  for (const [i, title] of WORKS.entries()) {
    await db.query(
      `INSERT INTO portfolio_works (master_id, image_url, title, sort_order)
       VALUES ($1, $2, $3, $4)`,
      [masterIds[i % masterIds.length], `/img/works/${i + 1}.jpg`, title, (i + 1) * 10]
    );
  }
}

try {
  await withTransaction(seed);
  const counts = await pool.query(`
    SELECT (SELECT count(*) FROM users)            AS users,
           (SELECT count(*) FROM master_profiles)  AS masters,
           (SELECT count(*) FROM services)         AS services,
           (SELECT count(*) FROM master_services)  AS links,
           (SELECT count(*) FROM working_hours)    AS hours,
           (SELECT count(*) FROM content_blocks)   AS blocks,
           (SELECT count(*) FROM portfolio_works)  AS works
  `);
  const c = counts.rows[0];
  console.log('Сиды загружены:');
  console.log(`  пользователей ${c.users}, мастеров ${c.masters}, услуг ${c.services}`);
  console.log(`  связей мастер-услуга ${c.links}, интервалов графика ${c.hours}`);
  console.log(`  блоков лендинга ${c.blocks}, работ в портфолио ${c.works}`);
  console.log(`\n  Демо-пароль для всех учётных записей: ${DEMO_PASSWORD}`);
} finally {
  await pool.end();
}
