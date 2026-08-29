/* Список действующих входов. Свой сеанс сервер закрыть не даёт — он
   отвечает отказом, и этот отказ показывается на экране текстом. */
import { api, guard, showOk, el, studio } from './api.js';
import { renderHeader } from './header.js';

const user = await renderHeader();
if (!user) location.href = '/login?next=/sessions';

const list = document.getElementById('list');

function card(session, timezone) {
  const when = new Intl.DateTimeFormat('ru-RU', {
    timeZone: timezone, day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit'
  }).format(new Date(session.issued_at));

  const close = el('button', { type: 'button', className: 'btn btn--secondary btn--sm', textContent: 'Закрыть вход' });
  close.addEventListener('click', guard(async () => {
    await api('DELETE', `/api/profile/sessions/${session.id}`);
    showOk('Вход закрыт');
    await load();
  }));

  return el('article', { className: 'card stack' },
    el('h4', { textContent: `Вход ${when}` }),
    el('p', { className: 'muted', textContent: session.user_agent ?? 'устройство не определилось' }),
    el('p', { className: 'caption', textContent: `адрес ${session.ip ?? '—'} · действует до ${session.expires_at}` }),
    close
  );
}

async function load() {
  const s = await studio();
  const { sessions } = await api('GET', '/api/profile/sessions');

  list.replaceChildren(
    ...(sessions.length
      ? sessions.map((item) => card(item, s.timezone))
      : [el('p', { className: 'muted' }, 'Действующих входов нет')])
  );
}

await guard(load)();
