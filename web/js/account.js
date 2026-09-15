/* Кабинет: активные записи и история.

   Ближайший визит выделен — за ним человек сюда и приходит. Пустой кабинет
   не отдельная страница, а состояние этого же списка: текст и кнопка
   записаться вместо пустого места. */
import { api, guard, el, money, studio, whenLocal, actsAsClient } from './api.js';
import { renderHeader } from './header.js';

const user = await renderHeader();
if (!user) location.href = '/login?next=/account';

const isNew = new URLSearchParams(location.search).get('new') === '1';

document.getElementById('hello').textContent = `Здравствуйте, ${user.full_name.split(' ')[0]}`;
document.getElementById('hello-sub').textContent = isNew
  ? 'Кабинет готов. Записей пока нет — самое время выбрать окно.'
  : 'Ближайшие визиты и история.';

const PARTS = { any: 'в любое время', morning: 'утром', day: 'днём', evening: 'вечером' };

let tab = new URLSearchParams(location.search).get('tab') === 'waitlist' ? 'waitlist' : 'upcoming';
let data = null;
let waiting = [];
let settings = null;

function card(a, { first = false } = {}) {
  const active = ['pending', 'confirmed'].includes(a.status);

  /* Действия стоят прямо в карточке, как в прототипе: до переноса и отмены
     не нужно сначала открывать детали. Сами действия по-прежнему проходят
     через окно подтверждения на странице записи — они необратимы. */
  const canMove = Date.parse(a.starts_at) - Date.now() >= settings.free_cancellation_lead_min * 60_000;
  const actions = active
    ? [
      canMove
        ? el('a', { className: 'btn btn--secondary btn--sm', href: `/booking-time?mode=reschedule&appointment=${a.id}`, textContent: 'Перенести' })
        : null,
      el('a', { className: 'btn btn--ghost btn--sm', href: `/appointment?id=${a.id}&cancel=1`, textContent: 'Отменить' }),
      el('a', { className: 'btn btn--ghost btn--sm', href: `/appointment?id=${a.id}`, textContent: 'Подробнее' })
    ]
    : [
      el('a', { className: 'btn btn--secondary btn--sm', href: `/booking?service_id=${a.service.id}`, textContent: 'Повторить' }),
      el('a', { className: 'btn btn--ghost btn--sm', href: `/appointment?id=${a.id}`, textContent: 'Подробнее' })
    ];

  return el('article', { className: `card visit${first ? ' visit--next' : ''}` },
    first ? el('p', { className: 'eyebrow', textContent: 'Ближайший визит' }) : null,
    el('div', { className: 'row account__head' },
      el('h3', { textContent: a.service.title }),
      el('span', { className: `status status--${a.status}`, textContent: a.status_title })),
    el('p', { className: 'account__when', textContent: whenLocal(a.starts_at, settings.timezone) }),
    el('p', { className: 'muted', textContent: `${a.master.name} · ${money(a.price_kopecks)} · ${a.duration_min} мин` }),
    first && data.address ? el('p', { className: 'caption', textContent: data.address }) : null,
    el('div', { className: 'row' }, ...actions)
  );
}

/* Заявка в лист ожидания: ждём освободившееся окно у мастера на дату. */
function waitCard(entry) {
  const drop = el('button', { type: 'button', className: 'btn btn--ghost btn--sm', textContent: 'Убрать из списка' });
  drop.addEventListener('click', guard(async () => {
    await api('DELETE', `/api/waitlist/${entry.id}`);
    await load();
  }));

  const when = entry.date_from === entry.date_to
    ? `на ${entry.date_from.split('-').reverse().join('.')}`
    : `с ${entry.date_from.split('-').reverse().join('.')} по ${entry.date_to.split('-').reverse().join('.')}`;

  return el('article', { className: 'card visit' },
    el('div', { className: 'row account__head' },
      el('h3', { textContent: entry.service_title }),
      el('span', {
        className: `status ${entry.notified_at ? 'status--confirmed' : 'status--pending'}`,
        textContent: entry.notified_at ? 'окно освободилось' : 'ждём отмену'
      })),
    el('p', { className: 'account__when', textContent: `${entry.master_name}, ${when}` }),
    el('p', { className: 'muted', textContent: `Готовы прийти ${PARTS[entry.part_of_day] ?? entry.part_of_day}` }),
    entry.notified_at
      ? el('p', { className: 'caption', textContent: 'Мы уже сообщили вам — время могли занять, проверьте свободные окна.' })
      : null,
    el('div', { className: 'row' },
      el('a', { className: 'btn btn--secondary btn--sm', href: `/booking-time?master=${entry.master_id}`, textContent: 'Посмотреть окна' }),
      drop)
  );
}

function render() {
  const list = document.getElementById('list');

  for (const btn of document.querySelectorAll('.tab')) {
    btn.classList.toggle('tab--on', btn.dataset.tab === tab);
  }

  if (tab === 'waitlist') {
    list.replaceChildren(
      ...(waiting.length
        ? waiting.map(waitCard)
        : [el('div', { className: 'card stack empty' },
          el('h3', {}, 'Лист ожидания пуст'),
          el('p', { className: 'muted' },
            'Если в нужный день у мастера нет окон, встаньте в лист ожидания — сообщим, когда кто-нибудь отменит визит.'),
          el('a', { className: 'btn', href: '/booking', textContent: 'Выбрать время' }))])
    );
    return;
  }

  const items = tab === 'upcoming' ? data.upcoming : data.past;

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

/* Кабинет — экран клиентки. Сотрудник сюда попадает только по набранному
   вручную адресу, и запрос за записями ему всё равно откажет. Говорим об
   этом до запроса: красный отказ он исправить не может, а объяснение
   со ссылкой — это то, чего от страницы ждут (правило 7). */
function staffNote() {
  document.getElementById('hello').textContent = 'Кабинет — для клиенток';
  document.getElementById('hello-sub').textContent =
    'У вашей учётной записи роль сотрудника: своих визитов здесь нет.';
  document.querySelector('.tabs')?.remove();
  document.getElementById('list').replaceChildren(
    el('div', { className: 'note note--info' },
      user.roles?.includes('admin')
        ? el('span', {}, 'Записи всех клиенток студии — в ', el('a', { href: '/admin', textContent: 'админ-панели' }), '.')
        : 'Своё расписание мастер увидит в кабинете мастера — он появится следующей итерацией.')
  );
}

async function load() {
  if (!actsAsClient(user)) return staffNote();

  settings = await studio();
  const [visits, list] = await Promise.all([
    api('GET', '/api/appointments/my?scope=all'),
    api('GET', '/api/waitlist')
  ]);

  data = visits;
  waiting = list.entries.filter((e) => e.is_active === 1);

  /* Ближайший — это последний в списке: сервер отдаёт по убыванию времени. */
  document.getElementById('count-upcoming').textContent = data.upcoming.length;
  document.getElementById('count-past').textContent = data.past.length;
  document.getElementById('count-waitlist').textContent = waiting.length;
  render();
}

for (const btn of document.querySelectorAll('.tab')) {
  btn.addEventListener('click', () => { tab = btn.dataset.tab; render(); });
}

await guard(load)();
