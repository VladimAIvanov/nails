/* Кабинет клиентки: ближайшие визиты и история.

   Экран проверяет, что сервис помнит вошедшего: имя приходит из API по
   куке, которую поставил сервер. Если куки нет — уводим на вход, а не
   показываем пустую страницу. */
import { api, guard, el, money, studio, whenLocal } from './api.js';
import { renderHeader } from './header.js';

const user = await renderHeader();
if (!user) location.href = '/login?next=/account';

/* Регистрация приводит сюда с пометкой: кабинет ещё пуст, и это нормально. */
const isNew = new URLSearchParams(location.search).get('new') === '1';

document.getElementById('hello').textContent = `Здравствуйте, ${user.full_name.split(' ')[0]}`;
document.getElementById('hello-sub').textContent = isNew
  ? 'Кабинет готов. Записей пока нет — самое время выбрать окно.'
  : 'Ближайшие визиты и история.';

const STATUS = {
  pending: 'status--pending',
  confirmed: 'status--confirmed',
  done: 'status--done',
  cancelled: 'status--cancelled',
  no_show: 'status--cancelled'
};

function card(a, timezone, address) {
  return el('article', { className: 'card stack' },
    el('div', { className: 'row account__head' },
      el('h3', { textContent: a.service.title }),
      el('span', { className: `status ${STATUS[a.status] ?? ''}`, textContent: a.status_title })),
    el('p', { className: 'account__when', textContent: whenLocal(a.starts_at, timezone) }),
    el('p', { className: 'muted', textContent: `${a.master.name} · ${money(a.price_kopecks)} · ${a.duration_min} мин` }),
    address ? el('p', { className: 'caption', textContent: address }) : null,
    a.client_comment ? el('p', { className: 'caption', textContent: `Комментарий: ${a.client_comment}` }) : null
  );
}

async function load() {
  const s = await studio();
  const data = await api('GET', '/api/appointments/my?scope=all');

  document.getElementById('upcoming').replaceChildren(
    ...(data.upcoming.length
      ? data.upcoming.map((a) => card(a, s.timezone, data.address))
      : [el('div', { className: 'card stack' },
        el('h3', {}, 'Записей пока нет'),
        el('p', { className: 'muted' }, 'Выберите услугу, мастера и удобное окно — займёт минуту.'),
        el('a', { className: 'btn', href: '/booking', textContent: 'Записаться' }))])
  );

  const past = document.getElementById('past');
  document.getElementById('past-title').hidden = data.past.length === 0;
  past.replaceChildren(...data.past.map((a) => card(a, s.timezone, null)));
}

await guard(load)();
