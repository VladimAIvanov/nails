/* Профиль клиентки: данные, напоминания, календарь, любимые мастера,
   регулярные записи, согласия.

   Экран из прототипа (вкладка «Профиль» в кабинете и экран профиля
   мини-приложения). Ничего не хранит: все переключатели читаются и
   пишутся на сервере, состояние на экране — отражение ответа. */
import { api, guard, el, fill, studio, showOk, showError } from './api.js';
import { renderHeader } from './header.js';

const user = await renderHeader();
if (!user) location.href = '/login?next=/profile';

let settings = null;

// ── Данные ──────────────────────────────────────────────────────────────────

const meForm = document.getElementById('me-form');
meForm.full_name.value = user.full_name;
meForm.email.value = user.email ?? '';
document.getElementById('phone-note').textContent =
  `Телефон ${user.phone} — это ваш логин. Поменять его можно только через студию: `
  + 'по нему объединяются визиты, записанные без регистрации.';

meForm.addEventListener('submit', guard(async () => {
  const fullName = meForm.full_name.value.trim();
  const email = meForm.email.value.trim();

  if (fullName.length < 2) {
    showError({ status: 400, message: 'Поле «full_name»: минимум 2 символов' }, 'msg', meForm);
    return;
  }

  const updated = await api('PATCH', '/api/profile', {
    full_name: fullName,
    email: email || null
  });

  showOk('Данные сохранены');
  document.getElementById('title').textContent = 'Профиль';
  meForm.full_name.value = updated.full_name;
  meForm.email.value = updated.email ?? '';
}, 'msg', meForm));

// ── Напоминания ─────────────────────────────────────────────────────────────

/* Переключатели уведомлений и подписка на новые окна живут в разных местах
   сервиса: первые — в настройках уведомлений, вторая — отдельной строкой
   подписки. На экране это один список: человеку всё равно, где что лежит. */
const SWITCHES = [
  ['telegram', 'Напоминать в Telegram', 'Бот подтверждает окно и напоминает за два часа'],
  ['push', 'Пуш в приложении', 'Если приложение установлено'],
  ['email', 'Письма на почту', 'Нужен указанный адрес'],
  ['sms', 'СМС', 'Запасной канал, работает всегда'],
  ['marketing', 'Акции и новинки', 'Редкие письма о новых услугах']
];

function toggle(label, hint, checked, onChange) {
  const input = el('input', { type: 'checkbox', checked });
  input.addEventListener('change', guard(async () => {
    input.disabled = true;
    try {
      await onChange(input.checked);
    } catch (err) {
      input.checked = !input.checked;   // не получилось — возвращаем как было
      throw err;
    } finally {
      input.disabled = false;
    }
  }));

  return el('label', { className: 'switch' },
    input,
    el('span', {},
      el('span', { className: 'switch__title', textContent: label }),
      el('span', { className: 'switch__hint', textContent: hint }))
  );
}

async function loadPrefs() {
  const prefs = await api('GET', '/api/notifications/prefs');
  const subs = await api('GET', '/api/profile/slot-subscriptions');

  const rows = SWITCHES.map(([key, title, hint]) =>
    toggle(title, hint, prefs[key], async (value) => {
      const answer = await api('PATCH', '/api/notifications/prefs', { [key]: value });
      renderChannels(answer.active_channels);
      showOk(value ? `Включили: ${title.toLowerCase()}` : `Выключили: ${title.toLowerCase()}`);
    }));

  /* «Новые окна у Варвары» из прототипа: это подписка на освободившееся
     время у мастера, а не канал связи. Состояние — наличие активной строки. */
  const masters = (await api('GET', '/api/masters')).masters;
  const varvara = masters.find((m) => m.name === 'Варвара') ?? masters[0];
  const active = subs.subscriptions.find((s) => s.master_id === varvara?.id);

  if (varvara) {
    rows.push(toggle(
      `Новые окна у мастера ${varvara.name}`,
      'Сообщим, когда освободится время',
      Boolean(active),
      async (value) => {
        if (value) {
          await api('POST', '/api/profile/slot-subscriptions', { master_id: varvara.id });
          showOk('Подписались на новые окна');
        } else {
          const current = (await api('GET', '/api/profile/slot-subscriptions'))
            .subscriptions.find((s) => s.master_id === varvara.id);
          if (current) await api('DELETE', `/api/profile/slot-subscriptions/${current.id}`);
          showOk('Подписка отключена');
        }
      }
    ));
  }

  document.getElementById('prefs').replaceChildren(...rows);
  renderChannels(prefs.active_channels);
}

function renderChannels(channels) {
  const names = { telegram: 'Telegram', push: 'пуш', email: 'почта', sms: 'СМС' };
  document.getElementById('channels').textContent = channels?.length
    ? `Напоминания придут: ${channels.map((c) => names[c] ?? c).join(', ')}.`
    : 'Все каналы выключены — напоминание о визите не придёт.';
}

// ── Календарь ───────────────────────────────────────────────────────────────

