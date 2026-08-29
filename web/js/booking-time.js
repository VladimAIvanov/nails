/* Шаг 3: календарь и свободное время.

   Экран ничего не считает сам. Свободные окна, шаг сетки, длительность
   визита с перерывом мастера и причину, по которой окон нет, — всё это
   присылает сервер в ответе /api/masters/:id/slots.

   Единственное, что собирается здесь, — сетка занятого времени. Сервер
   отдаёт только свободные окна; чтобы занятое было видно и неактивно, а не
   исчезало без следа, сетка дня достраивается из рабочих часов студии и
   шага, полученных от того же сервера. Это показ, а не расчёт: свободным
   окно становится только если так сказал сервер.

   У экрана три состояния: загрузка, есть окна, окон нет. Пустая сетка и
   «нет свободного времени» — разные вещи, и клиентка должна их различать. */
import { api, guard, el, studio, duration, whenLocal } from './api.js';
import { renderHeader } from './header.js';
import { renderSteps } from './steps.js';
import { read, write, missing } from './store.js';

renderHeader();
renderSteps('time');

const state = read();
const params = new URLSearchParams(location.search);
const isReschedule = params.get('mode') === 'reschedule';

let settings = null;
let masterId = state.masterId;
let serviceIds = state.serviceIds;
let appointment = null;      // переносимая запись
let month = null;            // первое число показываемого месяца
let dayStatus = new Map();   // дата → 'free' | 'busy' | 'off' | 'past'
let picked = state.startsAt;
let lastAnswer = null;

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayLocal = () => new Intl.DateTimeFormat('en-CA', { timeZone: settings.timezone }).format(new Date());

// ── Подготовка ──────────────────────────────────────────────────────────────

async function prepare() {
  settings = await studio();

  if (isReschedule) {
    /* В режиме переноса услуги и мастер берутся из самой записи и не
       меняются: перенос — это другое время того же визита. */
    appointment = await api('GET', `/api/appointments/${params.get('appointment')}`);
    masterId = appointment.master.id;
    serviceIds = [appointment.service.id];

    document.getElementById('title').textContent = 'Перенос записи';
    document.getElementById('sub').textContent =
      `${appointment.service.title} у мастера ${appointment.master.name}. Услуга и мастер зафиксированы — меняем только время.`;
    document.getElementById('reschedule-note').replaceChildren(
      el('div', { className: 'note note--info' },
        `Сейчас запись стоит на ${whenLocal(appointment.starts_at, settings.timezone)}. Выберите новое окно — старое освободится.`)
    );
    renderSteps('time');
  } else {
    if (serviceIds.length === 0) location.href = '/booking';
    if (!masterId && !state.anyMaster) location.href = '/booking-master';

    /* «Любой свободный»: сервер записывает к конкретному мастеру, поэтому
       выбираем первого, кто делает все услуги, и показываем его окна.
       Расхождение №2 из docs/ui-map.md — автоподбора в API нет. */
    if (!masterId && state.anyMaster) {
      const lists = await Promise.all(serviceIds.map((id) => api('GET', `/api/masters?service_id=${id}`)));
      const counts = new Map();
      for (const answer of lists) {
        for (const m of answer.masters) {
          if (m.accepts_online_booking) counts.set(m.id, (counts.get(m.id) ?? 0) + 1);
        }
      }
      const fits = [...counts.entries()].filter(([, c]) => c === serviceIds.length).map(([id]) => id);
      if (fits.length === 0) throw new Error('Ни один мастер не делает выбранный набор услуг');
      masterId = fits[0];
      write({ masterId });
      document.getElementById('sub').textContent =
        'Показаны окна свободного мастера. Кто именно примет — увидите на подтверждении.';
    }
  }
}

const slotsUrl = (date) => {
  const qs = new URLSearchParams({ date });
  for (const id of serviceIds) qs.append('service_id', String(id));
  return `/api/masters/${masterId}/slots?${qs}`;
};

