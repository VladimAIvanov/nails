/* HTTP-сервер сервиса записи. Зависимостей нет: node:http и node:sqlite. */
import { createServer } from 'node:http';
import { db, dbFile } from './db.js';
import { createRouter, readJson, send, sendRaw, corsHeaders, HttpError } from './http.js';
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

router.get('/api/health', async () => ({
  body: { ok: true, database: dbFile, time: new Date().toISOString() }
}));

router.get('/api', async () => ({ body: { endpoints: router.list() } }));

const server = createServer(async (req, res) => {
  const started = Date.now();
  let status = 500;

  res.corsHeaders = corsHeaders(req.headers.origin);

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
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`Сервис записи «Варвара» слушает http://127.0.0.1:${port}`);
  console.log(`База: ${dbFile}`);
  console.log(`Список адресов: http://127.0.0.1:${port}/api\n`);
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




