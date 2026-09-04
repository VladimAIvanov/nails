/* Услуги: список, добавление, правка, включение и отключение.

   Администратор видит все строки, включая отключённые, — иначе вернуть
   услугу в работу неоткуда. Клиент видит только включённые: этим занимается
   сервер, `GET /api/services` отбирает по is_active и is_online_bookable.

   Что произойдёт по кнопке «Удалить», решает не эта страница, а сервер:
   строку без ссылок он удаляет, строку с историей отключает и объясняет,
   почему. Поэтому здесь нет ни «вы уверены?», ни собственной проверки —
   странице неоткуда знать, есть ли по услуге записи. */
import { api, guard, el, money, showOk, clearMsg } from './api.js';
import './admin.js';

const list = document.getElementById('list');
const form = document.getElementById('form');
const formTitle = document.getElementById('form-title');
const submit = document.getElementById('submit');
const cancel = document.getElementById('cancel');
const remove = document.getElementById('remove');

/* Поля читаются через form.elements, а не form.<имя>: у HTMLElement уже есть
   свойство title, и form.title вернуло бы атрибут формы, а не поле ввода. */

let services = [];
let categories = [];
let masters = [];
let editing = null;

/* Код услуги — латиницей: он уходит в адреса и в фильтр категорий. Придумывать
   его руками незачем, поэтому пока поле не трогали, оно заполняется из
   названия. Как только администратор правит код сам, подстановка прекращается:
   его вариант важнее нашего. */
const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya'
};

const toSlug = (text) => text.toLowerCase()
  .split('').map((c) => (c in TRANSLIT ? TRANSLIT[c] : c)).join('')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

let slugTouched = false;

// ── Список ──────────────────────────────────────────────────────────────────

const mastersFor = (serviceId) => masters.filter((m) => m.service_ids.includes(serviceId));

function card(s) {
  const category = categories.find((c) => c.id === s.category_id);
  const who = mastersFor(s.id);

  const tags = [];
  if (s.is_active !== 1) tags.push(el('span', { className: 'tag tag--off', textContent: 'Отключена' }));
  if (s.is_online_bookable !== 1) tags.push(el('span', { className: 'tag tag--warn', textContent: 'Не в онлайн-записи' }));
  /* Услуга без мастера видна в прайсе, но записаться на неё не к кому —
     клиент узнаёт об этом только на втором шаге. Предупреждаем здесь. */
  if (who.length === 0) tags.push(el('span', { className: 'tag tag--warn', textContent: 'Нет мастера' }));

  const toggle = el('input', { type: 'checkbox', checked: s.is_active === 1 });
  toggle.addEventListener('change', guard(async () => {
    toggle.disabled = true;
    await api('PATCH', `/api/admin/services/${s.id}`, { is_active: toggle.checked });
    showOk(toggle.checked
      ? `Услуга «${s.title}» включена — клиенты снова её видят`
      : `Услуга «${s.title}» отключена — из выбора при записи она пропала, прошлые визиты остались`);
    await reload();
  }));

  const edit = el('button', { type: 'button', className: 'btn btn--secondary btn--sm', textContent: 'Править' });
  edit.addEventListener('click', () => startEdit(s));

  return el('div', { className: `rec${s.is_active === 1 ? '' : ' rec--off'}${editing === s.id ? ' rec--editing' : ''}` },
    el('div', { className: 'rec__main' },
      el('div', { className: 'rec__title', textContent: s.title }),
      el('div', { className: 'rec__sub' },
        [category?.title, `${s.duration_min} мин`,
          s.buffer_after_min ? `+${s.buffer_after_min} мин на уборку` : null,
          who.length ? `мастера: ${who.map((m) => m.full_name).join(', ')}` : null
        ].filter(Boolean).join(' · ')),
      s.description ? el('div', { className: 'rec__sub', textContent: s.description }) : null,
      tags.length ? el('div', { className: 'tags' }, ...tags) : null),
    el('div', { className: 'rec__side' },
      el('span', { className: 'rec__price', textContent: (s.price_is_from ? 'от ' : '') + money(s.price_kopecks) }),
      el('label', { className: 'switch', title: 'Включена' },
        toggle, el('span', { className: 'switch__track' })),
      edit));
}

