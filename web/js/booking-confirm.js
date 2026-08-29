/* Шаг 4: подтверждение.

   При открытии экрана окно удерживается через API: пока удержание живо,
   другим клиенткам это время свободным не показывается. Таймер показывает,
   сколько осталось, — это не украшение, а честное «мы держим за вами».

   Если сервер ответил, что время только что заняли (409), экран переходит
   в состояние отказа: сообщение сервера как есть плюс кнопки ближайших
   свободных окон, которые он же и прислал. Это состояние той же страницы. */
import { api, guard, el, money, duration, studio, whenLocal, showError, clearMsg } from './api.js';
import { renderHeader } from './header.js';
import { renderSteps } from './steps.js';
import { read, write, reset } from './store.js';

const user = await renderHeader();
renderSteps('confirm');

const state = read();
if (state.serviceIds.length === 0) location.href = '/booking';
if (!state.startsAt) location.href = '/booking-time';

let settings = null;
let services = [];
let master = null;
let hold = null;
let ticker = null;

const submit = document.getElementById('submit');

// ── Сводка справа ───────────────────────────────────────────────────────────

function renderSummary() {
  const total = services.reduce((sum, s) => sum + s.price_kopecks, 0);
  const approx = services.some((s) => s.price_is_from);

  /* Список мастеров отдаёт имя полем name, карточка одного мастера —
     полем full_name. Берём то, что пришло. */
  document.getElementById('summary').replaceChildren(
    row('Мастер', master.full_name ?? master.name, '/booking-master'),
    row('Когда', whenLocal(state.startsAt, settings.timezone), '/booking-time'),
    el('div', { className: 'sum__line' },
      el('span', { className: 'muted', textContent: 'Услуги' }),
      el('a', { className: 'sum__edit', href: '/booking', textContent: 'Изменить' })),
    ...services.map((s) => el('div', { className: 'sum__service' },
      el('span', {}, s.title),
      el('span', { className: 'muted', textContent: duration(s.duration_min) }),
      el('span', { className: 'price', textContent: `${s.price_is_from ? 'от ' : ''}${money(s.price_kopecks)}` }))),
    el('div', { className: 'sum__total' },
      el('span', {}, 'Итого'),
      el('span', { className: 'price', textContent: `${approx ? 'от ' : ''}${money(total)}` })),
    el('p', { className: 'caption', textContent: `${settings.address_line}${settings.address_note ? `, ${settings.address_note}` : ''}` })
  );
}

function row(label, value, href) {
  return el('div', { className: 'sum__row' },
    el('div', {},
      el('div', { className: 'muted', textContent: label }),
      el('div', { className: 'sum__value', textContent: value })),
    href ? el('a', { className: 'sum__edit', href, textContent: 'Изменить' }) : null);
}

// ── Удержание и таймер ──────────────────────────────────────────────────────

async function holdSlot() {
  const box = document.getElementById('hold');
  box.replaceChildren(el('span', { className: 'muted' }, 'Держим окно за вами…'));

  /* Своё прежнее удержание отпускаем: иначе при возврате на этот экран
     сервер честно ответит, что время удерживается — нами же. */
  const previous = read().holdToken;
  if (previous) {
    await api('DELETE', `/api/holds/${previous}`).catch(() => null);
    write({ holdToken: null, holdExpiresAt: null });
  }

  try {
    hold = await api('POST', '/api/holds', {
      master_id: master.id,
      service_ids: state.serviceIds,
      starts_at: state.startsAt
    });
    write({ holdToken: hold.hold_token, holdExpiresAt: hold.expires_at });
    startTicker(Date.parse(hold.expires_at));
  } catch (err) {
    /* Не удержали — обычно потому, что окно уже заняли. Показываем отказ
       сервера и предлагаем другое время. */
    box.replaceChildren();
    await onConflict(err);
  }
}

function startTicker(deadline) {
  clearInterval(ticker);
  const box = document.getElementById('hold');

  const paint = () => {
    const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
    const mm = String(Math.floor(left / 60)).padStart(2, '0');
    const ss = String(left % 60).padStart(2, '0');

    if (left === 0) {
      clearInterval(ticker);
      box.className = 'hold hold--over';
      box.replaceChildren(
        el('span', {}, 'Время удержания вышло. Окно снова доступно другим — подтвердите скорее или выберите другое.'),
        el('a', { className: 'btn btn--secondary btn--sm', href: '/booking-time', textContent: 'Выбрать другое время' })
      );
      return;
    }

    box.className = `hold${left < 60 ? ' hold--soon' : ''}`;
    box.replaceChildren(
      el('span', { className: 'hold__label', textContent: 'Окно держим за вами' }),
      el('span', { className: 'hold__time', textContent: `${mm}:${ss}` })
    );
  };

  paint();
  ticker = setInterval(paint, 1000);
}

/* Уходя со страницы, отпускаем окно: незаконченное оформление не должно
   держать время до истечения срока. */
