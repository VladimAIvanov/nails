/* Записи студии: день, действия с чужими визитами, блокировка времени.

   Самый ответственный экран панели: здесь администратор меняет чужие планы.
   Поэтому у каждого действия три обязательных свойства — оно оставляет след
   в журнале статусов, не удаляет историю и доходит до клиентки уведомлением.
   Ни одно из трёх не делается здесь: всё это сервер. Экран отвечает за то,
   чтобы человек понимал, что именно он сейчас сделает.

   Время везде показывается по часовому поясу студии. В базе оно в UTC,
   пояс приходит в GET /api/studio, своей арифметики поясов на странице нет:
   пересчёт делает toUtcIso/localParts из api.js по названию зоны. */
import {
  api, guard, el, fill, money, showOk, clearMsg, studio, toUtcIso, localParts
} from './api.js';
import './admin.js';

const list = document.getElementById('list');
const tiles = document.getElementById('tiles');
const blocks = document.getElementById('blocks');
const dateInput = document.getElementById('date');
const masterFilter = document.getElementById('master-filter');
const showCancelled = document.getElementById('show-cancelled');
const dayTitle = document.getElementById('day-title');

const newForm = document.getElementById('new-form');
const blockForm = document.getElementById('block-form');
const overlapBox = document.getElementById('overlap');

let settings = null;
let masters = [];
let services = [];
let data = { summary: {}, appointments: [] };
let dayBlocks = [];

const STATUS_TAG = {
  pending: 'tag--warn',
  confirmed: '',
  done: '',
  cancelled: 'tag--off',
  no_show: 'tag--off'
};

const KIND_TITLES = {
  vacation: 'отпуск', break: 'перерыв', sick: 'больничный',
  holiday: 'выходной', other: 'блокировка'
};

const today = () => localParts(new Date().toISOString(), settings.timezone).date;
const hhmm = (iso) => localParts(iso, settings.timezone).time;

/* Старые записи журнала хранят время переноса в формате базы
   («2026-09-22T11:00:00Z»). Показываем его по часам студии. */
const noteText = (note) => note.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/g, (iso) => {
  const { date, time } = localParts(iso, settings.timezone);
  return `${date.slice(8, 10)}.${date.slice(5, 7)} ${time}`;
});