function render() {
  list.replaceChildren(...services.map(card));
  document.getElementById('count').textContent =
    `${services.length} в справочнике, из них включённых ${services.filter((s) => s.is_active === 1).length}`;
}

async function reload() {
  const [adminServices, catalog, staff] = await Promise.all([
    api('GET', '/api/admin/services'),
    api('GET', '/api/services'),
    api('GET', '/api/admin/masters')
  ]);

  services = adminServices.services;
  categories = catalog.categories;
  masters = staff.masters;

  const select = form.elements.category_id;
  const chosen = select.value;
  select.replaceChildren(...categories.map((c) => el('option', { value: String(c.id), textContent: c.title })));
  if (chosen) select.value = chosen;

  render();
}

// ── Форма ───────────────────────────────────────────────────────────────────

function startCreate() {
  editing = null;
  slugTouched = false;
  form.reset();
  form.elements.is_online_bookable.checked = true;
  formTitle.textContent = 'Новая услуга';
  submit.textContent = 'Добавить услугу';
  form.elements.slug.disabled = false;
  remove.hidden = true;
  cancel.hidden = true;
  render();
}

function startEdit(s) {
  editing = s.id;
  slugTouched = true;
  form.elements.title.value = s.title;
  form.elements.slug.value = s.slug;
  form.elements.description.value = s.description ?? '';
  form.elements.category_id.value = String(s.category_id);
  form.elements.duration_min.value = String(s.duration_min);
  form.elements.price.value = String(s.price_kopecks / 100);
  form.elements.buffer_after_min.value = s.buffer_after_min === null ? '' : String(s.buffer_after_min);
  form.elements.is_online_bookable.checked = s.is_online_bookable === 1;

  formTitle.textContent = `Правка: ${s.title}`;
  submit.textContent = 'Сохранить';
  /* Код услуги не меняем: на него ссылаются адреса каталога, и смена кода
     тихо ломает ссылку, которую кто-то уже сохранил. */
  form.elements.slug.disabled = true;
  remove.hidden = false;
  cancel.hidden = false;
  render();
  form.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

form.elements.title.addEventListener('input', () => {
  if (!slugTouched) form.elements.slug.value = toSlug(form.elements.title.value);
});
form.elements.slug.addEventListener('input', () => { slugTouched = true; });
cancel.addEventListener('click', () => { clearMsg(); startCreate(); });

/* Рубли на форме, копейки в запросе. В базе цена целым числом копеек —
   иначе 3200.10 однажды превратится в 3200.099999999999. */
const kopecks = (rub) => Math.round(Number(String(rub).replace(',', '.')) * 100);

form.addEventListener('submit', guard(async () => {
  const payload = {
    title: form.elements.title.value.trim(),
    description: form.elements.description.value.trim() || null,
    category_id: Number(form.elements.category_id.value),
    duration_min: Number(form.elements.duration_min.value),
    price_kopecks: kopecks(form.elements.price.value),
    buffer_after_min: form.elements.buffer_after_min.value === '' ? undefined : Number(form.elements.buffer_after_min.value),
    is_online_bookable: form.elements.is_online_bookable.checked
  };

  if (editing === null) {
    const created = await api('POST', '/api/admin/services', { ...payload, slug: form.elements.slug.value.trim() });
    await reload();
    startCreate();
    showOk(`Услуга «${created.title}» добавлена. Чтобы она появилась у клиента, закрепите её хотя бы за одним мастером`);
  } else {
    const saved = await api('PATCH', `/api/admin/services/${editing}`, payload);
    await reload();
    startCreate();
    showOk(`Услуга «${saved.title}» сохранена. Цена и длительность прошлых записей не изменились: они хранятся в самой записи`);
  }
}, 'msg', form));

remove.addEventListener('click', guard(async () => {
  if (editing === null) return;
  const answer = await api('DELETE', `/api/admin/services/${editing}`);
  await reload();
  startCreate();
  showOk(answer.message);
}, 'msg', form));

// ── Загрузка ────────────────────────────────────────────────────────────────

startCreate();
await guard(reload)();
