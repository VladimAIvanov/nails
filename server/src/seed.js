/* Демонстрационные данные из прототипа: три мастера, шесть услуг, портфолио,
   тексты лендинга. Скрипт идемпотентен — повторный запуск ничего не дублирует.

   Пароли здесь демонстрационные и заданы одной константой: это локальный
   стенд, а не рабочая установка. */
import { scryptSync, randomBytes } from 'node:crypto';
import { db, transaction, nowIso } from './db.js';

const DEMO_PASSWORD = 'varvara-demo';

function hashPassword(plain) {
  const salt = randomBytes(16);
  const key = scryptSync(plain, salt, 64);
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
  { slug: 'man-cover', cat: 'manicure',  title: 'Маникюр с покрытием',  desc: 'Аппаратный, гель-лак',          dur: 90,  price: 320000, buffer: 15 },
  { slug: 'man',       cat: 'manicure',  title: 'Маникюр без покрытия', desc: 'Аппаратный, уход за кутикулой', dur: 50,  price: 190000, buffer: 15 },
  { slug: 'ext',       cat: 'extension', title: 'Наращивание',          desc: 'Гель, форма и длина на выбор',  dur: 180, price: 550000, buffer: 20, priceFrom: 1, badge: 'хит' },
  { slug: 'ped',       cat: 'pedicure',  title: 'Педикюр с покрытием',  desc: 'Медицинский аппаратный',        dur: 100, price: 380000, buffer: 20 },
  { slug: 'design',    cat: 'design',    title: 'Дизайн ногтей',        desc: 'Френч, втирка, стемпинг',       dur: 20,  price: 60000,  buffer: 5,  priceFrom: 1, durFrom: 1 },
  { slug: 'repair',    cat: 'manicure',  title: 'Ремонт ногтя',         desc: null,                            dur: 15,  price: 40000,  buffer: 5,  online: 0 }
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

transaction((conn) => {
  const passwordHash = hashPassword(DEMO_PASSWORD);

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
    ON CONFLICT (email) DO UPDATE SET full_name = excluded.full_name
  `);
  const findUser = conn.prepare('SELECT id FROM users WHERE email = ?');

  // Владелица: роль admin, отдельный профиль мастера ей не заводится.
  upsertUser.run('admin', 'Варвара Администратор', 'admin@varvara.studio',
    '+79210000000', passwordHash, nowIso());
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

  for (const m of MASTERS) {
    upsertUser.run('master', m.name, m.email, m.phone, passwordHash, nowIso());
    const id = findUser.get(m.email).id;
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
});

const c = db.prepare(`
  SELECT (SELECT COUNT(*) FROM users)           AS users,
         (SELECT COUNT(*) FROM master_profiles) AS masters,
         (SELECT COUNT(*) FROM services)        AS services,
         (SELECT COUNT(*) FROM master_services) AS links,
         (SELECT COUNT(*) FROM working_hours)   AS hours,
         (SELECT COUNT(*) FROM content_blocks)  AS blocks,
         (SELECT COUNT(*) FROM portfolio_works) AS works
`).get();

console.log('Сиды загружены:');
console.log(`  пользователей ${c.users}, мастеров ${c.masters}, услуг ${c.services}`);
console.log(`  связей мастер-услуга ${c.links}, интервалов графика ${c.hours}`);
console.log(`  блоков лендинга ${c.blocks}, работ в портфолио ${c.works}`);
console.log(`\n  Демо-пароль для всех учётных записей: ${DEMO_PASSWORD}`);

db.close();