function shiftDay(days) {
  const d = new Date(`${dateInput.value}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  dateInput.value = d.toISOString().slice(0, 10);
  reload();
}

const longDate = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString('ru-RU', {
  weekday: 'long', day: 'numeric', month: 'long'
});

// ── Наложения ───────────────────────────────────────────────────────────────

/* Наложение определяется по времени, а не по признаку allow_overlap: признак
   стоит на новой записи, а отметить нужно обе — и ту, поверх которой пришли. */
function overlapping(row) {
  if (row.status === 'cancelled') return false;
  return data.appointments.some((other) =>
    other.id !== row.id
    && other.master.id === row.master.id
    && other.status !== 'cancelled'
    && other.starts_at < row.ends_at && other.ends_at > row.starts_at);
}

// ── Действия с записью ──────────────────────────────────────────────────────

/* Панель действия раскрывается внутри строки, а не поверх экрана: человек
   должен видеть, с какой именно записью он работает. */
function actionPanel(...children) {
  return el('div', { className: 'act' }, ...children);
}

function cancelPanel(row) {
  const reason = el('input', {
    className: 'field__input', type: 'text', maxLength: 300,
    placeholder: 'Причина: мастер заболел, студия закрыта…'
  });

  const confirm = el('button', { type: 'button', className: 'btn btn--sm', textContent: 'Отменить визит' });
  confirm.addEventListener('click', guard(async () => {
    confirm.disabled = true;
    await api('POST', `/api/appointments/${row.id}/cancel`, { reason: reason.value.trim() || null });
    await reload();
    showOk(`Визит ${row.client.name} отменён. Запись осталась в списке с пометкой, время снова свободно, `
      + 'клиентке ушло уведомление в кабинет');
  }));

  return actionPanel(
    el('p', { className: 'caption' },
      'Запись не удаляется: она останется в списке и в кабинете клиентки со статусом «отменена». '
      + 'Причина попадёт в журнал записи и в уведомление.'),
    el('label', { className: 'field' },
      el('span', { className: 'field__label', textContent: 'Причина' }), reason),
    el('div', { className: 'row' }, confirm,
      el('button', { type: 'button', className: 'btn btn--ghost btn--sm', textContent: 'Не отменять' })));
}

function movePanel(row) {
  const date = el('input', {
    className: 'field__input', type: 'date', value: localParts(row.starts_at, settings.timezone).date
  });
  const slots = el('div', { className: 'chips' });
  const chosen = { at: null };

  const confirm = el('button', {
    type: 'button', className: 'btn btn--sm', textContent: 'Перенести', disabled: true
  });

  async function loadSlots() {
    slots.replaceChildren(el('span', { className: 'muted', textContent: 'Ищем свободные окна…' }));
    chosen.at = null;
    confirm.disabled = true;
    try {
      const free = await api('GET',
        `/api/masters/${row.master.id}/slots?date=${date.value}&service_id=${row.service_id}&exclude_appointment_id=${row.id}`);
      const items = (free.slots ?? []).filter((s) => s.is_free !== false);
      if (items.length === 0) {
        slots.replaceChildren(el('span', { className: 'muted', textContent: 'Свободных окон в этот день нет' }));
        return;
      }
      slots.replaceChildren(...items.map((s) => {
        const chip = el('button', {
          type: 'button', className: 'chip', textContent: hhmm(s.starts_at)
        });
        chip.addEventListener('click', () => {
          chosen.at = s.starts_at;
          confirm.disabled = false;
          for (const other of slots.children) other.classList.remove('chip--on');
          chip.classList.add('chip--on');
        });
        return chip;
      }));
    } catch (err) {
      slots.replaceChildren(el('span', { className: 'note note--error', textContent: err.message }));
    }
  }

  date.addEventListener('change', loadSlots);
  loadSlots();

  confirm.addEventListener('click', guard(async () => {
    confirm.disabled = true;
    await api('PATCH', `/api/appointments/${row.id}`, { starts_at: chosen.at });
    await reload();
    showOk(`Визит ${row.client.name} перенесён на ${hhmm(chosen.at)}. Это та же запись с новым временем — `
      + 'второй в истории не появилось, клиентке ушло одно уведомление');
  }));

  return actionPanel(
    el('p', { className: 'caption' },
      'Меняется время у этой же записи. Старое время освободится, новой строки в истории не появится, '
      + 'клиентка получит одно уведомление «было — стало».'),
    el('label', { className: 'field' },
      el('span', { className: 'field__label', textContent: 'День' }), date),
    slots,
    el('div', { className: 'row' }, confirm,
      el('button', { type: 'button', className: 'btn btn--ghost btn--sm', textContent: 'Не переносить' })));
}

// ── Строка записи ───────────────────────────────────────────────────────────

function card(row) {
  const cancelled = row.status === 'cancelled';
  const slot = el('div', { className: 'act-slot' });

  function open(build) {
    if (slot.firstChild) { slot.replaceChildren(); return; }
    const panel = build(row);
    /* Кнопка «не отменять / не переносить» в панели закрывает её саму. */
    for (const btn of panel.querySelectorAll('.btn--ghost')) {
      btn.addEventListener('click', () => slot.replaceChildren());
    }
    slot.replaceChildren(panel);
  }

  const actions = [];
  if (row.status === 'pending') {
    const ok = el('button', { type: 'button', className: 'btn btn--sm', textContent: 'Подтвердить' });
    ok.addEventListener('click', guard(async () => {
      ok.disabled = true;
      await api('POST', `/api/admin/appointments/${row.id}/confirm`);
      await reload();
      showOk(`Визит ${row.client.name} подтверждён`);
    }));
    actions.push(ok);
  }
  if (!cancelled && row.status !== 'done') {
    const move = el('button', { type: 'button', className: 'btn btn--secondary btn--sm', textContent: 'Перенести' });
    move.addEventListener('click', () => open(movePanel));
    const drop = el('button', { type: 'button', className: 'btn btn--secondary btn--sm', textContent: 'Отменить' });
    drop.addEventListener('click', () => open(cancelPanel));
    actions.push(move, drop);
  }

  const tags = [
    el('span', { className: `tag ${STATUS_TAG[row.status] ?? ''}`, textContent: row.status_title })
  ];
  if (overlapping(row)) {
    tags.push(el('span', { className: 'tag tag--warn', textContent: 'Наложение: два визита на одно время' }));
  }
  if (row.source === 'admin') tags.push(el('span', { className: 'tag', textContent: 'оформлено студией' }));

  return el('div', { className: `rec appt-row${cancelled ? ' rec--off' : ''}` },
    el('div', { className: 'appt-time' },
      el('strong', { textContent: hhmm(row.starts_at) }),
      el('span', { className: 'caption', textContent: `до ${hhmm(row.ends_at)}` })),
    el('div', { className: 'rec__main' },
      el('div', { className: 'rec__title', textContent: row.client.name }),
      el('div', { className: 'rec__sub', textContent: `${row.client.phone} · ${row.service} · ${row.master.name}` }),
      /* Кто и почему тронул запись — прямо в строке. Иначе «почему её
         отменили» приходится выяснять, открывая карточку. */
      row.last_note
        ? el('div', { className: 'rec__sub caption', textContent: `${noteText(row.last_note)}${row.last_by ? ` — ${row.last_by}` : ''}` })
        : null,
      el('div', { className: 'tags' }, ...tags),
      slot),
    el('div', { className: 'rec__side' },
      el('span', { className: 'rec__price', textContent: money(row.price_kopecks) }),
      ...actions));
}

// ── Сводка и блокировки ─────────────────────────────────────────────────────

function tile(value, label) {
  return el('div', { className: 'card kpi' },
    el('div', { className: 'kpi__v', textContent: value }),
    el('div', { className: 'kpi__l', textContent: label }));
}

function renderTiles() {
  const s = data.summary;
  tiles.replaceChildren(
    tile(String(data.appointments.length), 'записей в этот день'),
    tile(String(s.pending ?? 0), 'ждут подтверждения'),
    tile(money(s.expected_revenue_kopecks ?? 0), 'ожидаемая выручка'),
    tile(String(s.cancelled ?? 0), 'отменённых'));
}

function renderBlocks() {
  if (dayBlocks.length === 0) {
    blocks.replaceChildren(el('p', { className: 'muted', textContent: 'Заблокированного времени в этот день нет.' }));
    return;
  }

  blocks.replaceChildren(...dayBlocks.map((b) => {
    const drop = el('button', { type: 'button', className: 'btn btn--ghost btn--sm', textContent: 'Снять' });
    drop.addEventListener('click', guard(async () => {
      drop.disabled = true;
      await api('DELETE', `/api/admin/time-off/${b.id}`);
      await reload();
      showOk('Блокировка снята — время снова предлагается клиентам');
    }));

    return el('div', { className: 'rec' },
      el('div', { className: 'rec__main' },
        el('div', { className: 'rec__title', textContent: `${hhmm(b.starts_at)} — ${hhmm(b.ends_at)}` }),
        el('div', { className: 'rec__sub' },
          [b.master_name ?? 'вся студия', KIND_TITLES[b.kind] ?? b.kind, b.reason].filter(Boolean).join(' · '))),
      el('div', { className: 'rec__side' }, drop));
  }));
}

function render() {
  dayTitle.textContent = longDate(dateInput.value);
  renderTiles();
  renderBlocks();

  const rows = showCancelled.checked
    ? data.appointments
    : data.appointments.filter((a) => a.status !== 'cancelled');

  if (rows.length === 0) {
    list.replaceChildren(el('div', { className: 'adm__empty' },
      el('h2', { textContent: 'Записей нет' }),
      el('p', { textContent: data.appointments.length > 0
        ? 'Все записи этого дня отменены. Включите «показывать отменённые», чтобы их увидеть.'
        : 'В этот день к студии никто не записан.' })));
    return;
  }

  list.replaceChildren(...rows.map(card));
}

async function reload() {
  const params = new URLSearchParams({ date: dateInput.value, limit: '200' });
  if (masterFilter.value) params.set('master_id', masterFilter.value);

  const [appointments, timeOff] = await Promise.all([
    api('GET', `/api/admin/appointments?${params}`),
    api('GET', `/api/admin/time-off?from=${dateInput.value}`)
  ]);

  data = appointments;

  /* Блокировки приходят «от даты и дальше» — на экране дня нужен только он. */
  const dayFrom = toUtcIso(dateInput.value, '00:00', settings.timezone);
  const dayTo = toUtcIso(nextDay(dateInput.value), '00:00', settings.timezone);
  dayBlocks = timeOff.blocks.filter((b) => b.starts_at < dayTo && b.ends_at > dayFrom
    && (!masterFilter.value || String(b.master_id ?? '') === '' || String(b.master_id) === masterFilter.value));

  render();
}

function nextDay(date) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ── Новая запись, в том числе поверх занятого ───────────────────────────────

function fillOptions(select, items, label) {
  select.replaceChildren(...items.map((i) => el('option', { value: String(i.id), textContent: label(i) })));
}

async function createAppointment(allowOverlap) {
  const f = newForm.elements;
  const payload = {
    client_id: Number(f.client_id.value),
    master_id: Number(f.master_id.value),
    service_ids: [Number(f.service_id.value)],
    starts_at: toUtcIso(f.date.value, f.time.value, settings.timezone),
    comment: f.comment.value.trim() || undefined
  };
  if (allowOverlap) payload.allow_overlap = true;

  try {
    await api('POST', '/api/admin/appointments', payload);
    overlapBox.replaceChildren();
    newForm.reset();
    await reload();
    showOk(allowOverlap
      ? 'Запись создана поверх занятого времени. В списке оба визита отмечены наложением, '
        + 'клиентке из первой записи ушло уведомление'
      : 'Запись создана');
  } catch (err) {
    /* Проверка занятости не отключена и для администратора: сервер отвечает
       409 как обычно. Право записать поверх есть, но воспользоваться им можно
       только осознанно — вторым действием, а не незаметно первым. */
    if (err.status !== 409) throw err;
    showOverlapWarning(err);
  }
}

function showOverlapWarning(err) {
  const alternatives = err.details?.available ?? [];

  const force = el('button', {
    type: 'button', className: 'btn btn--sm', textContent: 'Всё равно записать поверх'
  });
  force.addEventListener('click', guard(async () => {
    force.disabled = true;
    clearMsg();
    await createAppointment(true);
  }));

  fill(overlapBox,
    el('div', { className: 'note note--info' },
      el('strong', { textContent: 'Это время занято. ' }),
      'Можно выбрать свободное окно или записать поверх — тогда на один интервал '
      + 'будет назначено два визита, а клиентка из первой записи получит уведомление.'),
    alternatives.length
      ? el('div', { className: 'chips' }, ...alternatives.map((s) => {
        const chip = el('button', { type: 'button', className: 'chip', textContent: hhmm(s.starts_at) });
        chip.addEventListener('click', () => {
          newForm.elements.time.value = localParts(s.starts_at, settings.timezone).time;
          newForm.elements.date.value = localParts(s.starts_at, settings.timezone).date;
          overlapBox.replaceChildren();
        });
        return chip;
      }))
      : null,
    el('div', { className: 'row' }, force));
}

newForm.addEventListener('submit', guard(async (event) => {
  event.preventDefault();
  overlapBox.replaceChildren();
  await createAppointment(false);
}, 'msg', newForm));

/* Поиск клиентки: администратор помнит имя или телефон, а не номер в базе. */
const clientSearch = document.getElementById('client-search');
clientSearch.addEventListener('input', guard(async () => {
  const query = clientSearch.value.trim();
  if (query.length < 2) return;
  const { clients } = await api('GET', `/api/admin/clients?search=${encodeURIComponent(query)}`);
  fillOptions(newForm.elements.client_id, clients, (c) => `${c.full_name} · ${c.phone}`);
}));

// ── Блокировка времени ──────────────────────────────────────────────────────

blockForm.addEventListener('submit', guard(async (event) => {
  event.preventDefault();
  const f = blockForm.elements;

  const answer = await api('POST', '/api/admin/time-off', {
    master_id: f.master_id.value ? Number(f.master_id.value) : null,
    starts_at: toUtcIso(f.date.value, f.from.value, settings.timezone),
    ends_at: toUtcIso(f.date.value, f.to.value, settings.timezone),
    kind: f.kind.value,
    reason: f.reason.value.trim() || undefined
  });

  await reload();

  /* Блокировка не выселяет уже записанных: если под неё попали визиты,
     студия должна узнать об этом сразу, а не когда клиентка придёт. */
  const affected = answer.appointments_to_reschedule ?? [];
  showOk(affected.length === 0
    ? 'Время заблокировано. Мастер остался в списке — недоступны только эти часы'
    : `Время заблокировано. Под него попали уже назначенные визиты (${affected.length}) — `
      + 'их нужно перенести или отменить вручную, сами они никуда не делись');
}, 'msg', blockForm));

// ── Загрузка ────────────────────────────────────────────────────────────────

for (const [id, days] of [['prev', -1], ['next', 1]]) {
  document.getElementById(id).addEventListener('click', () => shiftDay(days));
}
document.getElementById('today').addEventListener('click', () => {
  dateInput.value = today();
  reload();
});
dateInput.addEventListener('change', () => reload());
masterFilter.addEventListener('change', () => reload());
showCancelled.addEventListener('change', render);

await guard(async () => {
  settings = await studio();
  dateInput.value = today();
  blockForm.elements.date.value = today();
  newForm.elements.date.value = today();

  const [staff, catalog] = await Promise.all([
    api('GET', '/api/admin/masters'),
    api('GET', '/api/admin/services')
  ]);
  masters = staff.masters;
  services = catalog.services.filter((s) => s.is_active === 1);

  masterFilter.replaceChildren(
    el('option', { value: '', textContent: 'Все мастера' }),
    ...masters.map((m) => el('option', { value: String(m.id), textContent: m.full_name })));

  blockForm.elements.master_id.replaceChildren(
    el('option', { value: '', textContent: 'Вся студия' }),
    ...masters.map((m) => el('option', { value: String(m.id), textContent: m.full_name })));

  fillOptions(newForm.elements.master_id, masters, (m) => m.full_name);
  fillOptions(newForm.elements.service_id, services, (s) => `${s.title} · ${money(s.price_kopecks)}`);

  await reload();
})();
