/* HTTP-сервер сервиса записи. Зависимостей нет: node:http и node:sqlite. */
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { db, dbFile } from './db.js';
import { createRouter, readJson, send, sendRaw, corsHeaders, HttpError } from './http.js';
import { isSecure, trustedProxies } from './net.js';
import registerAuth from './routes/auth.js';
import registerCatalog from './routes/catalog.js';
import registerHolds from './routes/holds.js';
import registerAppointments from './routes/appointments.js';
import registerAdmin from './routes/admin.js';
import registerExtras from './routes/extras.js';
import registerStudio from './routes/studio.js';
import registerManage from './routes/manage.js';
import registerProfile from './routes/profile.js';

const router = createRouter();
registerAuth(router);
registerCatalog(router);
registerHolds(router);
registerAppointments(router);
registerAdmin(router);
registerExtras(router);
registerStudio(router);
registerManage(router);
registerProfile(router);

/* Путь к файлу базы наружу не отдаётся: это имя пользователя ОС и
   структура каталогов сервера. Для диагностики есть npm run doctor. */
router.get('/api/health', async () => ({ body: { ok: true, time: new Date().toISOString() } }));

router.get('/api', async () => ({ body: { endpoints: router.list() } }));

/* TLS. Ключ и сертификат задаются путями в окружении: держать их в коде
   или в репозитории нельзя. Если путей нет, сервер поднимается по обычному
   HTTP — это допустимо только за прокси, который завершает TLS сам,
   либо на локальном стенде. */
const tlsKey = process.env.TLS_KEY_FILE;
const tlsCert = process.env.TLS_CERT_FILE;
const ownTls = Boolean(tlsKey && tlsCert);

const production = process.env.NODE_ENV === 'production';
const allowInsecure = process.env.ALLOW_INSECURE_HTTP === 'true';

/* В рабочем режиме сервер отказывается стартовать по открытому HTTP,
   если TLS не завершает ни он сам, ни доверенный прокси. Токен сеанса ходит
   в заголовке: по открытому каналу его читает любой в той же сети. */
if (production && !ownTls && trustedProxies.length === 0 && !allowInsecure) {
  console.error(
    '\nОтказ запуска: рабочий режим без TLS.\n' +
    '  Задайте TLS_KEY_FILE и TLS_CERT_FILE, либо TRUST_PROXY со списком\n' +
    '  адресов прокси, который завершает TLS. Осознанный запуск по открытому\n' +
    '  HTTP — ALLOW_INSECURE_HTTP=true, но токены сеансов пойдут открытым текстом.\n'
  );
  process.exit(1);
}

const handler = async (req, res) => {
  const started = Date.now();
  let status = 500;

  res.corsHeaders = corsHeaders(req.headers.origin);

  /* HSTS ставится только на защищённом соединении: на открытом он
     бессмысленен, а браузер запомнит правило и для локальной разработки. */
  if (isSecure(req)) {
    res.corsHeaders = {
      ...res.corsHeaders,
      'strict-transport-security': 'max-age=31536000; includeSubDomains'
    };
  }

  /* Предварительный запрос браузера перед межсайтовым обращением.
     Отвечать на него должен сервер, до всякой маршрутизации. */
  if (req.method === 'OPTIONS') {
    res.writeHead(204, res.corsHeaders);
    res.end();
    return;
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    const { handler, params } = router.match(req.method, url.pathname);
    const body = await readJson(req);

    const result = await handler({ req, res, params, query: url.searchParams, body });
    status = result.status ?? 200;

    if (result.raw) {
      sendRaw(res, status, result.raw.contentType, result.raw.body, result.raw.headers);
    } else {
      send(res, status, result.body);
    }
  } catch (err) {
    if (err instanceof HttpError) {
      status = err.status;
      if (err.retryAfter) res.corsHeaders = { ...res.corsHeaders, 'retry-after': String(err.retryAfter) };
      send(res, status, { error: err.code, message: err.message, details: err.details });
    } else {
      status = 500;
      console.error('[ошибка]', err);
      send(res, 500, { error: 'internal', message: 'Внутренняя ошибка сервера' });
    }
  } finally {
    console.log(`${req.method} ${req.url} → ${status} (${Date.now() - started} мс)`);
  }
};

const server = ownTls
  ? createHttpsServer({ key: readFileSync(tlsKey), cert: readFileSync(tlsCert) }, handler)
  : createHttpServer(handler);

const port = Number(process.env.PORT ?? 3000);
const scheme = ownTls ? 'https' : 'http';

server.listen(port, () => {
  console.log(`Сервис записи «Варвара» слушает ${scheme}://127.0.0.1:${port}`);
  console.log(`База: ${dbFile}`);
  if (ownTls) {
    console.log('TLS: собственный сертификат');
  } else if (trustedProxies.length > 0) {
    console.log(`TLS: ожидается от прокси (${trustedProxies.join(', ')})`);
  } else {
    console.log('TLS: нет. Допустимо только на локальном стенде');
  }
  console.log(`Список адресов: ${scheme}://127.0.0.1:${port}/api\n`);
});

/* Корректное завершение: незакрытая база оставляет журнал WAL несведённым. */
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log('\nОстановка…');
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}





