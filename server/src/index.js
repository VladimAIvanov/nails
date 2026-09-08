/* HTTP-сервер сервиса записи. Зависимостей нет: node:http и node:sqlite. */
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { db, dbFile } from './db.js';
import { applyMigrations } from './migrations.js';
import { bootstrapAdmin } from './admin-bootstrap.js';
import {
  createRouter, readJson, send, sendRaw, corsHeaders, HttpError, SECURITY_HEADERS
} from './http.js';
import { requireRole } from './auth.js';
import { isSecure, trustedProxies, trustProxyNotes } from './net.js';
import { servePage } from './static.js';
import * as env from './env.js';
import registerAuth from './routes/auth.js';
import registerCatalog from './routes/catalog.js';
import registerHolds from './routes/holds.js';
import registerAppointments from './routes/appointments.js';
import registerAdmin from './routes/admin.js';
import registerExtras from './routes/extras.js';
import registerStudio from './routes/studio.js';
import registerManage from './routes/manage.js';
import registerProfile from './routes/profile.js';
import registerInbox from './routes/inbox.js';

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
registerInbox(router);

/* Права на административные адреса проверяются здесь, одной строкой на
   всю группу. Обработчики в routes/admin.js и routes/manage.js по-прежнему
   вызывают requireRole сами — но не ради защиты, а потому что им нужен сам
   пользователь: кто именно завёл услугу, кто подтвердил запись. Защита —
   вот эта строка, и новый адрес получает её, ничего для этого не делая.

   requireRole проверяет наличие роли в списке, а не равенство единственному
   значению: у владелицы студии их две — admin и master. */
router.guard('/api/admin/', ({ req }) => requireRole(req, 'admin'));

/* Путь к файлу базы наружу не отдаётся: это имя пользователя ОС и
   структура каталогов сервера. Для диагностики есть npm run doctor. */
router.get('/api/health', async () => ({ body: { ok: true, time: new Date().toISOString() } }));

router.get('/api', async () => ({ body: { endpoints: router.list() } }));

/* TLS. Ключ и сертификат задаются путями в окружении: держать их в коде
   или в репозитории нельзя. Если путей нет, сервер поднимается по обычному
   HTTP — это допустимо только за прокси, который завершает TLS сам,
   либо на локальном стенде. */
const tlsKey = env.text('TLS_KEY_FILE');
const tlsCert = env.text('TLS_CERT_FILE');
const ownTls = Boolean(tlsKey && tlsCert);

const production = env.text('NODE_ENV') === 'production';
const allowInsecure = env.flag('ALLOW_INSECURE_HTTP');

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
    res.writeHead(204, { ...SECURITY_HEADERS, ...res.corsHeaders });
    res.end();
    return;
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

    /* Всё, что не /api, — это страница из папки web. Тот же порт, что и у
       API: пропуск лежит в куке, а кука привязана к источнику. */
    if (!url.pathname.startsWith('/api')) {
      if (await servePage(req, res, url.pathname)) {
        status = res.statusCode;
        return;
      }
    }

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

for (const note of trustProxyNotes) {
  console.warn(`[окружение] ${note}`);
}

/* Миграции применяются здесь, до первого запроса. На сервере команду
   `npm run migrate` набирать некому: обновление происходит само, а контейнер
   при каждом деплое собирается заново. Применённое записано в
   schema_migrations и второй раз не выполняется, поэтому обычный запуск на
   готовой базе не делает ничего и ничего не стоит.

   Отказ здесь намеренно валит запуск: сервер с недокаченной схемой отвечал бы
   ошибками на половину адресов, и разбираться пришлось бы по ним, а не по
   понятному сообщению при старте. */
try {
  const { applied } = applyMigrations();
  if (applied.length > 0) {
    console.log(`Миграции применены при запуске: ${applied.join(', ')}`);
  }
} catch (err) {
  console.error(`\nОтказ запуска: не удалось применить миграции.\n  ${err.message}\n`);
  process.exit(1);
}

/* Первый администратор на чистой базе — из окружения, см. admin-bootstrap.js.
   Отказ здесь запуск не валит: сервис без администратора работает, клиенты
   записываются, и ронять его из-за короткого пароля было бы хуже проблемы. */
try {
  const { note } = bootstrapAdmin();
  if (note) console.log(`[администратор] ${note}`);
} catch (err) {
  console.error(`[администратор] не удалось завести: ${err.message}`);
}

const server = ownTls
  ? createHttpsServer({ key: readFileSync(tlsKey), cert: readFileSync(tlsCert) }, handler)
  : createHttpServer(handler);

const port = env.number('PORT', 3000, { min: 1 });
const scheme = ownTls ? 'https' : 'http';

/* Занятый порт — самая частая неприятность при первом запуске: на 3000
   сидит половина учебных проектов. Без этого обработчика Node печатает
   стек вызовов, из которого новичку неясно, что делать. */
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\nПорт ${port} уже занят другой программой.\n` +
      `  Запустите на свободном порту: PORT=3100 npm start\n` +
      `  (в PowerShell: $env:PORT=3100; npm start)\n` +
      '  Либо задайте PORT в файле .env — его читают и сервер, и страницы.\n'
    );
    process.exit(1);
  }
  throw err;
});

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





