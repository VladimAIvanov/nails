import { api, guard, studio, el, money, duration } from '/js/api.js';
import { renderHeader } from '/js/header.js';

renderHeader();

const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/* ── Студия: первый экран и подвал ─────────────────────────────────────── */
async function loadStudio() {
  const s = await studio();

  document.getElementById('hero-place').textContent = `${s.city} · ${s.address_line}`;
  document.getElementById('footer-address').textContent = `${s.city}, ${s.address_line}${s.address_note ? `. ${s.address_note}` : ''}`;
  document.getElementById('footer-copy').textContent = `© 2026 Студия «${s.title}»`;
  document.title = `${s.title} — ногтевая студия, ${s.city}`;

  /* Часы работы — из расписания студии, а не текстом в разметке: в настройках
     их меняют, и захардкоженная строка разошлась бы с правдой. */
  const hours = s.working_hours ?? [];
  const worked = new Set(hours.map((h) => h.weekday));
  const off = [0, 1, 2, 3, 4, 5, 6].filter((d) => !worked.has(d));
  const sample = hours[0];

  document.getElementById('footer-hours').replaceChildren(
    ...(sample
      ? [el('li', {}, `${SHORT[hours[0].weekday]}–${SHORT[hours[hours.length - 1].weekday]} ${sample.starts_at_local}–${sample.ends_at_local}`)]
      : []),
    ...off.map((d) => el('li', {}, `${WEEKDAYS[d]} — выходной`))
  );

  document.getElementById('footer-contacts').replaceChildren(
    s.phone ? el('li', {}, el('a', { href: `tel:${s.phone.replace(/[^+\d]/g, '')}`, textContent: s.phone })) : null,
    s.telegram_bot ? el('li', {}, el('a', { href: `https://t.me/${s.telegram_bot.replace('@', '')}`, textContent: s.telegram_bot })) : null
  );

  if (!s.online_booking_enabled) {
    document.getElementById('band-text').textContent =
      'Онлайн-запись временно выключена — позвоните в студию, вас запишут.';
  }
}

/* ── Тексты блоков лендинга ────────────────────────────────────────────── */
async function loadContent() {
  const { blocks } = await api('GET', '/api/content');

  const hero = blocks.find((b) => b.section === 'hero');
  if (hero) {
    document.getElementById('hero-title').textContent = hero.title;
    document.getElementById('hero-body').textContent = hero.body;
  }

  const highlights = blocks.filter((b) => b.section === 'highlights');
  document.getElementById('highlights').replaceChildren(
    ...highlights.map((h) => el('div', { className: 'strip__item' },
      el('div', { className: 'strip__title', textContent: h.title }),
      el('div', { className: 'strip__body', textContent: h.body })))
  );
}

/* ── Услуги: карточки и фильтр категорий ───────────────────────────────── */
let activeCategory = '';

function serviceCard(s) {
  return el('article', { className: 'card service' },
    el('div', { className: 'service__head' },
      el('h3', { className: 'service__title', textContent: s.title }),
      s.badge ? el('span', { className: 'badge', textContent: s.badge }) : null),
    s.description ? el('p', { className: 'service__text', textContent: s.description }) : null,
    el('div', { className: 'service__foot' },
      el('span', { className: 'muted', textContent: `${s.duration_is_from ? 'от ' : ''}${duration(s.duration_min)}` }),
      el('span', { className: 'price', textContent: `${s.price_is_from ? 'от ' : ''}${money(s.price_kopecks)}` })),
    el('a', { className: 'btn btn--secondary btn--sm', href: `/booking?service_id=${s.id}`, textContent: 'Записаться' })
  );
}

async function loadServices() {
  const query = activeCategory ? `?category=${encodeURIComponent(activeCategory)}` : '';
  const data = await api('GET', `/api/services${query}`);

  if (!document.getElementById('categories').childElementCount) {
    renderCategories(data.categories);
    renderFooterCategories(data.categories);
  }

  const list = document.getElementById('services-list');
  list.replaceChildren(
    ...(data.services.length
      ? data.services.map(serviceCard)
      : [el('p', { className: 'muted' }, 'В этой категории пока нет услуг')])
  );
}

function renderCategories(categories) {
  const box = document.getElementById('categories');
  const all = [{ slug: '', title: 'Все' }, ...categories];

  box.replaceChildren(...all.map((c) => {
    const chip = el('button', {
      type: 'button',
      className: `chip${c.slug === activeCategory ? ' chip--on' : ''}`,
      textContent: c.title
    });
    chip.addEventListener('click', guard(async () => {
      activeCategory = c.slug;
      for (const other of box.children) other.classList.remove('chip--on');
      chip.classList.add('chip--on');
      document.getElementById('services-list').replaceChildren(
        el('div', { className: 'skeleton skeleton-card' }),
        el('div', { className: 'skeleton skeleton-card' })
      );
      await loadServices();
    }));
    return chip;
  }));
}

function renderFooterCategories(categories) {
  document.getElementById('footer-categories').replaceChildren(
    ...categories.map((c) => el('li', {}, el('a', { href: `/#services`, textContent: c.title })))
  );
}

/* ── Мастера ───────────────────────────────────────────────────────────── */
async function loadMasters() {
  const { masters } = await api('GET', '/api/masters');

  document.getElementById('masters-list').replaceChildren(
    ...masters.map((m) => el('article', { className: 'card master' },
      el('div', { className: 'avatar avatar--lg', textContent: (m.name ?? '·')[0] }),
      el('h3', { className: 'master__name', textContent: m.name }),
      el('p', { className: 'muted', textContent: m.specialization.join(', ') || 'Мастер студии' }),
      el('p', { className: 'master__rating' },
        m.rating ? `★ ${m.rating} · ${m.reviews_count} отзывов` : 'пока без отзывов'),
      el('a', {
        className: 'btn btn--secondary btn--sm',
        href: `/booking?master_id=${m.id}`,
        textContent: m.accepts_online_booking ? 'Записаться' : 'Смотреть окна'
      })))
  );

  /* Оценка студии в первом экране: среднее по мастерам, взвешенное по числу
     отзывов. Отдельного адреса для неё в API нет — см. docs/ui-map.md,
     расхождение №6. Если отзывов нет вовсе, блок не показываем. */
  const rated = masters.filter((m) => m.rating && m.reviews_count);
  const badge = document.getElementById('hero-rating');

  if (!rated.length) {
    badge.remove();
    return;
  }

  const reviews = rated.reduce((sum, m) => sum + m.reviews_count, 0);
  const average = rated.reduce((sum, m) => sum + m.rating * m.reviews_count, 0) / reviews;

  badge.replaceChildren(
    el('div', { className: 'hero__badge-value', textContent: `★ ${average.toFixed(1)}` }),
    el('div', { className: 'caption', textContent: `${reviews} отзывов о мастерах студии` })
  );
}

/* ── Работы ────────────────────────────────────────────────────────────── */
async function loadWorks() {
  const { works } = await api('GET', '/api/portfolio');

  document.getElementById('works-list').replaceChildren(
    ...(works.length
      ? works.map((w) => el('figure', { className: 'frame frame--work' },
        el('span', {}, w.title),
        el('figcaption', { className: 'caption', textContent: w.master_name ?? '' })))
      : [el('p', { className: 'muted' }, 'Работы скоро появятся')])
  );
}

/* Каждый блок грузится своей обёрткой: если отвалится один запрос,
   остальная страница всё равно покажется, а отказ будет виден текстом. */
await guard(loadStudio)();
await guard(loadContent)();
await guard(loadServices)();
await guard(loadMasters)();
await guard(loadWorks)();