window.addEventListener('pagehide', () => {
  const token = read().holdToken;
  if (!token) return;

  /* keepalive, а не sendBeacon: маячок умеет только POST, а удержание
     снимается методом DELETE. Запрос переживает уход со страницы. */
  fetch(`/api/holds/${token}`, { method: 'DELETE', credentials: 'same-origin', keepalive: true })
    .catch(() => null);
  write({ holdToken: null, holdExpiresAt: null });
});

// ── Отказ «время уже заняли» ────────────────────────────────────────────────

async function onConflict(err) {
  showError(err);

  /* При отказе в записи сервер сам присылает ближайшие окна. При отказе
     в удержании — нет, поэтому спрашиваем их обычным запросом к тому же
     серверу: свои варианты не придумываем ни в одном из случаев. */
  const available = Array.isArray(err.details?.available)
    ? err.details.available
    : await nearestSlots();

  if (available.length === 0) return;

  const box = document.getElementById('msg');
  box.append(
    el('p', { className: 'muted conflict__label' }, 'Ближайшее свободное время:'),
    el('div', { className: 'slots__grid conflict__slots' }, ...available.map((slot) => {
      const btn = el('button', {
        type: 'button',
        className: 'slot slot--wide',
        textContent: `${slot.date} · ${slot.local_time}`
      });
      btn.addEventListener('click', guard(async () => {
        write({ startsAt: slot.starts_at, date: slot.date, holdToken: null, holdExpiresAt: null });
        location.reload();
      }));
      return btn;
    })),
    el('p', { className: 'muted' },
      el('a', { href: '/booking-time', textContent: 'Выбрать другое время в календаре' }))
  );
}

/* Ближайшие свободные окна того же мастера: спрашиваем по дням вперёд,
   начиная с выбранного. Расчёт — на сервере, здесь только показ. */
async function nearestSlots(limit = 5) {
  const found = [];
  const cursor = new Date(state.startsAt);

  for (let i = 0; i < 7 && found.length < limit; i++) {
    const date = new Date(cursor.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    const qs = new URLSearchParams({ date });
    for (const id of state.serviceIds) qs.append('service_id', String(id));

    const answer = await api('GET', `/api/masters/${master.id}/slots?${qs}`).catch(() => null);
    for (const slot of answer?.slots ?? []) {
      if (slot.starts_at <= state.startsAt && i === 0) continue;
      found.push({ date, starts_at: slot.starts_at, local_time: slot.local_time });
      if (found.length >= limit) break;
    }
  }
  return found;
}

// ── Подтверждение ───────────────────────────────────────────────────────────

submit.addEventListener('click', async () => {
  clearMsg();
  submit.disabled = true;

  try {
    const data = await api('POST', '/api/appointments', {
      master_id: master.id,
      service_ids: state.serviceIds,
      starts_at: state.startsAt,
      comment: document.getElementById('comment').value.trim() || undefined,
      hold_token: read().holdToken ?? undefined
    });

    clearInterval(ticker);
    /* Несколько услуг сервер сохраняет несколькими записями подряд —
       передаём все номера, чтобы экран успеха показал визит целиком. */
    const ids = data.appointments.map((a) => a.id).join(',');
    reset();
    location.href = `/booking-done?id=${ids}`;
  } catch (err) {
    submit.disabled = false;
    if (err.status === 409) await onConflict(err);
    else showError(err);
  }
});

// ── Загрузка ────────────────────────────────────────────────────────────────

await guard(async () => {
  settings = await studio();

  if (!user) {
    document.getElementById('who').replaceChildren(
      el('div', { className: 'note note--info' }, 'Чтобы завершить запись, нужно войти — так визит попадёт в ваш кабинет.'),
      el('a', { className: 'btn', href: '/login?next=/booking-confirm', textContent: 'Войти' }),
      el('a', { className: 'btn btn--secondary', href: '/register', textContent: 'Зарегистрироваться' })
    );
    submit.disabled = true;
  } else {
    document.getElementById('who').replaceChildren(
      el('div', {}, el('div', { className: 'muted', textContent: 'Имя' }), el('div', { className: 'sum__value', textContent: user.full_name })),
      el('div', {}, el('div', { className: 'muted', textContent: 'Телефон' }), el('div', { className: 'sum__value', textContent: user.phone })),
      el('p', { className: 'caption' }, 'Данные берутся из вашего профиля — поменять их можно в кабинете.')
    );
  }

  const [catalog, one] = await Promise.all([
    api('GET', '/api/services'),
    api('GET', `/api/masters/${state.masterId}`)
  ]);
  master = one;
  services = catalog.services.filter((s) => state.serviceIds.includes(s.id));

  document.getElementById('rules').textContent =
    `Отмена бесплатна не позднее чем за ${Math.round(settings.free_cancellation_lead_min / 60)} ч до визита. `
    + 'Напоминание придёт заранее.';

  renderSummary();
  if (user) await holdSlot();
})();

