/* Детали записи: отмена и перенос.

   Оба действия необратимы, поэтому оба идут через окно подтверждения.
   У отмены есть особый случай: если до визита осталось меньше, чем правило
   студии, человек должен узнать об этом до нажатия, а не после.

   Чужая запись сюда не откроется: сервер отвечает 403, и этот ответ
   показывается текстом. Проверку делает он, а не экран. */
import { api, guard, el, fill, money, duration, studio, whenLocal, showError, showOk, clearMsg } from './api.js';
import { renderHeader } from './header.js';

const user = await renderHeader();
const params = new URLSearchParams(location.search);
const id = params.get('id');
const moveTo = params.get('move');   // новое время из календаря в режиме переноса

if (!user) location.href = `/login?next=/appointment?id=${id}`;
if (!id) location.href = '/account';

let settings = null;
let visit = null;

const modal = document.getElementById('modal');
const modalOk = document.getElementById('modal-ok');

function openModal(title, body, okText, onOk) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').replaceChildren(...body);
  modalOk.textContent = okText;
  modalOk.onclick = onOk;
  modal.hidden = false;
}

const closeModal = () => { modal.hidden = true; };
document.getElementById('modal-cancel').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// ── Показ записи ────────────────────────────────────────────────────────────

function line(label, value) {
  return el('div', { className: 'sum__row' },
    el('div', {},
      el('div', { className: 'muted', textContent: label }),
      el('div', { className: 'sum__value', textContent: value })));
}

function render() {
  document.getElementById('title').textContent = `Запись №${visit.number ?? visit.id}`;

  fill(document.getElementById('card'),
    el('div', { className: 'sum__row' },
      el('div', {},
        el('div', { className: 'muted', textContent: 'Когда' }),
        el('div', { className: 'sum__value', textContent: whenLocal(visit.starts_at, settings.timezone) })),
      el('span', { className: `status status--${visit.status}`, textContent: visit.status_title })),
    line('Услуга', visit.service.title),
    line('Мастер', visit.master.name),
    line('Длительность', duration(visit.duration_min)),
    line('Стоимость', money(visit.price_kopecks)),
    line('Адрес', `${settings.address_line}${settings.address_note ? `, ${settings.address_note}` : ''}`),
    visit.client_comment ? line('Комментарий', visit.client_comment) : null
  );

  const actions = document.getElementById('actions');
  const active = ['pending', 'confirmed'].includes(visit.status);

  if (!active) {
    actions.replaceChildren(
      el('p', { className: 'muted' }, visit.status === 'cancelled'
        ? 'Запись отменена. Можно записаться заново.'
        : 'Визит уже состоялся.'),
      el('a', { className: 'btn', href: '/booking', textContent: 'Записаться снова' })
    );
    return;
  }

  const move = el('a', {
    className: 'btn btn--secondary',
    href: `/booking-time?mode=reschedule&appointment=${visit.id}`,
    textContent: 'Перенести'
  });

  const cancel = el('button', { type: 'button', className: 'btn btn--ghost', textContent: 'Отменить запись' });
  cancel.addEventListener('click', askCancel);

  actions.replaceChildren(move, cancel);
}

// ── Отмена ──────────────────────────────────────────────────────────────────

function askCancel() {
  const leftMin = Math.round((Date.parse(visit.starts_at) - Date.now()) / 60000);
  const isLate = leftMin < settings.free_cancellation_lead_min;
  const hours = Math.round(settings.free_cancellation_lead_min / 60);

  const body = [
    el('p', {}, `${visit.service.title}, ${whenLocal(visit.starts_at, settings.timezone)}, мастер ${visit.master.name}.`),
    isLate
      ? el('div', { className: 'note note--error' },
        `До визита осталось меньше ${hours} ч. Бесплатная отмена уже прошла: студия отметит её как позднюю. `
        + 'Отменить всё равно можно — так время достанется другой клиентке.')
      : el('p', { className: 'muted' },
        `Отмена бесплатна: до визита больше ${hours} ч. Время сразу станет свободным для других.`),
    el('label', { className: 'field' },
      el('span', { className: 'field__label' }, 'Причина — необязательно'),
      el('input', { className: 'field__input', id: 'reason', type: 'text', maxLength: 500,
        placeholder: 'Например: заболела' }))
  ];

  openModal('Отменить запись?', body, 'Да, отменить', guard(async () => {
    const reason = document.getElementById('reason')?.value.trim();
    const result = await api('POST', `/api/appointments/${visit.id}/cancel`,
      reason ? { reason } : {});

    closeModal();
    showOk(`Запись отменена${result.late_cancellation ? ' — отмечена как поздняя' : ''}.`
      + (result.waitlist_notified ? ` Листу ожидания ушло оповещений: ${result.waitlist_notified}.` : ''));
    await load();
  }));
}

// ── Перенос ─────────────────────────────────────────────────────────────────

function askMove(startsAt) {
  const body = [
    el('p', {}, `${visit.service.title}, мастер ${visit.master.name}.`),
    el('div', { className: 'sum__row' },
      el('div', {},
        el('div', { className: 'muted', textContent: 'Сейчас' }),
        el('div', { className: 'sum__value', textContent: whenLocal(visit.starts_at, settings.timezone) }))),
    el('div', { className: 'sum__row' },
      el('div', {},
        el('div', { className: 'muted', textContent: 'Станет' }),
        el('div', { className: 'sum__value', textContent: whenLocal(startsAt, settings.timezone) }))),
    el('p', { className: 'muted' }, 'Старое время сразу освободится для других клиенток.')
  ];

  openModal('Перенести запись?', body, 'Да, перенести', async () => {
    clearMsg();
    try {
      await api('PATCH', `/api/appointments/${visit.id}`, { starts_at: startsAt });
      closeModal();
      history.replaceState(null, '', `/appointment?id=${visit.id}`);
      showOk('Запись перенесена.');
      await load();
    } catch (err) {
      closeModal();
      showError(err);

      /* Сервер прислал ближайшие свободные окна — показываем их кнопками. */
      const available = Array.isArray(err.details?.available) ? err.details.available : [];
      if (available.length === 0) return;

      document.getElementById('msg').append(
        el('p', { className: 'muted conflict__label' }, 'Ближайшее свободное время:'),
        el('div', { className: 'slots__grid conflict__slots' }, ...available.map((slot) => {
          const btn = el('button', { type: 'button', className: 'slot slot--wide',
            textContent: `${slot.date} · ${slot.local_time}` });
          btn.addEventListener('click', () => askMove(slot.starts_at));
          return btn;
        })),
        el('p', { className: 'muted' },
          el('a', { href: `/booking-time?mode=reschedule&appointment=${visit.id}`, textContent: 'Открыть календарь' }))
      );
    }
  });
}

// ── Загрузка ────────────────────────────────────────────────────────────────

async function load() {
  settings = await studio();
  visit = await api('GET', `/api/appointments/${id}`);
  render();
}

await guard(async () => {
  await load();
  /* Пришли из календаря в режиме переноса — сразу спрашиваем подтверждение. */
  if (moveTo) askMove(moveTo);
  /* Пришли из карточки в кабинете по кнопке «Отменить» — тоже сразу. */
  else if (params.get('cancel') === '1' && ['pending', 'confirmed'].includes(visit.status)) askCancel();
})();
