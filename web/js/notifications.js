/* Уведомления кабинета: что студия сделала с записями без участия человека.

   Своих действий здесь не бывает по устройству сервера: он не создаёт
   сообщение, когда событие вызвал сам получатель. Поэтому экран не
   фильтрует ничего — что пришло, то и показывает.

   Текст приходит готовым. Собирать его здесь нельзя: сообщение описывает
   то, что было в момент события, а запись с тех пор могли перенести ещё раз. */
import { api, guard, el, showOk } from './api.js';
import { renderHeader } from './header.js';

const list = document.getElementById('list');
const sub = document.getElementById('sub');
const readAll = document.getElementById('read-all');

const user = await renderHeader();
if (!user) location.href = '/login?next=/notifications';

const TITLES = {
  appointment_cancelled: 'Визит отменён',
  appointment_moved: 'Визит перенесён',
  slot_overlapped: 'На ваше время назначен ещё один визит'
};

/* «сегодня в 14:05», «вчера в 19:02», «2 сентября в 11:30» — как в прототипе.
   Время события показывается по часовому поясу читателя: это отметка о том,
   когда пришло сообщение, а не время визита. Время визита уже внутри текста
   и посчитано сервером по поясу студии. */
function ago(iso) {
  const when = new Date(iso);
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(when).setHours(0, 0, 0, 0)) / 86_400_000);
  const time = when.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (days === 0) return `сегодня в ${time}`;
  if (days === 1) return `вчера в ${time}`;
  return `${when.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} в ${time}`;
}

function plural(n, one, few, many) {
  const last = n % 10;
  const two = n % 100;
  if (last === 1 && two !== 11) return `${n} ${one}`;
  if (last >= 2 && last <= 4 && (two < 12 || two > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

function card(n) {
  const mark = el('button', {
    type: 'button', className: 'btn btn--ghost btn--sm', textContent: 'Прочитано'
  });
  mark.addEventListener('click', guard(async () => {
    mark.disabled = true;
    render(await api('POST', `/api/notifications/${n.id}/read`));
  }));

  return el('div', { className: `card notice${n.is_read ? '' : ' notice--new'}` },
    el('div', { className: 'notice__head' },
      el('strong', { textContent: TITLES[n.kind] ?? 'Уведомление' }),
      el('span', { className: 'caption', textContent: ago(n.created_at) })),
    el('p', { className: 'notice__text', textContent: n.text }),
    el('div', { className: 'row' },
      /* Ссылка ведёт на саму запись, а не в общий список: человек пришёл
         сюда узнать про конкретный визит. */
      n.appointment
        ? el('a', {
          className: 'btn btn--secondary btn--sm',
          href: `/appointment?id=${n.appointment.id}`,
          textContent: n.appointment.number ? `Запись № ${n.appointment.number}` : 'Открыть запись'
        })
        : null,
      n.is_read ? null : mark));
}

function render(data) {
  readAll.hidden = data.unread === 0;
  sub.textContent = data.unread === 0
    ? 'Непрочитанных нет. Здесь остаётся всё, что студия делала с вашими записями.'
    : `Непрочитанных: ${plural(data.unread, 'сообщение', 'сообщения', 'сообщений')}.`;

  if (data.notifications.length === 0) {
    list.replaceChildren(el('div', { className: 'card' },
      el('p', { className: 'muted' },
        'Пока пусто. Сюда попадает то, что студия сделала с вашими записями: '
        + 'отмена, перенос, ещё один визит на ваше время. Собственные действия '
        + 'сюда не пишутся — их результат виден сразу.'),
      el('a', { className: 'btn btn--secondary btn--sm', href: '/account', textContent: 'Мои записи' })));
    return;
  }

  list.replaceChildren(...data.notifications.map(card));
}

readAll.addEventListener('click', guard(async () => {
  render(await api('POST', '/api/notifications/read-all'));
  showOk('Все сообщения отмечены прочитанными');
}));

await guard(async () => render(await api('GET', '/api/notifications')))();
