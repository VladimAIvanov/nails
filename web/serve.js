/* Статический сервер для чернового фронтенда — без зависимостей.

   Отдаёт файлы из этой папки и переправляет всё, что начинается с /api,
   на бэкенд. Прокси здесь не для красоты: браузер видит один источник,
   поэтому не нужны ни межсайтовые заголовки, ни правка CORS_ORIGINS,
   а строгий Content-Security-Policy API не мешает странице — он приезжает
   с ответом JSON, а не с документом. */
import { createServer, request } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const ROOT = import.meta.dirname;

/* Пустое значение в .env — это «не задано», а не пустая строка: образец
   .env.example копируют целиком и заполняют не все строки. Иначе
   Number('') дал бы ноль, и страницы уехали бы на случайный порт. */
const text = (name, fallback) => {
  const raw = process.env[name];
  return raw === undefined || raw.trim() === '' ? fallback : raw.trim();
};
const port = (name, fallback) => {
  const value = Number(text(name, fallback));
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const WEB_PORT = port('WEB_PORT', 5173);
const API_PORT = port('PORT', 3000);
const API_HOST = text('API_HOST', '127.0.0.1');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

/* Путь из запроса складывается с корнем и проверяется: выйти за папку
   web/ последовательностью «..» нельзя. */
function safePath(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  const full = join(ROOT, clean === '' ? 'index.html' : clean);
  return full.startsWith(ROOT + sep) || full === ROOT ? full : null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${WEB_PORT}`);

  if (url.pathname.startsWith('/api')) {
    const proxied = request(
      { host: API_HOST, port: API_PORT, path: req.url, method: req.method, headers: req.headers },
      (upstream) => {
        res.writeHead(upstream.statusCode, upstream.headers);
        upstream.pipe(res);
      }
    );
    proxied.on('error', (err) => {
      res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        error: 'api_unreachable',
        message: `Бэкенд не отвечает на ${API_HOST}:${API_PORT}. Запустите его: npm start в папке server (${err.code})`
      }));
    });
    req.pipe(proxied);
    return;
  }

  const file = safePath(url.pathname);
  if (!file) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Нельзя выйти за пределы папки web');
    return;
  }

  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Нет такой страницы');
  }
});

server.listen(WEB_PORT, () => {
  console.log(`Черновой фронтенд: http://127.0.0.1:${WEB_PORT}`);
  console.log(`Запросы /api переправляются на ${API_HOST}:${API_PORT}\n`);
});
