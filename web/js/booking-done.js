/* Шаг 5: запись создана.

   Детали берутся у сервера по номерам записей, а не переносятся с прошлого
   экрана: показываем то, что действительно сохранено.

   Несколько выбранных услуг сервер сохраняет несколькими записями подряд —
   поэтому здесь их может быть больше одной. */
import { api, guard, el, money, duration, studio, whenLocal } from './api.js';
import { renderHeader } from './header.js';

renderHeader();

const ids = (new URLSearchParams(location.search).get('id') ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean);
if (ids.length === 0) location.href = '/account';

await guard(async () => {
  const settings = await studio();
  const visits = await Promise.all(ids.map((id) => api('GET', `/api/appointments/${id}`)));
  const first = visits[0];
  const total = visits.reduce((sum, a) => sum + a.price_kopecks, 0);
  const minutes = visits.reduce((sum, a) => sum + a.duration_min, 0);

  document.getElementById('title').textContent = visits.length > 1
    ? `Записались, ${visits.length} услуги`
    : `Записались, №${first.number ?? first.id}`;

  document.getElementById('sub').textContent = first.status === 'confirmed'
    ? 'Визит подтверждён. Напоминание придёт заранее.'
    : 'Заявка принята — студия подтвердит её и пришлёт напоминание.';

  document.getElementById('card').replaceChildren(
    el('div', { className: 'sum__row' },
      el('div', {},
        el('div', { className: 'muted', textContent: 'Когда' }),
        el('div', { className: 'sum__value', textContent: whenLocal(first.starts_at, settings.timezone) })),
      el('span', { className: `status status--${first.status}`, textContent: first.status_title })),

    ...visits.map((a) => el('div', { className: 'sum__service' },
      el('span', {}, `№${a.number ?? a.id} · ${a.service.title}`),
      el('span', { className: 'muted', textContent: duration(a.duration_min) }),
      el('span', { className: 'price', textContent: money(a.price_kopecks) }))),

    visits.length > 1
      ? el('div', { className: 'sum__total' },
        el('span', {}, `Итого · ${duration(minutes)}`),
        el('span', { className: 'price', textContent: money(total) }))
      : null,

    line('Мастер', first.master.name),
    line('Адрес', `${settings.address_line}${settings.address_note ? `, ${settings.address_note}` : ''}`),
    first.client_comment ? line('Комментарий', first.client_comment) : null,
    el('p', { className: 'caption' },
      `Отменить или перенести можно в кабинете. Бесплатно — не позднее чем за ${Math.round(settings.free_cancellation_lead_min / 60)} ч.`)
  );
})();

function line(label, value) {
  return el('div', { className: 'sum__row' },
    el('div', {},
      el('div', { className: 'muted', textContent: label }),
      el('div', { className: 'sum__value', textContent: value })));
}
