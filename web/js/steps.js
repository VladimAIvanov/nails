/* Шаг-индикатор записи: «Услуга — Мастер — Время — Подтверждение».

   Пройденные шаги кликабельны — на них можно вернуться и поменять выбор.
   Будущие приглушены и не нажимаются: возвращаться назад осмысленно,
   перепрыгивать вперёд — нет. */
import { el } from './api.js';
import { read } from './store.js';

const STEPS = [
  { id: 'services', title: 'Услуга', href: '/booking' },
  { id: 'master', title: 'Мастер', href: '/booking-master' },
  { id: 'time', title: 'Время', href: '/booking-time' },
  { id: 'confirm', title: 'Подтверждение', href: '/booking-confirm' }
];

export function renderSteps(current) {
  const mount = document.getElementById('steps');
  if (!mount) return;

  const state = read();
  const index = STEPS.findIndex((s) => s.id === current);

  /* Шаг доступен, если он пройден: для этого нужны данные предыдущих. */
  const reachable = (i) => {
    if (i <= index) return true;
    if (i >= 1 && state.serviceIds.length === 0) return false;
    if (i >= 2 && !state.masterId && !state.anyMaster) return false;
    if (i >= 3 && !state.startsAt) return false;
    return true;
  };

  mount.className = 'steps';
  mount.replaceChildren(...STEPS.map((step, i) => {
    const label = el('span', { className: 'steps__num', textContent: String(i + 1) });
    const text = el('span', { className: 'steps__title', textContent: step.title });

    const done = i < index;
    const state_ = i === index ? 'steps__item--current' : done ? 'steps__item--done' : 'steps__item--future';

    if (i !== index && reachable(i)) {
      return el('a', { className: `steps__item ${state_}`, href: step.href }, label, text);
    }
    return el('span', { className: `steps__item ${state_}` }, label, text);
  }));
}
