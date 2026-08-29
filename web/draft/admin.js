import {
  api, guard, renderNav, requireUser, el, table, fillSelect, money, studio,
  showOk, showError, today
} from './app.js';

const user = await requireUser();
renderNav();
if (user) {

  let settings = null;
  let masters = [];
  let catalog = { categories: [], services: [] };
  let admin = false;
  let canMaster = false;

  /* Какие разделы показывать, решает не поле роли в ответе, а сам сервер.

     В ответе приходит одна — основная — роль, а прав у человека может быть
     больше: владелица студии одновременно администратор и мастер. Профиль
     мастера в базе бывает только у пользователя с основной ролью «master»,
     поэтому администратор мастером быть не может, а вот мастер вполне может
     оказаться администратором — это и проверяется запросом. */
  async function allowed(path) {
    try {
      await api('GET', path);
      return true;
    } catch (err) {
      if (err.status === 403) return false;
      throw err;
    }
  }

  /* Первая загрузка идёт через ту же обёртку, что и нажатия: отказ сервера
     при открытии страницы должен быть виден на экране, а не только в консоли. */
  async function init() {
    settings = await studio();

    canMaster = user.role === 'master';
    admin = user.role === 'admin'
      || (canMaster && await allowed('/api/admin/appointments?limit=1'));

    document.getElementById('role-note').textContent = admin
      ? (canMaster
        ? 'Вы вошли владелицей: доступны и панель студии, и своё расписание.'
        : 'Вы вошли администратором: видны все записи, услуги и мастера.')
      : `Вы вошли как «${user.role}». Административные разделы закрыты — доступно своё расписание.`;

    for (const id of ['appointments-section', 'create-section', 'services-section', 'masters-section']) {
      document.getElementById(id).hidden = !admin;
    }
    document.getElementById('schedule-section').hidden = !canMaster;

    masters = (await api('GET', '/api/masters')).masters;
    catalog = await api('GET', '/api/services');
    document.getElementById('schedule-date').value = today(settings.timezone);
  }

  await guard(init)();

  // ── Моё расписание ────────────────────────────────────────────────────────

  async function loadSchedule() {
    const date = document.getElementById('schedule-date').value;
    const data = await api('GET', `/api/master/appointments?date=${date}`);
    const box = document.getElementById('schedule');

    if (!data.appointments.length) {
      box.replaceChildren(el('p', { className: 'muted' }, 'На этот день записей нет'));
      return;
    }

    const rows = data.appointments.map((a) => {
      const cell = el('td', { className: 'actions' });
      if (a.status === 'pending') {
        const confirm = el('button', { type: 'button', textContent: 'подтвердить' });
        confirm.addEventListener('click', guard(async () => {
          await api('POST', `/api/master/appointments/${a.id}/confirm`);
          showOk(`Запись ${a.id} подтверждена`);
          await loadSchedule();
        }));
        cell.append(confirm);
      }
      return el('tr', {},
        el('td', {}, a.local.time),
        el('td', {}, a.service.title),
        el('td', {}, `${a.client.name} · ${a.client.phone}`),
        el('td', {}, money(a.price_kopecks)),
        el('td', {}, a.status_title),
        cell
      );
    });

    box.replaceChildren(table(['Время', 'Услуга', 'Клиентка', 'Цена', 'Статус', ''], rows));
  }

  document.getElementById('schedule-load').addEventListener('click', guard(loadSchedule));
  if (canMaster) await guard(loadSchedule)();

  /* Дальше — административные разделы. Разметка на странице есть у всех,
     но запросы к ним делаются только администратору: мастеру эти адреса
     ответят 403, и страница пестрела бы ошибками впустую. */

  // ── Все записи ────────────────────────────────────────────────────────────

  fillSelect(document.getElementById('f-master'), masters,
    { value: (m) => m.id, label: (m) => m.name, empty: 'любой' });

  async function loadAppointments() {
    const qs = new URLSearchParams();
    const status = document.getElementById('f-status').value;
    const date = document.getElementById('f-date').value;
    const master = document.getElementById('f-master').value;
    const search = document.getElementById('f-search').value.trim();
    if (status) qs.set('status', status);
    if (date) qs.set('date', date);
    if (master) qs.set('master_id', master);
    if (search) qs.set('search', search);

    const data = await api('GET', `/api/admin/appointments?${qs}`);

    document.getElementById('summary').textContent =
      `Всего: ${data.summary.total} · ждут подтверждения: ${data.summary.pending} · `
      + `ожидаемая выручка: ${money(data.summary.expected_revenue_kopecks)}`;

    const rows = data.appointments.map((a) => {
      const cell = el('td', { className: 'actions' });

      if (a.status === 'pending') {
        const confirm = el('button', { type: 'button', textContent: 'подтвердить' });
        confirm.addEventListener('click', guard(async () => {
          await api('POST', `/api/admin/appointments/${a.id}/confirm`);
          showOk(`Запись ${a.id} подтверждена`);
          await loadAppointments();
        }));
        cell.append(confirm);
      }

      if (['pending', 'confirmed'].includes(a.status)) {
        const cancel = el('button', { type: 'button', textContent: 'отменить' });
        cancel.addEventListener('click', guard(async () => {
          const result = await api('POST', `/api/appointments/${a.id}/cancel`, { reason: 'отмена из панели' });
          showOk(`Запись ${a.id} отменена${result.late_cancellation ? ' (поздняя отмена)' : ''}`);
          await loadAppointments();
        }));
        cell.append(cancel);
      }

      return el('tr', {},
        el('td', {}, a.id),
        el('td', {}, `${a.local.date} ${a.local.time}`),
        el('td', {}, a.service),
        el('td', {}, a.master.name),
        el('td', {}, `${a.client.name}\n${a.client.phone}`),
        el('td', {}, money(a.price_kopecks)),
        el('td', {}, el('span', { className: 'status' }, a.status_title)),
        cell
      );
    });

    document.getElementById('appointments').replaceChildren(
      rows.length
        ? table(['id', 'Когда', 'Услуга', 'Мастер', 'Клиентка', 'Цена', 'Статус', ''], rows)
        : el('p', { className: 'muted' }, 'Под фильтр ничего не подходит')
    );
  }

  document.getElementById('f-apply').addEventListener('click', guard(loadAppointments));
  document.getElementById('f-reset').addEventListener('click', guard(async () => {
    for (const id of ['f-status', 'f-date', 'f-master', 'f-search']) document.getElementById(id).value = '';
    await loadAppointments();
  }));

  // ── Оформление записи ─────────────────────────────────────────────────────

  async function initCreateForm() {
    const clients = (await api('GET', '/api/admin/clients?limit=100')).clients;
    fillSelect(document.getElementById('c-client'), clients,
      { value: (c) => c.id, label: (c) => `${c.full_name} · ${c.phone}` });
    fillSelect(document.getElementById('c-master'), masters,
      { value: (m) => m.id, label: (m) => m.name });
    await loadCreateServices();
  }

  async function loadCreateServices() {
    const box = document.getElementById('c-services');
    box.replaceChildren('Загрузка…');
    const master = await api('GET', `/api/masters/${document.getElementById('c-master').value}`);
    box.replaceChildren(...(master.services.length
      ? master.services.map((s) => el('label', {},
        el('input', { type: 'checkbox', className: 'c-service', value: String(s.id) }),
        ` ${s.title} — ${s.duration_min} мин`))
      : [el('span', { className: 'muted' }, 'У мастера нет услуг')]));
  }

  document.getElementById('c-master').addEventListener('change', guard(loadCreateServices));

  document.getElementById('c-create').addEventListener('click', async (event) => {
    event.preventDefault();
    const status = document.getElementById('c-status').value;
    try {
      const data = await api('POST', '/api/admin/appointments', {
        client_id: Number(document.getElementById('c-client').value),
        master_id: Number(document.getElementById('c-master').value),
        service_ids: [...document.querySelectorAll('.c-service:checked')].map((i) => Number(i.value)),
        starts_at: document.getElementById('c-starts').value.trim(),
        allow_overlap: document.getElementById('c-overlap').checked,
        status: status || undefined
      });
      showOk(`Оформлено. Записей: ${data.appointment_ids.length}, статус «${data.status}»`
        + `${data.allow_overlap ? ', поверх занятого времени' : ''}. Время: ${data.local.date} ${data.local.time}.`);
      await loadAppointments();
    } catch (err) {
      showError(err, 'msg', { onSlot: (slot) => { document.getElementById('c-starts').value = slot.starts_at; } });

      /* Сервер отвечает administrator-у подсказкой на языке API. Переводим
         её в действие на этой странице, чтобы не искать поле руками. */
      if (err.status === 409 && /allow_overlap/.test(err.message)) {
        document.getElementById('msg').append(el('p', { className: 'hint' },
          'Чтобы записать поверх занятого времени, отметьте галочку ниже и повторите.'));
      }
    }
  });

  // ── Услуги ────────────────────────────────────────────────────────────────

  fillSelect(document.getElementById('s-category'), catalog.categories,
    { value: (c) => c.id, label: (c) => c.title });

  async function loadServices() {
    const data = await api('GET', '/api/admin/services');

    const rows = data.services.map((s) => {
      const title = el('input', { value: s.title, className: 'w-190' });
      const duration = el('input', { type: 'number', step: '5', value: String(s.duration_min), className: 'w-80' });
      const price = el('input', { type: 'number', value: String(s.price_kopecks / 100), className: 'w-100' });
      const active = el('input', { type: 'checkbox', checked: s.is_active === 1 });
      const online = el('input', { type: 'checkbox', checked: s.is_online_bookable === 1 });

      const save = el('button', { type: 'button', textContent: 'сохранить' });
      save.addEventListener('click', guard(async () => {
        await api('PATCH', `/api/admin/services/${s.id}`, {
          title: title.value.trim(),
          duration_min: Number(duration.value),
          price_kopecks: Math.round(Number(price.value) * 100),
          is_active: active.checked,
          is_online_bookable: online.checked
        });
        showOk(`Услуга ${s.id} сохранена`);
        await loadServices();
      }));

      const remove = el('button', { type: 'button', textContent: 'удалить' });
      remove.addEventListener('click', guard(async () => {
        await api('DELETE', `/api/admin/services/${s.id}`);
        showOk(`Услуга ${s.id} удалена`);
        await loadServices();
      }));

      return el('tr', {},
        el('td', {}, s.id),
        el('td', {}, title),
        el('td', {}, s.category_title),
        el('td', {}, duration),
        el('td', {}, price),
        el('td', {}, active),
        el('td', {}, online),
        el('td', { className: 'actions' }, save, remove)
      );
    });

    document.getElementById('services').replaceChildren(
      table(['id', 'Название', 'Категория', 'Минут', 'Цена, ₽', 'Активна', 'Онлайн', ''], rows));
  }

  document.getElementById('s-create').addEventListener('click', guard(async () => {
    await api('POST', '/api/admin/services', {
      title: document.getElementById('s-title').value.trim(),
      slug: document.getElementById('s-slug').value.trim(),
      category_id: Number(document.getElementById('s-category').value),
      duration_min: Number(document.getElementById('s-duration').value),
      price_kopecks: Math.round(Number(document.getElementById('s-price').value) * 100)
    });
    showOk('Услуга добавлена');
    await loadServices();
  }));

  // ── Мастера ───────────────────────────────────────────────────────────────

  async function loadMasters() {
    const data = await api('GET', '/api/admin/masters');
    const services = (await api('GET', '/api/admin/services')).services;

    const rows = data.masters.map((m) => {
      const active = el('input', { type: 'checkbox', checked: m.is_active === 1 });
      const online = el('input', { type: 'checkbox', checked: m.accepts_online_booking === 1 });

      const list = el('select', { multiple: true, size: 4, className: 'w-220' });
      for (const s of services) {
        list.append(el('option', { value: String(s.id), textContent: `${s.title}` }));
      }

      const save = el('button', { type: 'button', textContent: 'сохранить' });
      save.addEventListener('click', guard(async () => {
        const picked = [...list.selectedOptions].map((o) => Number(o.value));
        await api('PATCH', `/api/admin/masters/${m.id}`, {
          is_active: active.checked,
          accepts_online_booking: online.checked,
          ...(picked.length ? { service_ids: picked } : {})
        });
        showOk(`Мастер ${m.id} сохранён${picked.length ? `, услуг назначено: ${picked.length}` : ''}`);
        await loadMasters();
      }));

      const remove = el('button', { type: 'button', textContent: 'удалить' });
      remove.addEventListener('click', guard(async () => {
        await api('DELETE', `/api/admin/masters/${m.id}`);
        showOk(`Мастер ${m.id} удалён`);
        await loadMasters();
      }));

      return el('tr', {},
        el('td', {}, m.id),
        el('td', {}, m.full_name),
        el('td', {}, m.email ?? '—'),
        el('td', {}, String(m.services_count)),
        el('td', {}, active),
        el('td', {}, online),
        el('td', {}, list, el('div', { className: 'hint' }, 'выбор заменит список услуг')),
        el('td', { className: 'actions' }, save, remove)
      );
    });

    document.getElementById('masters').replaceChildren(
      table(['id', 'Имя', 'Почта', 'Услуг', 'Активен', 'Онлайн-запись', 'Назначить услуги', ''], rows));
  }

  document.getElementById('m-create').addEventListener('click', guard(async () => {
    await api('POST', '/api/admin/masters', {
      full_name: document.getElementById('m-name').value.trim(),
      email: document.getElementById('m-email').value.trim(),
      phone: document.getElementById('m-phone').value.trim(),
      password: document.getElementById('m-password').value
    });
    showOk('Мастер добавлен');
    document.getElementById('m-password').value = '';
    await loadMasters();
  }));

  if (admin) {
    await guard(loadAppointments)();
    await guard(initCreateForm)();
    await guard(loadServices)();
    await guard(loadMasters)();
  }
}


