/* Сквозная проверка сценариев проектной работы.

   Поднимает отдельный сервер на временной базе, загружает демо-данные
   и проходит сценарии клиента и администратора через HTTP — так же, как их
   проходят страницы. Рабочая база в server/data не трогается.

   Запуск из папки server:  node scripts/e2e-scenarios.mjs
   Результат — таблица «сценарий → ожидание → факт» в консоли и JSON
   в scripts/e2e-result.json (для чек-листа в docs/test-scenarios.md).

   Пароли демо-учёток генерируются сидами и живут только в памяти скрипта. */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SERVER = join(import.meta.dirname, '..');
const TZ = 'Europe/Moscow';
const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), 'nogotochki-e2e-'));
const env = {
  ...process.env,
  SQLITE_PATH: join(dir, 'e2e.db'),
  PORT: String(PORT),
  RATE_LIMIT_SIGNUP: '100',
  RATE_LIMIT_LOGIN: '100',
  SEED_SHOW_PASSWORDS: 'true'
};

// ── Подготовка базы ─────────────────────────────────────────────────────────
const run = (script) => {
  const r = spawnSync(process.execPath, [`src/${script}`], { cwd: SERVER, env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${script}: ${r.stderr || r.stdout}`);
  return r.stdout;
};
run('migrate.js');
const seedOut = run('seed.js');
const passwords = Object.fromEntries(
  [...seedOut.matchAll(/^\s{4}(\S+)\s+(\S+)$/gm)].map((m) => [m[1], m[2]])
);

const server = spawn(process.execPath, ['src/index.js'], { cwd: SERVER, env, stdio: 'ignore' });
const stop = () => { server.kill(); try { rmSync(dir, { recursive: true, force: true }); } catch {} };
process.on('exit', stop);

for (let i = 0; i < 50; i++) {
  try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 100));
}

// ── Помощники ───────────────────────────────────────────────────────────────
async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    redirect: 'manual',
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

async function page(path, token) {
  const res = await fetch(BASE + path, {
    redirect: 'manual',
    headers: token ? { cookie: `nogotochki_session=${token}` } : {}
  });
  return { status: res.status, location: res.headers.get('location'), text: await res.text() };
}

const login = async (loginName) =>
  (await call('POST', '/api/auth/login', { body: { login: loginName, password: passwords[loginName] } })).json.token;

/* Ближайший такой день недели после сегодняшнего по календарю студии —
   тот же расчёт, что в сидах. 1 — понедельник. */
function nextWeekday(weekday, week = 0) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  const d = new Date(`${today}T00:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (((d.getUTCDay() + 6) % 7) + 1 !== weekday);
  d.setUTCDate(d.getUTCDate() + 7 * week);
  return d.toISOString().slice(0, 10);
}
const msk = (date, time) => new Date(`${date}T${time}:00+03:00`).toISOString().replace('.000Z', 'Z');
const hhmm = (iso) => new Date(iso).toLocaleTimeString('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

const results = [];
function record(id, title, expected, actual, pass) {
  results.push({ id, title, expected, actual, pass: Boolean(pass) });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${title}\n      ожидали: ${expected}\n      факт:    ${actual}`);
}

const slots = async (masterId, date, serviceIds) => {
  const q = serviceIds.map((s) => `service_id=${s}`).join('&');
  const r = await call('GET', `/api/masters/${masterId}/slots?date=${date}&${q}`);
  return { status: r.status, times: (r.json?.slots ?? []).map((s) => s.local_time), reason: r.json?.reason, message: r.json?.message };
};

// ── Каталог ─────────────────────────────────────────────────────────────────
const services = (await call('GET', '/api/services')).json.services;
const masters = (await call('GET', '/api/masters')).json.masters;
const svc = (title) => services.find((s) => s.title.startsWith(title)).id;
const mst = (name) => masters.find((m) => m.name.startsWith(name)).id;
const MANICURE = svc('Маникюр с покрытием'), LAMINATION = svc('Ламинирование'), BROW_TINT = svc('Коррекция'), EXTENSION = svc('Наращивание');
const ANNA = mst('Анна'), MARINA = mst('Марина'), ELENA = mst('Елена');

const WED = nextWeekday(3), THU = nextWeekday(4), FRI = nextWeekday(5), SAT = nextWeekday(6), MON = nextWeekday(1);
const TUE = nextWeekday(2, 1); // вторник через неделю: заведомо дальше суток

// ── Шаг 5. Регистрация и вход ───────────────────────────────────────────────
{
  const r = await call('POST', '/api/auth/register', {
    body: { full_name: 'Мария Тестова', phone: '+79219990001', password: 'Test-password-2026', consent_personal_data: true }
  });
  const me = r.json?.token ? await call('GET', '/api/auth/me', { token: r.json.token }) : null;
  record('R1', 'Регистрация нового клиента', '201, пользователь с ролью client',
    `${r.status}, роль ${me?.json?.user?.role ?? me?.json?.role}`, r.status === 201 && JSON.stringify(me?.json).includes('client'));
  passwords['+79219990001'] = 'Test-password-2026';
}
const MARIA = await login('+79219990001');
const IRINA = await login('+79210000010');
const OLGA = await login('+79210000011');
const DARIA = await login('+79210000012');
const ADMIN = await login('admin@nogotochkee.ru');
record('R2', 'Вход зарегистрированных пользователей', 'токены у трёх клиенток из тестовых данных и администратора',
  [IRINA, OLGA, DARIA, ADMIN].map((t) => (t ? 'есть' : 'нет')).join(', '), IRINA && OLGA && DARIA && ADMIN);
{
  const cab = await page('/account', IRINA);
  const anon = await page('/account');
  record('R3', 'Личный кабинет после входа', 'с сессией /account — 200; без сессии — редирект на вход',
    `с сессией ${cab.status}; без сессии ${anon.status} → ${anon.location}`, cab.status === 200 && anon.status >= 300 && anon.status < 400);
}

// ── Шаг 6. Расчёт свободного времени ────────────────────────────────────────
{
  const s = await slots(ANNA, WED, [MANICURE]);
  const overlap = s.times.filter((t) => t < '11:30' && t > '08:30');
  record('K1', `Контроль 1: Анна, среда ${WED}, маникюр, есть запись Ирины на 10:00`,
    'нет окон, пересекающихся с 10:00–11:30; первое окно 11:30',
    `окна: ${s.times.join(' ')}`, overlap.length === 0 && s.times[0] === '11:30');
}
{
  const s = await slots(MARINA, FRI, [LAMINATION]);
  const bad = s.times.filter((t) => t > '14:00' && t < '17:00');
  record('K2', `Контроль 2: Марина, пятница ${FRI}, ламинирование 1 ч, блокировка 15:00–17:00`,
    'нет окон, задевающих 15:00–17:00 (последнее до блокировки — 14:00, следующее — 17:00)',
    `окна: ${s.times.join(' ')}`, bad.length === 0 && s.times.includes('14:00') && s.times.includes('17:00'));
}
{
  const s = await slots(ANNA, THU, [MANICURE]);
  const bad = s.times.filter((t) => t > '11:30' && t < '14:00');
  record('S6.1', `Анна, четверг ${THU}, маникюр 1,5 ч, обед 13:00–14:00, смена до 18:00`,
    'нет окон с 12:00 до 13:30; последнее окно 16:30',
    `окна: ${s.times.join(' ')}`, bad.length === 0 && s.times.at(-1) === '16:30');
}
{
  const s = await slots(ANNA, TUE, [EXTENSION]);
  record('S6.2', `Анна, вторник ${TUE}, наращивание 2,5 ч, смена до 18:00`,
    'последнее окно 15:30 (заканчивается ровно в 18:00)', `окна: ${s.times.join(' ')}`, s.times.at(-1) === '15:30');
}
{
  const s = await slots(ELENA, SAT, [LAMINATION]);
  record('S6.3', `Елена, суббота ${SAT}, выходной на весь день`, 'окон нет', `окон: ${s.times.length}`, s.times.length === 0);
}
{
  const s = await slots(ANNA, MON, [MANICURE]);
  record('S6.4', `Анна, понедельник ${MON}`, 'студия и мастер не работают — окон нет', `окон: ${s.times.length}, причина ${s.reason}`, s.times.length === 0);
}
{
  const s = await slots(MARINA, FRI, [EXTENSION]);
  record('S6.5', 'Марина — наращивание', 'отказ: мастер не оказывает услугу', `${s.status}: ${s.message}`, s.status === 400);
}

// ── Шаг 7. Создание записи ──────────────────────────────────────────────────
let mariaAppt;
{
  const before = await slots(ANNA, TUE, [MANICURE]);
  const hold = await call('POST', '/api/holds', { token: MARIA, body: { master_id: ANNA, service_ids: [MANICURE], starts_at: msk(TUE, '11:00') } });
  const created = await call('POST', '/api/appointments', {
    token: MARIA, body: { master_id: ANNA, service_ids: [MANICURE], starts_at: msk(TUE, '11:00'), hold_token: hold.json?.hold_token }
  });
  mariaAppt = created.json?.appointments?.[0];
  const my = await call('GET', '/api/appointments/my', { token: MARIA });
  const inAdmin = await call('GET', `/api/admin/appointments?date=${TUE}&master_id=${ANNA}`, { token: ADMIN });
  const after = await slots(ANNA, TUE, [MANICURE]);
  const ok = created.status === 201 && my.json.upcoming.some((a) => a.id === mariaAppt.id)
    && JSON.stringify(inAdmin.json).includes(`"id":${mariaAppt.id}`)
    && before.times.includes('11:00') && !after.times.includes('11:00') && !after.times.includes('10:00');
  record('S7', `Создание записи: Мария → Анна, вторник ${TUE}, 11:00, маникюр`,
    'запись создана, есть в базе (панель администратора) и в кабинете; 11:00 и пересекающиеся окна пропали',
    `создание ${created.status}; в кабинете ${my.json.upcoming.some((a) => a.id === mariaAppt?.id) ? 'да' : 'нет'}; `
    + `в панели ${JSON.stringify(inAdmin.json).includes(`"id":${mariaAppt?.id}`) ? 'да' : 'нет'}; окна до: ${before.times.join(' ')}; после: ${after.times.join(' ')}`, ok);
}

// ── Шаг 8. Конфликт слотов (контроль 3) ─────────────────────────────────────
let irinaElena;
{
  const at = msk(TUE, '10:00');
  const seenByIrina = (await slots(ELENA, TUE, [BROW_TINT])).times.includes('10:00');
  const seenByOlga = (await slots(ELENA, TUE, [BROW_TINT])).times.includes('10:00');
  const first = await call('POST', '/api/appointments', { token: IRINA, body: { master_id: ELENA, service_ids: [BROW_TINT], starts_at: at } });
  const second = await call('POST', '/api/appointments', { token: OLGA, body: { master_id: ELENA, service_ids: [BROW_TINT], starts_at: at } });
  irinaElena = first.json?.appointments?.[0];
  record('K3', `Контроль 3: Ирина и Ольга выбрали одно окно у Елены, вторник ${TUE}, 10:00`,
    'оба видят 10:00; первая запись создаётся, вторая получает отказ 409 и подсказку свободных окон',
    `видят: ${seenByIrina && seenByOlga ? 'обе' : 'нет'}; первая ${first.status}; вторая ${second.status} «${second.json?.message}», `
    + `подсказок ${second.json?.details?.available?.length ?? second.json?.available?.length ?? 0}`,
    seenByIrina && seenByOlga && first.status === 201 && second.status === 409);
}
{
  const at = msk(TUE, '12:00');
  const h1 = await call('POST', '/api/holds', { token: IRINA, body: { master_id: ELENA, service_ids: [BROW_TINT], starts_at: at } });
  const h2 = await call('POST', '/api/holds', { token: OLGA, body: { master_id: ELENA, service_ids: [BROW_TINT], starts_at: at } });
  record('S8.2', 'Конфликт на шаге подтверждения: обе открыли экран подтверждения одного окна',
    'первой окно удерживается, второй — отказ 409', `первая ${h1.status}; вторая ${h2.status} «${h2.json?.message}»`,
    h1.status === 201 && h2.status === 409);
  if (h1.json?.hold_token) await call('DELETE', `/api/holds/${h1.json.hold_token}`, { token: IRINA });
}

// ── Чужая запись ────────────────────────────────────────────────────────────
{
  const read = await call('GET', `/api/appointments/${irinaElena.id}`, { token: OLGA });
  const move = await call('PATCH', `/api/appointments/${irinaElena.id}`, { token: OLGA, body: { starts_at: msk(TUE, '16:00') } });
  const cancel = await call('POST', `/api/appointments/${irinaElena.id}/cancel`, { token: OLGA, body: {} });
  const list = await call('GET', '/api/appointments/my', { token: OLGA });
  const leaked = [...list.json.upcoming, ...list.json.past].some((a) => a.id === irinaElena.id);
  record('S13.3', 'Ольга пытается открыть, перенести и отменить запись Ирины',
    'все три действия — 403; в списке Ольги записи Ирины нет',
    `чтение ${read.status}, перенос ${move.status}, отмена ${cancel.status}; в списке Ольги: ${leaked ? 'есть' : 'нет'}`,
    read.status === 403 && move.status === 403 && cancel.status === 403 && !leaked);
}

// ── Шаг 9. Админ-панель ─────────────────────────────────────────────────────
{
  const client = await page('/admin', IRINA);
  const clientServices = await page('/admin/services', IRINA);
  const anon = await page('/admin');
  const api = await call('GET', '/api/admin/appointments', { token: IRINA });
  const admin = await page('/admin', ADMIN);
  const leaks = /admin-appointments\.js|admin-services\.js/.test(client.text + clientServices.text);
  record('S9', 'Доступ к /admin',
    'администратор — 200; клиент — 403 без содержимого панели; гость — на вход; API панели для клиента — 403',
    `админ ${admin.status}; клиент /admin ${client.status}, /admin/services ${clientServices.status}, содержимое панели ${leaks ? 'видно' : 'не отдаётся'}; `
    + `гость ${anon.status} → ${anon.location}; API ${api.status}`,
    admin.status === 200 && client.status === 403 && clientServices.status === 403 && !leaks && api.status === 403 && anon.status >= 300 && anon.status < 400);
}

// ── Перенос клиентом ────────────────────────────────────────────────────────
{
  const moved = await call('PATCH', `/api/appointments/${mariaAppt.id}`, { token: MARIA, body: { starts_at: msk(TUE, '14:00') } });
  const my = await call('GET', '/api/appointments/my', { token: MARIA });
  const mine = my.json.upcoming.filter((a) => a.service.id === MANICURE || a.service_id === MANICURE);
  const after = await slots(ANNA, TUE, [MANICURE]);
  record('S13.6', 'Перенос: Мария переносит свою запись с 11:00 на 14:00',
    'та же запись с новым временем, новой не появилось; 11:00 снова свободно, 14:00 занято',
    `перенос ${moved.status}; записей у Марии ${mine.length}, id ${mine.map((a) => a.id).join(',')}, время ${mine.map((a) => hhmm(a.starts_at)).join(',')}; `
    + `11:00 ${after.times.includes('11:00') ? 'свободно' : 'занято'}, 14:00 ${after.times.includes('14:00') ? 'свободно' : 'занято'}`,
    moved.status === 200 && mine.length === 1 && mine[0].id === mariaAppt.id && hhmm(mine[0].starts_at) === '14:00'
    && after.times.includes('11:00') && !after.times.includes('14:00'));
}
{
  const r = await call('PATCH', `/api/appointments/${mariaAppt.id}`, { token: MARIA, body: { starts_at: msk(TUE, '17:00') } });
  record('S13.6b', 'Перенос на 17:00: маникюр 1,5 ч не успевает до конца смены Анны в 18:00',
    'отказ 409', `${r.status} «${r.json?.message}»`, r.status === 409);
}

// ── Окна для переноса не занимает сама переносимая запись ────────────────────
{
  const q = `/api/masters/${ANNA}/slots?date=${TUE}&service_id=${MANICURE}&exclude_appointment_id=${mariaAppt.id}`;
  const plain = await slots(ANNA, TUE, [MANICURE]);
  const own = await call('GET', q, { token: MARIA });
  const ownTimes = (own.json?.slots ?? []).map((s) => s.local_time);
  const foreign = await call('GET', q, { token: OLGA });
  const anon = await call('GET', q);
  record('U4', 'Перенос: запись Марии 14:00–15:30 в окнах для переноса не мешает сама себе',
    'без исключения 14:30 занято; с исключением своей записи 14:30 и 14:00 доступны; чужую запись исключить нельзя — 403',
    `без исключения 14:30 ${plain.times.includes('14:30') ? 'свободно' : 'занято'}; своя: ${own.status}, 14:00 ${ownTimes.includes('14:00') ? 'есть' : 'нет'}, 14:30 ${ownTimes.includes('14:30') ? 'есть' : 'нет'}; `
    + `Ольга ${foreign.status}; гость ${anon.status}`,
    !plain.times.includes('14:30') && own.status === 200 && ownTimes.includes('14:30') && ownTimes.includes('14:00')
    && foreign.status === 403 && anon.status === 403);

  const moved = await call('PATCH', `/api/appointments/${mariaAppt.id}`, { token: MARIA, body: { starts_at: msk(TUE, '14:30') } });
  const list = await call('GET', `/api/admin/appointments?date=${TUE}&master_id=${ANNA}`, { token: ADMIN });
  const note = list.json.appointments.find((a) => a.id === mariaAppt.id)?.last_note ?? '';
  record('U5', 'Комментарий к переносу в панели — по часам студии',
    'перенос на пересекающееся со старым время проходит; в комментарии «14:00» и «14:30», без формата базы …T…Z',
    `перенос ${moved.status}; комментарий «${note}»`,
    moved.status === 200 && note.includes('14:00') && note.includes('14:30') && !/\dT\d/.test(note));
}

// ── Отмена клиентом ─────────────────────────────────────────────────────────
{
  const r = await call('POST', `/api/appointments/${mariaAppt.id}/cancel`, { token: MARIA, body: {} });
  const my = await call('GET', '/api/appointments/my', { token: MARIA });
  const rec = [...my.json.upcoming, ...my.json.past].find((a) => a.id === mariaAppt.id);
  const after = await slots(ANNA, TUE, [MANICURE]);
  record('S13.5', 'Отмена: Мария отменяет свою запись',
    'статус «отменена», запись осталась в истории, 14:00 снова свободно',
    `отмена ${r.status}; статус ${rec?.status}; в истории ${my.json.past.some((a) => a.id === mariaAppt.id) ? 'да' : 'нет'}; 14:00 ${after.times.includes('14:00') ? 'свободно' : 'занято'}`,
    r.status === 200 && rec?.status === 'cancelled' && after.times.includes('14:00'));
}

// ── Шаг 11. Управление записями и расписанием ───────────────────────────────
{
  const all = await call('GET', '/api/admin/appointments?limit=200', { token: ADMIN });
  const names = new Set(all.json.appointments.map((a) => a.client.name));
  record('S11.1', 'Администратор видит записи всех клиентов', 'в списке записи Ирины, Ольги, Дарьи и Марии',
    [...names].join(', '), ['Ирина Петрова', 'Ольга Соколова', 'Дарья Волкова', 'Мария Тестова'].every((n) => names.has(n)));
}
{
  const daria = (await call('GET', '/api/appointments/my', { token: DARIA })).json.upcoming[0];
  const r = await call('PATCH', `/api/appointments/${daria.id}`, { token: ADMIN, body: { starts_at: msk(nextWeekday(2), '16:00') } });
  const seen = (await call('GET', '/api/appointments/my', { token: DARIA })).json.upcoming.find((a) => a.id === daria.id);
  const inbox = await call('GET', '/api/notifications', { token: DARIA });
  record('S12', 'Администратор переносит запись Дарьи с 14:00 на 16:00 — клиентка видит это в кабинете',
    'та же запись в кабинете Дарьи с временем 16:00, уведомление о переносе',
    `перенос ${r.status}; в кабинете ${hhmm(seen?.starts_at)}; уведомлений ${inbox.json?.items?.length ?? inbox.json?.notifications?.length ?? '?'}`,
    r.status === 200 && seen && hhmm(seen.starts_at) === '16:00');
}
{
  const olga = (await call('GET', '/api/appointments/my', { token: OLGA })).json.upcoming.find((a) => a.master.id === MARINA || a.master_id === MARINA);
  const before = await slots(MARINA, THU, [LAMINATION]);
  const r = await call('POST', `/api/appointments/${olga.id}/cancel`, { token: ADMIN, body: { reason: 'проверка отмены администратором' } });
  const seen = (await call('GET', '/api/appointments/my', { token: OLGA })).json;
  const rec = [...seen.upcoming, ...seen.past].find((a) => a.id === olga.id);
  const after = await slots(MARINA, THU, [LAMINATION]);
  record('S11.2', 'Администратор отменяет запись Ольги к Марине (четверг 12:00)',
    'в кабинете Ольги статус «отменена»; окно 12:00 у Марины снова доступно',
    `отмена ${r.status}; статус у Ольги ${rec?.status}; 12:00 до: ${before.times.includes('12:00') ? 'свободно' : 'занято'}, после: ${after.times.includes('12:00') ? 'свободно' : 'занято'}`,
    r.status === 200 && rec?.status === 'cancelled' && !before.times.includes('12:00') && after.times.includes('12:00'));
}
{
  const before = await slots(ANNA, TUE, [MANICURE]);
  const r = await call('POST', '/api/admin/time-off', {
    token: ADMIN, body: { master_id: ANNA, starts_at: msk(TUE, '15:00'), ends_at: msk(TUE, '16:00'), kind: 'break', reason: 'проверка блокировки' }
  });
  const after = await slots(ANNA, TUE, [MANICURE]);
  const bad = after.times.filter((t) => t > '13:30' && t < '16:00');
  record('S11.3', `Администратор блокирует Анне вторник ${TUE} 15:00–16:00`,
    'окна маникюра с 14:00 до 15:30 пропадают, 13:30 и 16:00 остаются',
    `блокировка ${r.status}; до: ${before.times.join(' ')}; после: ${after.times.join(' ')}`,
    r.status === 201 && bad.length === 0 && after.times.includes('13:30') && after.times.includes('16:00'));
}

// ── Шаг 10. Услуги и мастера ────────────────────────────────────────────────
{
  const adminServices = (await call('GET', '/api/admin/services', { token: ADMIN })).json.services;
  const categoryId = adminServices.find((s) => s.slug === 'design').category_id;
  const add = await call('POST', '/api/admin/services', {
    token: ADMIN, body: { slug: 'test-french', title: 'Френч (тест)', category_id: categoryId, duration_min: 30, price_kopecks: 50000 }
  });
  const id = add.json?.service?.id ?? add.json?.id;
  const edit = await call('PATCH', `/api/admin/services/${id}`, { token: ADMIN, body: { price_kopecks: 55000 } });
  const pub = (await call('GET', '/api/services')).json.services.find((s) => s.id === id);
  record('S10.1', 'Администратор добавляет услугу и меняет ей цену', 'услуга появляется в каталоге с новой ценой 550 ₽',
    `добавление ${add.status}, правка ${edit.status}; в каталоге ${pub ? `${pub.price_kopecks / 100} ₽` : 'нет'}`,
    add.status === 201 && edit.status === 200 && pub?.price_kopecks === 55000);
}
{
  const add = await call('POST', '/api/admin/masters', {
    token: ADMIN, body: { full_name: 'Светлана Тестова', email: 'svetlana@nogotochkee.ru', phone: '+79219990002', password: 'Test-password-2026', service_ids: [MANICURE] }
  });
  const id = add.json?.master?.id ?? add.json?.id;
  const edit = await call('PATCH', `/api/admin/masters/${id}`, { token: ADMIN, body: { full_name: 'Светлана Тестова-Иванова' } });
  const pub = (await call('GET', '/api/masters')).json.masters.find((m) => m.id === id);
  record('S10.2', 'Администратор добавляет мастера и меняет ему имя', 'мастер появляется в списке с новым именем',
    `добавление ${add.status}, правка ${edit.status}; в списке ${pub?.name ?? 'нет'}`,
    add.status === 201 && edit.status === 200 && pub?.name === 'Светлана Тестова-Иванова');
}
{
  const off = await call('PATCH', `/api/admin/services/${BROW_TINT}`, { token: ADMIN, body: { is_active: false } });
  const inCatalog = (await call('GET', '/api/services')).json.services.some((s) => s.id === BROW_TINT);
  const s = await slots(ELENA, TUE, [BROW_TINT]);
  const book = await call('POST', '/api/appointments', { token: DARIA, body: { master_id: ELENA, service_ids: [BROW_TINT], starts_at: msk(TUE, '11:00') } });
  const old = (await call('GET', `/api/appointments/${irinaElena.id}`, { token: IRINA })).json;
  record('S13.7a', 'Отключение услуги «Коррекция и окрашивание бровей»',
    'нет в каталоге, окна и запись — отказ; у уже созданной записи Ирины услуга по-прежнему показывается',
    `отключение ${off.status}; в каталоге ${inCatalog ? 'есть' : 'нет'}; окна ${s.status}; запись ${book.status}; у Ирины: «${old?.service?.title ?? old?.service_title}», статус ${old?.status}`,
    off.status === 200 && !inCatalog && s.status >= 400 && book.status >= 400 && (old?.service?.title ?? old?.service_title)?.startsWith('Коррекция'));
  await call('PATCH', `/api/admin/services/${BROW_TINT}`, { token: ADMIN, body: { is_active: true } });
}
{
  const off = await call('PATCH', `/api/admin/masters/${ELENA}`, { token: ADMIN, body: { is_active: false } });
  const inList = (await call('GET', '/api/masters')).json.masters.some((m) => m.id === ELENA);
  const s = await slots(ELENA, TUE, [LAMINATION]);
  const book = await call('POST', '/api/appointments', { token: DARIA, body: { master_id: ELENA, service_ids: [LAMINATION], starts_at: msk(TUE, '13:00') } });
  const old = (await call('GET', `/api/appointments/${irinaElena.id}`, { token: IRINA })).json;
  record('S13.7b', 'Отключение мастера Елены Смирновой',
    'нет в списке мастеров, окон нет, запись — отказ; у уже созданной записи Ирины мастер по-прежнему показывается',
    `отключение ${off.status}; в списке ${inList ? 'есть' : 'нет'}; окон ${s.times.length} (${s.reason ?? s.status}); запись ${book.status}; у Ирины: «${old?.master?.name ?? old?.master_name}»`,
    off.status === 200 && !inList && s.times.length === 0 && book.status >= 400 && (old?.master?.name ?? old?.master_name)?.startsWith('Елена'));
  await call('PATCH', `/api/admin/masters/${ELENA}`, { token: ADMIN, body: { is_active: true } });
}

// ── Итог ────────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.pass);
console.log(`\nИтого: ${results.length - failed.length} из ${results.length} прошли`);
writeFileSync(join(import.meta.dirname, 'e2e-result.json'),
  JSON.stringify({ ranAt: new Date().toISOString(), dates: { WED, THU, FRI, SAT, MON, TUE }, results }, null, 2));
stop();
process.exit(failed.length ? 1 : 0);
