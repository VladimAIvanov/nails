/* Шаг 1: выбор услуг.

   Цена и длительность каждой услуги приходят от сервера — здесь их только
   складывают, чтобы показать итог по корзине. Настоящую длительность визита
   (с перерывом мастера) считает сервер: она приедет на шаге выбора времени
   в ответе /api/masters/:id/slots и там же будет показана. */
import { api, guard, el, money, duration } from './api.js';
import { renderHeader } from './header.js';
import { renderSteps } from './steps.js';
import { read, write, missing } from './store.js';

renderHeader();
renderSteps('services');

const state = read();
let chosen = new Set(state.serviceIds);
let catalog = [];
let activeCategory = '';

/* Ссылка с лендинга «Записаться на услугу» приводит с уже выбранной. */
const wanted = new URLSearchParams(location.search).get('service_id');
if (wanted) chosen.add(Number(wanted));

const list = document.getElementById('services-list');
const summary = document.getElementById('summary');
const hint = document.getElementById('hint');
const next = document.getElementById('next');

function card(s) {
  const on = chosen.has(s.id);

  const node = el('article', {
    className: `card service service--pick${on ? ' service--on' : ''}`,
    tabIndex: 0,
    role: 'button',
    'aria-pressed': String(on)
  },
  el('div', { className: 'service__head' },
    el('h3', { className: 'service__title', textContent: s.title }),
    s.badge ? el('span', { className: 'badge', textContent: s.badge }) : null),
  s.description ? el('p', { className: 'service__text', textContent: s.description }) : null,
  el('div', { className: 'service__foot' },
    el('span', { className: 'muted', textContent: `${s.duration_is_from ? 'от ' : ''}${duration(s.duration_min)}` }),
    el('span', { className: 'price', textContent: `${s.price_is_from ? 'от ' : ''}${money(s.price_kopecks)}` })),
  el('span', { className: 'service__mark', textContent: on ? 'выбрано' : 'выбрать' }));

  const toggle = () => {
    if (chosen.has(s.id)) chosen.delete(s.id); else chosen.add(s.id);
    write({ serviceIds: [...chosen] });
    render();
  };

  node.addEventListener('click', toggle);
  node.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });
  return node;
}

function render() {
  const shown = activeCategory
    ? catalog.filter((s) => s.category.slug === activeCategory)
    : catalog;

  list.replaceChildren(
    ...(shown.length ? shown.map(card) : [el('p', { className: 'muted' }, 'В этой категории услуг нет')])
  );
  renderSummary();
}

function renderSummary() {
  const picked = catalog.filter((s) => chosen.has(s.id));

  if (picked.length === 0) {
    summary.textContent = 'Ничего не выбрано';
  } else {
    const minutes = picked.reduce((sum, s) => sum + s.duration_min, 0);
    const price = picked.reduce((sum, s) => sum + s.price_kopecks, 0);
    const approx = picked.some((s) => s.price_is_from || s.duration_is_from);

    summary.replaceChildren(
      el('span', { className: 'bar__count', textContent: `${picked.length} ${plural(picked.length)}` }),
      el('span', { className: 'bar__total', textContent: `${approx ? 'от ' : ''}${money(price)}` }),
      el('span', { className: 'muted', textContent: `≈ ${duration(minutes)} без перерыва мастера` })
    );
  }

  const problem = missing('services');
  hint.textContent = problem;
  next.disabled = Boolean(problem);
}

const plural = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'услуга'
  : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'услуги' : 'услуг');

next.addEventListener('click', () => {
  write({ serviceIds: [...chosen] });
  location.href = '/booking-master';
});

await guard(async () => {
  const data = await api('GET', '/api/services');
  catalog = data.services;

  const box = document.getElementById('categories');
  const all = [{ slug: '', title: 'Все' }, ...data.categories];
  box.replaceChildren(...all.map((c) => {
    const chip = el('button', {
      type: 'button',
      className: `chip${c.slug === activeCategory ? ' chip--on' : ''}`,
      textContent: c.title
    });
    chip.addEventListener('click', () => {
      activeCategory = c.slug;
      for (const other of box.children) other.classList.remove('chip--on');
      chip.classList.add('chip--on');
      render();
    });
    return chip;
  }));

  render();
})();
