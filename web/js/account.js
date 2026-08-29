/* Кабинет: активные записи и история.

   Ближайший визит выделен — за ним человек сюда и приходит. Пустой кабинет
   не отдельная страница, а состояние этого же списка: текст и кнопка
   записаться вместо пустого места. */
import { api, guard, el, money, studio, whenLocal } from './api.js';
import { renderHeader } from './header.js';

const user = await renderHeader();
if (!user) location.href = '/login?next=/account';

const isNew = new URLSearchParams(location.search).get('new') === '1';

document.getElementById('hello').textContent = `Здравствуйте, ${user.full_name.split(' ')[0]}`;
document.getElementById('hello-sub').textContent = isNew
  ? 'Кабинет готов. Записей пока нет — самое время выбрать окно.'
  : 'Ближайшие визиты и история.';

let tab = 'upcoming';
let data = null;
let settings = null;

function card(a, { first = false } = {}) {
  const open = el('a', { className: 'btn btn--secondary btn--sm', href: `/appointment?id=${a.id}`, textContent: 'Подробнее' });

  return el('article', { className: `card visit${first ? ' visit--next' : ''}` },
    first ? el('p', { className: 'eyebrow', textContent: 'Ближайший визит' }) : null,
    el('div', { className: 'row account__head' },
      el('h3', { textContent: a.service.title }),
      el('span', { className: `status status--${a.status}`, textContent: a.status_title })),
    el('p', { className: 'account__when', textContent: whenLocal(a.starts_at, settings.timezone) }),
    el('p', { className: 'muted', textContent: `${a.master.name} · ${money(a.price_kopecks)} · ${a.duration_min} мин` }),
    first && data.address ? el('p', { className: 'caption', textContent: data.address }) : null,
    el('div', { className: 'row' }, open)
  );
}

function render() {
  const list = document.getElementById('list');
  const items = tab === 'upcoming' ? data.upcoming : data.past;

  for (const btn of document.querySelectorAll('.tab')) {
    btn.classList.toggle('tab--on', btn.dataset.tab === tab);
  }

  if (items.length === 0) {
    list.replaceChildren(
      tab === 'upcoming'
        ? el('div', { className: 'card stack empty' },
          el('h3', {}, 'Записей пока нет'),
          el('p', { className: 'muted' }, 'Выберите услугу, мастера и удобное окно — займёт минуту.'),
          el('a', { className: 'btn', href: '/booking', textContent: 'Записаться' }))
        : el('p', { className: 'muted' }, 'История пуста: состоявшихся и отменённых визитов ещё нет.')
    );
    return;
  }

  list.replaceChildren(...items.map((a, i) => card(a, { first: tab === 'upcoming' && i === items.length - 1 })));
}

async function load() {
  settings = await studio();
  data = await api('GET', '/api/appointments/my?scope=all');

  /* Ближайший — это последний в списке: сервер отдаёт по убыванию времени. */
  document.getElementById('count-upcoming').textContent = data.upcoming.length;
  document.getElementById('count-past').textContent = data.past.length;
  render();
}

for (const btn of document.querySelectorAll('.tab')) {
  btn.addEventListener('click', () => { tab = btn.dataset.tab; render(); });
}

await guard(load)();
