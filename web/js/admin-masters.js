/* Мастера: список, добавление, правка, включение и отключение, а главное —
   отметки, какие услуги мастер выполняет.

   Эти отметки живут не только здесь. На них опирается клиентский выбор:
   `GET /api/masters?service_id=…` отдаёт только тех, у кого услуга отмечена.
   Снять отметку значит убрать мастера из выбора при записи на эту услугу.

   Роль в форме не выбирается. `POST /api/admin/masters` всегда заводит
   мастера, и другого значения не принимает: администратором человека делают
   только в базе. */
import { api, guard, el, showOk, clearMsg } from './api.js';
import './admin.js';

const list = document.getElementById('list');
const form = document.getElementById('form');
const formTitle = document.getElementById('form-title');
const submit = document.getElementById('submit');
const cancel = document.getElementById('cancel');
const remove = document.getElementById('remove');
const picks = document.getElementById('picks');
const passwordField = document.getElementById('password-field');

let masters = [];
let services = [];
let editing = null;

/* Русское согласование: «1 услуга», «2 услуги», «5 услуг». */
function plural(n, one, few, many) {
  const last = n % 10;
  const two = n % 100;
  if (last === 1 && two !== 11) return `${n} ${one}`;
  if (last >= 2 && last <= 4 && (two < 12 || two > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

// ── Список ──────────────────────────────────────────────────────────────────

function card(m) {
  const own = services.filter((s) => m.service_ids.includes(s.id));

  const tags = [];
  if (m.is_active !== 1) tags.push(el('span', { className: 'tag tag--off', textContent: 'Отключён' }));
  if (m.accepts_online_booking !== 1) tags.push(el('span', { className: 'tag tag--warn', textContent: 'Без онлайн-записи' }));
  /* Мастер без услуг не попадёт ни в один выбор: клиент сначала называет
     услугу, и только потом видит исполнителей. */
  if (own.length === 0) tags.push(el('span', { className: 'tag tag--warn', textContent: 'Нет услуг' }));
  if (!m.uses_studio_hours) tags.push(el('span', { className: 'tag', textContent: 'Свой график' }));

  const toggle = el('input', { type: 'checkbox', checked: m.is_active === 1 });
  toggle.addEventListener('change', guard(async () => {
    toggle.disabled = true;
    await api('PATCH', `/api/admin/masters/${m.id}`, { is_active: toggle.checked });
    showOk(toggle.checked
      ? `${m.full_name} снова в работе — мастера предлагают при записи`
      : `${m.full_name} отключён — при записи его больше не предложат, уже назначенные визиты остались`);
    await reload();
  }));

  const edit = el('button', { type: 'button', className: 'btn btn--secondary btn--sm', textContent: 'Править' });
  edit.addEventListener('click', () => startEdit(m));

  return el('div', { className: `rec${m.is_active === 1 ? '' : ' rec--off'}${editing === m.id ? ' rec--editing' : ''}` },
    el('div', { className: 'rec__main' },
      el('div', { className: 'rec__title', textContent: m.full_name }),
      el('div', { className: 'rec__sub', textContent: [m.email, m.phone].filter(Boolean).join(' · ') }),
      el('div', { className: 'rec__sub' },
        own.length
          ? `${plural(own.length, 'услуга', 'услуги', 'услуг')}: ${own.map((s) => s.title).join(', ')}`
          : 'услуги не отмечены'),
      tags.length ? el('div', { className: 'tags' }, ...tags) : null),
    el('div', { className: 'rec__side' },
      el('label', { className: 'switch', title: 'В работе' },
        toggle, el('span', { className: 'switch__track' })),
      edit));
}

function renderPicks(chosen) {
  picks.replaceChildren(...services.map((s) => {
    const box = el('input', { type: 'checkbox', value: String(s.id) });
    box.checked = chosen.includes(s.id);
    return el('label', { className: 'checkbox' }, box,
      el('span', {}, s.title, s.is_active === 1 ? null : ' (услуга отключена)'));
  }));
}

const chosenServices = () =>
  [...picks.querySelectorAll('input:checked')].map((i) => Number(i.value));

function render() {
  list.replaceChildren(...masters.map(card));
  document.getElementById('count').textContent =
    `${masters.length} в студии, из них в работе ${masters.filter((m) => m.is_active === 1).length}`;
}

async function reload() {
  const [staff, catalog] = await Promise.all([
    api('GET', '/api/admin/masters'),
    api('GET', '/api/admin/services')
  ]);

  masters = staff.masters;
  services = catalog.services;

  /* Отметки перерисовываем, сохраняя уже расставленные: иначе после
     сохранения услуги в открытой форме сбросились бы. */
  renderPicks(editing === null ? chosenServices() : masters.find((m) => m.id === editing)?.service_ids ?? []);
  render();
}

// ── Форма ───────────────────────────────────────────────────────────────────

function startCreate() {
  editing = null;
  form.reset();
  renderPicks([]);
  formTitle.textContent = 'Новый мастер';
  submit.textContent = 'Добавить мастера';
  /* Пароль нужен только новому: у существующего он свой, и переписывать его
     из чужой формы нельзя. Меняет пароль сам мастер на /password-change. */
  passwordField.hidden = false;
  form.elements.password.required = true;
  form.elements.email.disabled = false;
  form.elements.phone.disabled = false;
  form.elements.accepts_online_booking.checked = true;
  form.elements.uses_studio_hours.checked = true;
  remove.hidden = true;
  cancel.hidden = true;
  render();
}

function startEdit(m) {
  editing = m.id;
  form.elements.full_name.value = m.full_name;
  form.elements.email.value = m.email ?? '';
  form.elements.phone.value = m.phone ?? '';
  form.elements.sort_order.value = String(m.sort_order ?? 100);
  form.elements.accepts_online_booking.checked = m.accepts_online_booking === 1;
  form.elements.uses_studio_hours.checked = m.uses_studio_hours === 1;
  renderPicks(m.service_ids);

  formTitle.textContent = `Правка: ${m.full_name}`;
  submit.textContent = 'Сохранить';
  passwordField.hidden = true;
  form.elements.password.required = false;
  form.elements.password.value = '';
  /* Почта и телефон — это логин. Правка логина через административную форму
     увела бы человека из его же учётной записи, поэтому адрес для смены
     таких данных в API и не заведён. */
  form.elements.email.disabled = true;
  form.elements.phone.disabled = true;
  remove.hidden = false;
  cancel.hidden = false;
  render();
  form.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

cancel.addEventListener('click', () => { clearMsg(); startCreate(); });

form.addEventListener('submit', guard(async () => {
  const chosen = chosenServices();

  if (editing === null) {
    const created = await api('POST', '/api/admin/masters', {
      full_name: form.elements.full_name.value.trim(),
      email: form.elements.email.value.trim(),
      phone: form.elements.phone.value.trim(),
      password: form.elements.password.value,
      sort_order: form.elements.sort_order.value === '' ? undefined : Number(form.elements.sort_order.value),
      service_ids: chosen
    });
    await reload();
    startCreate();
    showOk(chosen.length
      ? `${created.full_name} добавлен. Клиенты увидят его при выборе отмеченных услуг`
      : `${created.full_name} добавлен. Услуги пока не отмечены — при записи его не предложат`);
  } else {
    const saved = await api('PATCH', `/api/admin/masters/${editing}`, {
      full_name: form.elements.full_name.value.trim(),
      sort_order: form.elements.sort_order.value === '' ? undefined : Number(form.elements.sort_order.value),
      accepts_online_booking: form.elements.accepts_online_booking.checked,
      uses_studio_hours: form.elements.uses_studio_hours.checked,
      service_ids: chosen
    });
    await reload();
    startCreate();
    showOk(`${saved.full_name}: сохранено. Клиентский выбор мастера пересобирается сразу — отмеченные услуги и есть тот список, по которому его находят`);
  }
}, 'msg', form));

remove.addEventListener('click', guard(async () => {
  if (editing === null) return;
  const answer = await api('DELETE', `/api/admin/masters/${editing}`);
  await reload();
  startCreate();
  showOk(answer.message);
}, 'msg', form));

// ── Загрузка ────────────────────────────────────────────────────────────────

startCreate();
await guard(reload)();
