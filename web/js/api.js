/* Единственное место, где страница разговаривает с сервером.

   Внутри страниц запросов быть не должно — правило из docs/frontend-rules.md.
   Здесь же живёт разбор ошибок: любой отказ сервера обязан оказаться на
   экране текстом, а не в консоли.

   Пропуск не хранится: сервер ставит куку сам, браузер сам её присылает.
   Поэтому здесь нет ни localStorage, ни заголовка Authorization — только
   credentials: 'same-origin', чтобы кука уехала вместе с запросом. */

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
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (err) {
    throw new ApiError(0, { message: `Сервер недоступен: ${err.message}` });
  }

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }

  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

/* Действует ли человек как клиентка. Повторяет правило сервера
   (actsAsClient в server/src/auth.js): у сотрудников свои экраны, и часть
   клиентских адресов им отвечает отказом — GET /api/appointments/my требует
   роль client, GET /api/passes и GET /api/loyalty ждут от них client_id.

   Проверяется наличие роли в списке, а не равенство основной: у владелицы
   студии их две. Прав это не выдаёт и не отнимает — только решает, что
   показывать. */
export const actsAsClient = (user) =>
  Boolean(user) && !user.roles?.some((r) => r === 'admin' || r === 'master');

/* Кто сейчас вошёл. Ответ 401 — это не поломка, а «никто»: страница должна
   уметь показать себя и гостю. */
export async function me() {
  try {
    return (await api('GET', '/api/auth/me')).user;
  } catch (err) {
    if (err.status === 401) return null;
    throw err;
  }
}

export const logout = () => api('POST', '/api/auth/logout');

// ── Показ ошибок ────────────────────────────────────────────────────────────

const HUMAN = {
  0: 'Нет связи с сервером',
  400: 'Данные не приняты',
  401: 'Нужен вход',
  403: 'Недостаточно прав',
  404: 'Не найдено',
  409: 'Так нельзя',
  429: 'Слишком часто'
};

/* Сообщение об ошибке в отведённом на странице месте. Поле, на которое
   пожаловался сервер, подсвечивается: сервер называет его в тексте
   в кавычках-ёлочках — «phone», «password». */
export function showError(err, boxId = 'msg', form = null) {
  const box = document.getElementById(boxId);
  if (!box) return;

  box.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'note note--error';
  div.append(Object.assign(document.createElement('strong'), {
    textContent: `${HUMAN[err.status] ?? `Ошибка ${err.status}`}. `
  }));
  div.append(document.createTextNode(err.message));
  box.append(div);

  clearFieldErrors(form);
  const field = String(err.message).match(/«([a-z_]+)»/)?.[1];
  if (form && field) {
    const input = form.querySelector(`[name="${field}"]`);
    if (input) {
      input.classList.add('field--bad');
      input.focus();
    }
  }

  box.scrollIntoView({ block: 'nearest' });
}

export function showOk(text, boxId = 'msg') {
  const box = document.getElementById(boxId);
  if (!box) return;
  box.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'note note--ok';
  div.textContent = text;
  box.append(div);
}

export function clearMsg(boxId = 'msg') {
  const box = document.getElementById(boxId);
  if (box) box.innerHTML = '';
}

export function clearFieldErrors(form) {
  if (!form) return;
  for (const el of form.querySelectorAll('.field--bad')) el.classList.remove('field--bad');
}

/* Обёртка вокруг любого действия: и по нажатию, и при первой загрузке.
   Без неё отказ первой загрузки оставался бы в консоли — на этом уже
   спотыкались, см. журнал разработки, раздел 19. */
export function guard(fn, boxId = 'msg', form = null) {
  return async (event) => {
    event?.preventDefault?.();
    clearMsg(boxId);
    try {
      await fn(event);
    } catch (err) {
      const wrapped = err instanceof ApiError ? err : new ApiError(0, { message: err.message });
      showError(wrapped, boxId, form);
      console.error(err);
    }
  };
}

/* Общая сеть: ни одна невыловленная ошибка не остаётся невидимой. */
window.addEventListener('unhandledrejection', (event) => {
  const err = event.reason;
  showError(err instanceof ApiError ? err : new ApiError(0, { message: err?.message ?? String(err) }));
  event.preventDefault();
});

// ── Мелочи вывода ───────────────────────────────────────────────────────────

/** Копейки — в рубли. Форматирует только вывод, в API уходят копейки. */
export const money = (kopecks) => `${(kopecks / 100).toLocaleString('ru-RU')} ₽`;

/** Минуты — в «1 ч 30 мин». */
export function duration(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} ч` : null, m ? `${m} мин` : null].filter(Boolean).join(' ');
}

/** Время API — UTC. Показываем по часовому поясу студии, он приходит с сервера. */
export function whenLocal(iso, timezone) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: timezone, day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit'
  }).format(new Date(iso));
}

let studioCache = null;
export async function studio() {
  studioCache ??= await api('GET', '/api/studio');
  return studioCache;
}

/** Короткая запись создания элемента. */
export function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Заглушки на время загрузки: серые прямоугольники вместо пустоты. */
export function skeletons(count, className = 'skeleton-card') {
  return Array.from({ length: count }, () => el('div', { className: `skeleton ${className}` }));
}
