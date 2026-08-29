/* Шаг 2: выбор мастера.

   Список запрашивается дважды: все мастера студии и те, кто делает
   выбранные услуги. Разница между списками — те, кого показываем неактивными
   с пояснением. Прятать их нельзя: человек ищет знакомое имя и должен
   понять, почему оно недоступно, а не решить, что мастер уволился. */
import { api, guard, el } from './api.js';
import { renderHeader } from './header.js';
import { renderSteps } from './steps.js';
import { read, write, missing } from './store.js';

renderHeader();
renderSteps('master');

const state = read();
if (state.serviceIds.length === 0) location.href = '/booking';

let picked = state.masterId;
let anyMaster = state.anyMaster;

const list = document.getElementById('masters-list');
const summary = document.getElementById('summary');
const hint = document.getElementById('hint');
const next = document.getElementById('next');

function choose(id, any = false) {
  picked = id;
  anyMaster = any;
  write({ masterId: id, anyMaster: any });
  render();
}

let all = [];
let able = new Set();
let services = [];

function card(m) {
  const can = able.has(m.id);
  const online = m.accepts_online_booking;
  const available = can && online;
  const on = picked === m.id && !anyMaster;

  const why = !can
    ? 'Не делает выбранные услуги'
    : !online
      ? 'Не принимает онлайн-запись — запишет студия по телефону'
      : null;

  const node = el('article', {
    className: `card master master--pick${on ? ' master--on' : ''}${available ? '' : ' master--off'}`,
    ...(available ? { tabIndex: 0, role: 'button', 'aria-pressed': String(on) } : { 'aria-disabled': 'true' })
  },
  el('div', { className: 'avatar avatar--lg', textContent: (m.name ?? '·')[0] }),
  el('h3', { className: 'master__name', textContent: m.name }),
  el('p', { className: 'muted', textContent: m.specialization.join(', ') || 'Мастер студии' }),
  el('p', { className: 'master__rating', textContent: m.rating ? `★ ${m.rating} · ${m.reviews_count} отзывов` : 'пока без отзывов' }),
  why ? el('p', { className: 'master__why', textContent: why }) : null,
  available ? el('span', { className: 'service__mark', textContent: on ? 'выбран' : 'выбрать' }) : null);

  if (available) {
    node.addEventListener('click', () => choose(m.id));
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(m.id); }
    });
  }
  return node;
}

function anyCard() {
  const on = anyMaster;
  const node = el('article', {
    className: `card master master--pick master--any${on ? ' master--on' : ''}`,
    tabIndex: 0, role: 'button', 'aria-pressed': String(on)
  },
  el('div', { className: 'avatar avatar--lg', textContent: '∗' }),
  el('h3', { className: 'master__name', textContent: 'Любой свободный' }),
  el('p', { className: 'muted', textContent: 'Покажем окна всех мастеров, кто делает выбранные услуги' }),
  el('span', { className: 'service__mark', textContent: on ? 'выбран' : 'выбрать' }));

  const pick = () => choose(null, true);
  node.addEventListener('click', pick);
  node.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
  });
  return node;
}

function render() {
  list.replaceChildren(anyCard(), ...all.map(card));

  const chosenMaster = all.find((m) => m.id === picked);
  summary.textContent = anyMaster
    ? 'Любой свободный мастер'
    : chosenMaster
      ? `Мастер: ${chosenMaster.name}`
      : 'Мастер не выбран';

  const problem = missing('master');
  hint.textContent = problem;
  next.disabled = Boolean(problem);
}

next.addEventListener('click', () => { location.href = '/booking-time'; });

await guard(async () => {
  const [everyone, ...perService] = await Promise.all([
    api('GET', '/api/masters'),
    ...state.serviceIds.map((id) => api('GET', `/api/masters?service_id=${id}`))
  ]);

  all = everyone.masters;

  /* Мастер подходит, если делает все выбранные услуги, а не какую-то одну:
     иначе на шаге времени окажется, что визит собрать не из чего. */
  const counts = new Map();
  for (const answer of perService) {
    for (const m of answer.masters) counts.set(m.id, (counts.get(m.id) ?? 0) + 1);
  }
  able = new Set([...counts.entries()]
    .filter(([, count]) => count === state.serviceIds.length)
    .map(([id]) => id));

  const catalog = await api('GET', '/api/services');
  services = catalog.services.filter((s) => state.serviceIds.includes(s.id));
  document.getElementById('sub').textContent =
    `Выбрано: ${services.map((s) => s.title).join(', ')}. Мастера, которые это не делают, показаны неактивными.`;

  /* Если ранее выбранный мастер больше не подходит — снимаем выбор,
     чтобы человек не ушёл дальше с невозможной парой. */
  if (picked && !able.has(picked)) choose(null, anyMaster);

  render();
})();
