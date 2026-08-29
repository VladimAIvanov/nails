/* Общий код страниц: сеанс, обращения к API, вывод ошибок, мелкое
   форматирование. Никаких библиотек — то же правило, что и на бэкенде. */

const TOKEN_KEY = 'varvara.token';
const USER_KEY = 'varvara.user';

// ── Сеанс ───────────────────────────────────────────────────────────────────

export const token = () => localStorage.getItem(TOKEN_KEY);

export function currentUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null'); } catch { return null; }
}

export function saveSession(data) {
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ── Обращения к API ─────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(status, payload) {
    super(payload?.message ?? `Ошибка ${status}`);
    this.status = status;
    this.code = payload?.error ?? 'unknown';
    this.details = payload?.details ?? null;
  }
}

export async function api(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(token() ? { authorization: `Bearer ${token()}` } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (err) {
    throw new ApiError(0, { message: `Сервер недоступен: ${err.message}` });
  }

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }

  /* Токен протух или отозван — уводим на вход, а не показываем пустую
     страницу с непонятной ошибкой.

     Вход и регистрация из этого правила исключены. Там 401 означает
     «неверный пароль», а не «сеанс кончился»: без исключения неудачная
     попытка входа стирала пропуск тому, кто уже вошёл, и подменяла причину
     отказа. Ответ сервера нужно показывать как есть — он и так точный. */
  const isAuthAttempt = path.startsWith('/api/auth/login') || path.startsWith('/api/auth/register');
  if (res.status === 401 && token() && !isAuthAttempt) {
    clearSession();
    throw new ApiError(401, { error: 'unauthorized', message: 'Сеанс закончился, войдите заново' });
  }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

// ── Сообщения на странице ───────────────────────────────────────────────────

const box = (id) => document.getElementById(id) ?? document.getElementById('msg');

export function clearMsg(id = 'msg') {
  const el = box(id);
  if (el) el.innerHTML = '';
}

export function showOk(text, id = 'msg') {
  const el = box(id);
  el.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'msg ok';
  div.textContent = text;
  el.append(div);
}

/* Ошибка всегда попадает на страницу текстом. Отдельно разбираются два
   случая, в которых сухого сообщения мало:
   409 с подсказкой свободных окон — показываем окна кнопками;
   400 с разбором полей — показываем, какое поле не понравилось. */
export function showError(err, id = 'msg', { onSlot } = {}) {
  const el = box(id);
  el.innerHTML = '';
  markStalled(); // «Загрузка…» рядом с сообщением об ошибке — обман, снимаем

  const div = document.createElement('div');
  div.className = 'msg error';

  const human = {
    0: 'Нет связи с сервером',
    400: 'Данные не приняты',
    401: 'Нужен вход',
    403: 'Недостаточно прав',
    404: 'Не найдено',
    409: 'Так нельзя',
    429: 'Слишком часто'
  }[err.status] ?? `Ошибка ${err.status}`;

  div.append(Object.assign(document.createElement('strong'), { textContent: `${human}. ` }));
  div.append(document.createTextNode(err.message));

  /* Подсказка приходит списком окон: [{ date, starts_at, local_time }]. */
  const available = err.details?.available;
  const slots = Array.isArray(available) ? available : (available?.slots ?? []);
  if (err.status === 409 && slots.length > 0) {
    const hint = document.createElement('div');
    hint.className = 'details';
    hint.textContent = 'Ближайшее свободное время:';
    div.append(hint);

    for (const slot of slots) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = `${slot.date ?? slot.starts_at.slice(0, 10)} ${slot.local_time}`;
      btn.title = slot.starts_at;
      btn.addEventListener('click', () => onSlot?.(slot));
      div.append(btn);
    }
    if (!onSlot) {
      const note = document.createElement('div');
      note.className = 'details muted';
      note.textContent = 'Выберите другое время и повторите.';
      div.append(note);
    }
  } else if (err.details && typeof err.details === 'object') {
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(err.details, null, 2);
    div.append(pre);
  }

  el.append(div);
  el.scrollIntoView({ block: 'nearest' });
}