async function loadCalendar(link = null) {
  const box = document.getElementById('calendar');

  if (link) {
    const off = el('button', { type: 'button', className: 'btn btn--ghost btn--sm', textContent: 'Отключить подписку' });
    off.addEventListener('click', guard(async () => {
      await api('DELETE', '/api/calendar/subscribe');
      showOk('Подписка отключена. Прежняя ссылка больше не работает.');
      await loadCalendar();
    }));

    box.replaceChildren(
      el('p', { className: 'profile__link', textContent: link }),
      el('div', { className: 'row' },
        el('a', { className: 'btn btn--secondary btn--sm', href: link, textContent: 'Открыть ленту' }),
        off)
    );
    return;
  }

  const on = el('button', { type: 'button', className: 'btn btn--sm', textContent: 'Получить ссылку' });
  on.addEventListener('click', guard(async () => {
    const answer = await api('POST', '/api/calendar/subscribe');
    showOk(answer.hint);
    await loadCalendar(answer.url);
  }));

  box.replaceChildren(on);
}

// ── Любимые мастера ─────────────────────────────────────────────────────────

async function loadFavorites() {
  const [{ masters: favorites }, { masters: all }] = await Promise.all([
    api('GET', '/api/profile/favorites'),
    api('GET', '/api/masters')
  ]);

  const chosen = new Set(favorites.map((m) => m.id));

  document.getElementById('favorites').replaceChildren(
    ...all.map((m) => {
      const on = chosen.has(m.id);
      const btn = el('button', {
        type: 'button',
        className: `btn btn--sm ${on ? 'btn--secondary' : 'btn--ghost'}`,
        textContent: on ? 'В избранном' : 'В избранное'
      });

      btn.addEventListener('click', guard(async () => {
        if (on) {
          await api('DELETE', `/api/profile/favorites/${m.id}`);
          showOk(`${m.name} убрана из избранного`);
        } else {
          await api('POST', `/api/profile/favorites/${m.id}`);
          showOk(`${m.name} в избранном`);
        }
        await loadFavorites();
      }));

      return el('div', { className: 'profile__row' },
        el('div', { className: 'row' },
          el('span', { className: 'avatar', textContent: (m.name ?? '·')[0] }),
          el('div', {},
            el('div', { className: 'sum__value', textContent: m.name }),
            el('div', { className: 'muted', textContent: m.specialization.join(', ') || 'Мастер студии' }))),
        btn);
    })
  );
}

// ── Регулярные записи ───────────────────────────────────────────────────────

async function loadRecurring() {
  const { series } = await api('GET', '/api/recurring');
  const box = document.getElementById('recurring');

  if (series.length === 0) {
    box.replaceChildren(
      el('p', { className: 'muted' }, 'Регулярных записей нет. Их заводят, когда визиты идут по расписанию — например, раз в три недели.')
    );
    return;
  }

  box.replaceChildren(...series.map((s) => {
    const stop = el('button', { type: 'button', className: 'btn btn--ghost btn--sm', textContent: 'Остановить' });
    stop.addEventListener('click', guard(async () => {
      await api('DELETE', `/api/recurring/${s.id}`);
      showOk('Серия остановлена. Созданные визиты остаются.');
      await loadRecurring();
    }));

    return el('div', { className: 'profile__row' },
      el('div', {},
        el('div', { className: 'sum__value', textContent: s.service_title ?? `Серия №${s.id}` }),
        el('div', { className: 'muted', textContent: `${s.master_name ?? ''} · каждые ${s.interval_days ?? '—'} дн.` })),
      stop);
  }));
}

// ── Студия ──────────────────────────────────────────────────────────────────

function renderStudio() {
  const hours = settings.working_hours ?? [];
  const sample = hours[0];

  fill(document.getElementById('studio'),
    el('div', { className: 'sum__value', textContent: `${settings.city}, ${settings.address_line}` }),
    settings.address_note ? el('p', { className: 'muted', textContent: settings.address_note }) : null,
    sample ? el('p', { className: 'muted', textContent: `Работаем ${sample.starts_at_local}–${sample.ends_at_local}` }) : null,
    el('div', { className: 'row' },
      settings.phone
        ? el('a', { className: 'btn btn--secondary btn--sm', href: `tel:${settings.phone.replace(/[^+\d]/g, '')}`, textContent: 'Позвонить' })
        : null,
      settings.telegram_bot
        ? el('a', { className: 'btn btn--ghost btn--sm', href: `https://t.me/${settings.telegram_bot.replace('@', '')}`, textContent: settings.telegram_bot })
        : null)
  );
}

// ── Согласия ────────────────────────────────────────────────────────────────

const CONSENTS = { personal_data: 'Обработка персональных данных', marketing: 'Рассылки об акциях' };

async function loadConsents() {
  const { consents } = await api('GET', '/api/profile/consents');

  /* Сервер хранит историю согласий; на экране показываем последнее
     состояние каждого вида. */
  const latest = new Map();
  for (const c of consents) if (!latest.has(c.kind)) latest.set(c.kind, c);

  fill(document.getElementById('consents'),
    ...[...latest.values()].map((c) => el('div', { className: 'profile__row' },
      el('div', {},
        el('div', { className: 'sum__value', textContent: CONSENTS[c.kind] ?? c.kind }),
        el('div', { className: 'muted', textContent: `${c.is_granted ? 'дано' : 'отозвано'} · ${c.changed_at.slice(0, 10)} · ${c.document_version}` })),
      c.kind === 'personal_data'
        ? el('span', { className: 'caption', textContent: 'отзывается через студию' })
        : null)),
    latest.size === 0 ? el('p', { className: 'muted' }, 'Согласий пока нет') : null
  );
}

// ── Загрузка ────────────────────────────────────────────────────────────────

await guard(async () => {
  settings = await studio();
  renderStudio();
})();

await guard(loadPrefs)();
await guard(() => loadCalendar())();
await guard(loadFavorites)();
await guard(loadRecurring)();
await guard(loadConsents)();
