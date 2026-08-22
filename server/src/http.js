/* Тонкий слой HTTP поверх node:http — без внешних зависимостей.
   Разбор тела, маршрутизация с параметрами, единый формат ошибок. */

export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, 'bad_request', message, details);
export const unauthorized = (message = 'Требуется вход') => new HttpError(401, 'unauthorized', message);
export const forbidden = (message = 'Недостаточно прав') => new HttpError(403, 'forbidden', message);
export const notFound = (message = 'Не найдено') => new HttpError(404, 'not_found', message);
export const conflict = (message, details) => new HttpError(409, 'conflict', message, details);

const MAX_BODY = 64 * 1024;

export async function readJson(req) {
  if (req.method === 'GET' || req.method === 'DELETE') return {};

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw badRequest('Тело запроса слишком большое');
    chunks.push(chunk);
  }
  if (size === 0) return {};

  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw badRequest('Тело запроса должно быть объектом JSON');
    }
    return parsed;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw badRequest('Тело запроса не разбирается как JSON');
  }
}

export function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  });
  res.end(body);
}

/* Маршрут вида '/api/appointments/:id' превращается в регулярное выражение
   с именованными группами. */
function compile(pattern) {
  const names = [];
  const source = pattern
    .split('/')
    .map((part) => {
      if (!part.startsWith(':')) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      names.push(part.slice(1));
      return '([^/]+)';
    })
    .join('/');
  return { regex: new RegExp(`^${source}$`), names };
}

export function createRouter() {
  const routes = [];

  const add = (method, pattern, handler) => {
    routes.push({ method, ...compile(pattern), handler, pattern });
  };

  return {
    get: (p, h) => add('GET', p, h),
    post: (p, h) => add('POST', p, h),
    patch: (p, h) => add('PATCH', p, h),
    delete: (p, h) => add('DELETE', p, h),
    list: () => routes.map((r) => `${r.method} ${r.pattern}`),

    match(method, pathname) {
      let pathExists = false;
      for (const route of routes) {
        const m = route.regex.exec(pathname);
        if (!m) continue;
        pathExists = true;
        if (route.method !== method) continue;
        const params = {};
        route.names.forEach((name, i) => { params[name] = decodeURIComponent(m[i + 1]); });
        return { handler: route.handler, params };
      }
      if (pathExists) throw new HttpError(405, 'method_not_allowed', 'Метод не поддерживается');
      throw notFound('Адрес не найден');
    }
  };
}