/* Обёртка для обработчиков: любая невыловленная ошибка API окажется
   на странице, а не только в консоли. */
export function guard(fn, id = 'msg') {
  return async (event) => {
    event?.preventDefault?.();
    clearMsg(id);
    try {
      await fn(event);
    } catch (err) {
      if (err instanceof ApiError) showError(err, id);
      else showError(new ApiError(0, { message: err.message }), id);
      console.error(err);
    }
  };
}

/* Общая сеть под всей страницей.

   Обёртка выше закрывает только то, что запускается по нажатию. Запросы
   первой загрузки живут на верхнем уровне модуля, и до этой сети их отказ
   попадал лишь в консоль: экран оставался с надписью «Загрузка…», а человек
   видел молчание. Правило простое — ни один ответ сервера не остаётся
   невидимым, поэтому ловим и то, что не поймали по дороге. */
window.addEventListener('unhandledrejection', (event) => {
  const err = event.reason;
  showError(err instanceof ApiError ? err : new ApiError(0, { message: err?.message ?? String(err) }));
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  showError(new ApiError(0, { message: event.message }));
});

/* Надпись «Загрузка…» после отказа — обман: ничего уже не грузится.
   Заменяем её на честную отметку, чтобы экран не выглядел занятым. */
function markStalled() {
  for (const node of document.querySelectorAll('*')) {
    if (node.children.length === 0 && node.textContent.trim() === 'Загрузка…') {
      node.textContent = 'не загрузилось — см. сообщение выше';
      node.classList.add('muted');
    }
  }
}

// ── Форматирование ──────────────────────────────────────────────────────────

export const money = (kopecks) =>
  `${(kopecks / 100).toLocaleString('ru-RU', { minimumFractionDigits: 0 })} ₽`;

let studioCache = null;
export async function studio() {
  studioCache ??= await api('GET', '/api/studio');
  return studioCache;
}

/* Время в API всегда UTC. Показываем его по часовому поясу студии —
   иначе тестировщик в другом поясе увидит не то, что мастер в журнале. */
export function whenLocal(iso, timezone) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: timezone, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(iso));
}

export const today = (timezone) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());

// ── Разметка ────────────────────────────────────────────────────────────────

export function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function table(headers, rows) {
  const head = el('tr', {}, ...headers.map((h) => el('th', { textContent: h })));
  return el('table', {}, el('thead', {}, head), el('tbody', {}, ...rows));
}

export function fillSelect(select, items, { value, label, empty }) {
  select.innerHTML = '';
  if (empty) select.append(el('option', { value: '', textContent: empty }));
  for (const item of items) {
    select.append(el('option', { value: String(value(item)), textContent: label(item) }));
  }
}

const PAGES = [
  ['index.html', 'Вход'],
  ['catalog.html', 'Услуги и мастера'],
  ['slots.html', 'Свободное время'],
  ['book.html', 'Создать запись'],
  ['account.html', 'Кабинет'],
  ['admin.html', 'Студия']
];

export function renderNav() {
  const here = location.pathname.split('/').pop() || 'index.html';
  const nav = el('nav', {});

  for (const [href, title] of PAGES) {
    nav.append(el('a', { href, textContent: title, className: href === here ? 'current' : '' }));
  }

  const user = currentUser();
  const who = el('span', { className: 'who' });
  if (user) {
    who.textContent = `${user.full_name} · ${user.role} · `;
    const out = el('button', { type: 'button', textContent: 'Выйти' });
    out.addEventListener('click', async () => {
      try { await api('POST', '/api/auth/logout'); } catch { /* сеанс мог истечь */ }
      clearSession();
      location.href = 'index.html';
    });
    who.append(out);
  } else {
    who.textContent = 'не вошли';
  }
  nav.append(who);
  document.body.prepend(nav);
}

/* Страницы кабинета и студии без входа бессмысленны. */
export function requireSession() {
  if (!token()) {
    location.href = `index.html?next=${encodeURIComponent(location.pathname.split('/').pop())}`;
    return false;
  }
  return true;
}

export const query = () => new URLSearchParams(location.search);