// ── Календарь ───────────────────────────────────────────────────────────────

function monthDays(first) {
  const days = [];
  const cursor = new Date(first);
  while (cursor.getMonth() === first.getMonth()) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

async function loadMonth() {
  const days = monthDays(month);
  const today = todayLocal();
  const horizon = new Date(`${today}T00:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + settings.booking_horizon_days ?? 60);

  document.getElementById('month').textContent = `${MONTHS[month.getMonth()]} ${month.getFullYear()}`;
  dayStatus = new Map();

  /* Прошедшее и слишком далёкое не спрашиваем: ответ известен заранее. */
  const askable = days.filter((d) => iso(d) >= today && iso(d) <= iso(horizon));
  for (const d of days) {
    if (iso(d) < today) dayStatus.set(iso(d), 'past');
    else if (iso(d) > iso(horizon)) dayStatus.set(iso(d), 'far');
    else dayStatus.set(iso(d), 'loading');
  }
  renderCalendar();

  /* Спрашиваем сервер по дням небольшими пачками: он единственный знает
     про график мастера, отпуска и чужие записи. */
  for (let i = 0; i < askable.length; i += 5) {
    const batch = askable.slice(i, i + 5);
    const answers = await Promise.all(batch.map((d) => api('GET', slotsUrl(iso(d))).catch(() => null)));

    batch.forEach((d, k) => {
      const answer = answers[k];
      if (!answer) { dayStatus.set(iso(d), 'off'); return; }
      if (answer.slots.length > 0) dayStatus.set(iso(d), 'free');
      else if (answer.reason === 'day_off') dayStatus.set(iso(d), 'off');
      else dayStatus.set(iso(d), 'busy');
    });
    renderCalendar();
  }
}

function renderCalendar() {
  const weekdays = document.getElementById('weekdays');
  if (!weekdays.childElementCount) {
    weekdays.replaceChildren(...WEEKDAYS.map((w) => el('span', { className: 'cal__wd', textContent: w })));
  }

  const days = monthDays(month);
  const first = days[0];
  const lead = (first.getDay() + 6) % 7; // неделя начинается с понедельника

  const cells = [
    ...Array.from({ length: lead }, () => el('span', { className: 'cal__cell cal__cell--empty' })),
    ...days.map((d) => {
      const key = iso(d);
      const status = dayStatus.get(key) ?? 'loading';
      const clickable = status === 'free' || status === 'busy';
      const selected = key === (picked ? picked.slice(0, 10) : state.date);

      const cell = el('button', {
        type: 'button',
        className: `cal__cell cal__cell--${status}${selected ? ' cal__cell--on' : ''}`,
        textContent: String(d.getDate()),
        disabled: !clickable,
        title: {
          past: 'День уже прошёл',
          far: 'Дальше горизонта записи',
          off: 'Мастер не работает',
          busy: 'Всё занято',
          free: 'Есть свободные окна',
          loading: 'Считаем…'
        }[status]
      });

      if (clickable) cell.addEventListener('click', guard(() => openDay(key)));
      return cell;
    })
  ];

  document.getElementById('days').replaceChildren(...cells);
}

// ── Окна дня: три состояния ─────────────────────────────────────────────────

const slotsBox = () => document.getElementById('slots');

function showLoading(date) {
  document.getElementById('day-title').textContent = dayTitle(date);
  slotsBox().replaceChildren(
    el('p', { className: 'muted' }, 'Считаем свободное время…'),
    el('div', { className: 'slots__grid' },
      ...Array.from({ length: 8 }, () => el('div', { className: 'skeleton slot-skeleton' })))
  );
  document.getElementById('ends').textContent = '';
}

function dayTitle(date) {
  const d = new Date(`${date}T12:00:00Z`);
  return `${d.getDate()} ${['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля',
    'августа', 'сентября', 'октября', 'ноября', 'декабря'][d.getMonth()]}, ${WEEKDAYS[(d.getDay() + 6) % 7]}`;
}

/* Сетка дня: все точки рабочих часов студии с шагом, который прислал
   сервер. Свободные — те, что он назвал; остальные показываем занятыми. */
function fullGrid(date, answer) {
  const hours = (settings.working_hours ?? []).filter((h) => {
    const weekday = new Date(`${date}T12:00:00Z`).getDay();
    return h.weekday === weekday;
  });
  if (hours.length === 0) return null;

  const step = answer.step_min;
  const free = new Map(answer.slots.map((s) => [s.local_time, s]));
  const points = [];

  for (const h of hours) {
    const [fromH, fromM] = h.starts_at_local.split(':').map(Number);
    const [toH, toM] = h.ends_at_local.split(':').map(Number);
    for (let minutes = fromH * 60 + fromM; minutes + answer.duration_min <= toH * 60 + toM; minutes += step) {
      const label = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      points.push({ label, minutes, slot: free.get(label) ?? null });
    }
  }
  return points;
}

const REASONS = {
  online_booking_disabled: 'Онлайн-запись в студии сейчас выключена',
  master_not_bookable: 'Мастер не принимает онлайн-запись',
  beyond_horizon: 'Эта дата дальше, чем открыта запись',
  day_off: 'В этот день мастер не работает'
};

async function openDay(date) {
  showLoading(date);
  write({ date });

  const answer = await api('GET', slotsUrl(date));
  lastAnswer = answer;

  document.getElementById('day-title').textContent = dayTitle(date);

  if (answer.slots.length === 0) {
    await showEmpty(date, answer);
    renderCalendar();
    return;
  }

  const points = fullGrid(date, answer);
  const groups = [
    ['Утро', points ? points.filter((p) => p.minutes < 12 * 60) : []],
    ['День', points ? points.filter((p) => p.minutes >= 12 * 60 && p.minutes < 17 * 60) : []],
    ['Вечер', points ? points.filter((p) => p.minutes >= 17 * 60) : []]
  ].filter(([, list]) => list.length > 0);

  const blocks = groups.length
    ? groups.map(([title, list]) => el('div', { className: 'slots__group' },
      el('p', { className: 'eyebrow', textContent: title }),
      el('div', { className: 'slots__grid' }, ...list.map((p) => slotButton(p)))))
    : [el('div', { className: 'slots__grid' }, ...answer.slots.map((s) => slotButton({ label: s.local_time, slot: s })))];

  slotsBox().replaceChildren(
    el('p', { className: 'muted' },
      `Визит займёт ${duration(answer.duration_min)}`
      + (answer.buffer_min ? ` вместе с перерывом мастера ${answer.buffer_min} мин` : '')
      + ` · свободно ${answer.free_count}`),
    ...blocks
  );

  renderEnds();
  renderCalendar();
}

function slotButton(point) {
  const free = Boolean(point.slot);
  const on = free && picked === point.slot.starts_at;

  const btn = el('button', {
    type: 'button',
    className: `slot${free ? '' : ' slot--busy'}${on ? ' slot--on' : ''}`,
    textContent: point.label,
    disabled: !free,
    title: free ? 'Свободно' : 'Это время уже занято'
  });

  if (free) {
    btn.addEventListener('click', () => {
      picked = point.slot.starts_at;
      write({ startsAt: picked, holdToken: null, holdExpiresAt: null });
      for (const other of slotsBox().querySelectorAll('.slot--on')) other.classList.remove('slot--on');
      btn.classList.add('slot--on');
      renderEnds();
      renderBar();
    });
  }
  return btn;
}

function renderEnds() {
  const ends = document.getElementById('ends');
  if (!picked || !lastAnswer) { ends.textContent = ''; return; }

  const slot = lastAnswer.slots.find((s) => s.starts_at === picked);
  if (!slot) { ends.textContent = ''; return; }

  /* Конец визита посчитал сервер: он же знает длительность услуг и перерыв. */
  ends.textContent = `Начало в ${slot.local_time}, закончим примерно в `
    + `${whenLocal(slot.ends_at, settings.timezone).split(', ').pop()}.`;
}

/* Состояние «окон нет»: причина и ближайшее свободное время. */
async function showEmpty(date, answer) {
  const reason = REASONS[answer.reason] ?? 'В этот день свободных окон нет';
  const box = slotsBox();

  box.replaceChildren(
    el('div', { className: 'note note--info' }, reason),
    el('p', { className: 'muted' }, 'Ищем ближайшее свободное время…')
  );
  document.getElementById('ends').textContent = '';

  /* Ближайшие дни спрашиваем у сервера — сами ничего не угадываем. */
  const found = [];
  const cursor = new Date(`${date}T12:00:00Z`);
  for (let i = 1; i <= 14 && found.length < 3; i++) {
    cursor.setDate(cursor.getDate() + 1);
    const key = iso(cursor);
    const next = await api('GET', slotsUrl(key)).catch(() => null);
    if (next?.slots?.length) found.push({ date: key, slot: next.slots[0], count: next.free_count });
  }

  box.replaceChildren(
    el('div', { className: 'note note--info' }, reason),
    found.length
      ? el('div', { className: 'stack' },
        el('p', { className: 'muted' }, 'Ближайшее свободное время:'),
        el('div', { className: 'slots__grid' }, ...found.map((f) => {
          const btn = el('button', {
            type: 'button',
            className: 'slot slot--wide',
            textContent: `${dayTitle(f.date)} · ${f.slot.local_time}`
          });
          btn.addEventListener('click', guard(async () => {
            month = new Date(`${f.date}T12:00:00Z`);
            month.setDate(1);
            await loadMonth();
            await openDay(f.date);
          }));
          return btn;
        })))
      : el('p', { className: 'muted' }, 'В ближайшие две недели окон нет.'),
    el('div', { className: 'stack' },
      el('p', { className: 'muted' }, 'Что ещё можно сделать:'),
      el('ul', { className: 'hints' },
        el('li', {}, el('a', { href: '/booking-master', textContent: 'выбрать другого мастера' })),
        el('li', {}, el('a', { href: '/booking', textContent: 'убрать часть услуг — короткий визит легче поместить' })),
        el('li', {}, 'посмотреть соседние дни в календаре слева')))
  );
}

// ── Нижняя полоса ───────────────────────────────────────────────────────────

function renderBar() {
  const summary = document.getElementById('summary');
  const hint = document.getElementById('hint');
  const next = document.getElementById('next');

  summary.textContent = picked
    ? `Выбрано: ${whenLocal(picked, settings.timezone)}`
    : 'Время не выбрано';

  const problem = picked ? '' : 'Выберите свободное окно';
  hint.textContent = problem;
  next.disabled = Boolean(problem);
}

document.getElementById('next').addEventListener('click', () => {
  write({ startsAt: picked, rescheduleId: isReschedule ? Number(params.get('appointment')) : null });
  location.href = isReschedule
    ? `/appointment?id=${params.get('appointment')}&move=${encodeURIComponent(picked)}`
    : '/booking-confirm';
});

document.getElementById('prev').addEventListener('click', guard(async () => {
  month = new Date(month); month.setMonth(month.getMonth() - 1); await loadMonth();
}));
document.getElementById('next-month').addEventListener('click', guard(async () => {
  month = new Date(month); month.setMonth(month.getMonth() + 1); await loadMonth();
}));

await guard(async () => {
  await prepare();

  const today = todayLocal();
  month = new Date(`${today}T12:00:00Z`);
  month.setDate(1);

  renderBar();
  await loadMonth();

  /* Открываем первый день с окнами: пустой экран рядом с календарём
     выглядит как поломка. */
  const firstFree = [...dayStatus.entries()].find(([, s]) => s === 'free')?.[0];
  if (firstFree) await openDay(state.date && dayStatus.get(state.date) === 'free' ? state.date : firstFree);
})();
