/* Отдача страниц из папки web.

   Почему это делает тот же сервер, что и API: пропуск лежит в куке, а кука
   привязана к источнику. Страницы на одном порту, API на другом — и браузер
   считает запросы межсайтовыми: куку не пришлёт, вход работать не будет.
   Один порт снимает вопрос целиком — ни настройки CORS, ни послаблений.

   Заголовки безопасности здесь свои. Для API стоит запрет на всё
   (default-src 'none') — ответу JSON нечего загружать. Странице же нужны
   собственные стили, скрипты и шрифты, поэтому разрешено ровно это и
   ничего больше: чужие домены, инлайновые скрипты и фреймы закрыты. */
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { currentUser, hasRole } from './auth.js';

const WEB_ROOT = resolve(import.meta.dirname, '..', '..', 'web');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

/* Все ресурсы страницы — только с этого же сервера, шрифты тоже
   (web/fonts). Внешних источников нет. */
const PAGE_CSP = [
  "default-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "script-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'"
].join('; ');

const PAGE_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'content-security-policy': PAGE_CSP
};

/* Раздел администратора закрыт на сервере, а не спрятанной ссылкой.

   Закрывать нужно и страницу, и адреса API: если проверять только запросы
   к данным, клиентка откроет /admin и увидит каркас панели с пустыми
   таблицами. Это не утечка данных, но и не тот ответ, который сервис должен
   давать: человек решит, что панель сломалась, а не что она не для него.

   Проверок здесь две, и это разные проверки. Гость ещё не назвался — его
   отправляем на вход и запоминаем, куда он шёл. Клиентка назвалась, но роли
   у неё нет — это отказ, и он показывается страницей с объяснением. */
function isAdminPage(pathname) {
  return pathname === '/admin' || pathname === '/admin.html' || pathname.startsWith('/admin/');
}

/* Страницы кабинета: смотреть там нечего, пока человек не назвался.

   Данные они и раньше не выдавали — все запросы к API отвечают гостю 401.
   Но сама страница приходила с кодом 200, и гость успевал увидеть каркас
   пустого кабинета до того, как её скрипт уводил на вход. Разница между
   «сразу на вход» и «мигнуло и на вход» невелика, но первое — то, что
   человек ожидает, а второе выглядит сбоем.

   Страниц записи в списке нет намеренно: по ним гость проходит до конца
   и оформляет визит, не заводя кабинет. */
const PRIVATE_PAGES = new Set([
  '/account', '/profile', '/notifications', '/bonuses', '/sessions',
  '/appointment', '/password-change'
]);

const isPrivatePage = (pathname) =>
  PRIVATE_PAGES.has(pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/');

/** Отдаёт страницу из папки web с указанным кодом ответа. */
async function sendPage(req, res, name, status) {
  const file = join(WEB_ROOT, name);
  if (!(await exists(file))) return false;

  const page = await readFile(file);
  res.writeHead(status, {
    'content-type': TYPES['.html'],
    'content-length': page.length,
    'cache-control': 'no-store',
    ...PAGE_HEADERS
  });
  res.end(req.method === 'HEAD' ? undefined : page);
  return true;
}

/* Путь из запроса складывается с корнем и проверяется: выйти из папки web
   последовательностью «..» нельзя. */
function safePath(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, '');
  const full = join(WEB_ROOT, clean === '' ? 'index.html' : clean);
  return full === WEB_ROOT || full.startsWith(WEB_ROOT + sep) ? full : null;
}

/**
 * Пытается отдать файл страницы. Возвращает true, если ответ отправлен.
 * Адреса, начинающиеся с /api, сюда не попадают — их разбирает маршрутизатор.
 */
export async function servePage(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;

  if (isAdminPage(pathname) || isPrivatePage(pathname)) {
    const user = currentUser(req);

    if (!user) {
      res.writeHead(302, {
        location: `/login?next=${encodeURIComponent(pathname)}`,
        'cache-control': 'no-store',
        ...PAGE_HEADERS
      });
      res.end();
      return true;
    }

    if (isAdminPage(pathname) && !hasRole(user, 'admin')) {
      if (await sendPage(req, res, 'forbidden.html', 403)) return true;
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8', ...PAGE_HEADERS });
      res.end('Этот раздел только для администраторов');
      return true;
    }
  }

  let file = safePath(pathname);
  if (!file) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8', ...PAGE_HEADERS });
    res.end('Нельзя выйти за пределы папки web');
    return true;
  }

  /* Адрес без расширения — это страница: /login открывает login.html.
     Так ссылки в вёрстке выглядят чище, а файлы остаются обычными. */
  if (!extname(file)) {
    const asDirectory = join(file, 'index.html');
    const asPage = `${file}.html`;
    file = (await exists(asDirectory)) ? asDirectory : asPage;
  }

  let body;
  try {
    body = await readFile(file);
  } catch {
    /* Своя страница 404, если она есть; иначе короткий текст. */
    if (await sendPage(req, res, '404.html', 404)) return true;
    return false;
  }

  res.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'content-length': body.length,
    'cache-control': 'no-cache',
    ...PAGE_HEADERS
  });
  res.end(req.method === 'HEAD' ? undefined : body);
  return true;
}

async function exists(path) {
  try {
    const info = await stat(path);
    return info.isFile();
  } catch {
    return false;
  }
}
