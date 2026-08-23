/* Ограничение частоты запросов со счётчиками в базе.

   Раньше счётчики жили в памяти процесса и обнулялись при каждом
   перезапуске: достаточно было дождаться развёртывания, чтобы перебор
   паролей начался заново. Теперь они переживают перезапуск. */
import { get, run } from './db.js';
import { HttpError } from './http.js';
import { nowIso, toIso } from './time.js';
import * as env from './env.js';

/* Пороги вынесены в окружение: на боевом сервере их держат строже,
   а на стенде послабее, чтобы проверки не упирались в ограничитель. */
export const LIMITS = {
  login: {
    max: env.number('RATE_LIMIT_LOGIN', 8),
    windowMin: env.number('RATE_LIMIT_LOGIN_WINDOW_MIN', 15, { min: 1 })
  },
  signup: {
    max: env.number('RATE_LIMIT_SIGNUP', 5),
    windowMin: env.number('RATE_LIMIT_SIGNUP_WINDOW_MIN', 60, { min: 1 })
  }
};

const windowStart = (minutes) => toIso(new Date(Date.now() - minutes * 60_000));

/* Проверка перед действием. Бросает 429, если окно исчерпано. */
export function check(bucket, key) {
  const { max, windowMin } = LIMITS[bucket];
  if (max <= 0) return; // 0 — ограничение выключено

  const row = get(
    'SELECT count, first_at FROM rate_limits WHERE bucket = $bucket AND key = $key',
    { bucket, key: String(key ?? 'unknown') }
  );
  if (!row) return;

  // окно истекло — счётчик больше не действует
  if (row.first_at < windowStart(windowMin)) return;
  if (row.count < max) return;

  const waitSec = Math.ceil(
    (Date.parse(row.first_at) + windowMin * 60_000 - Date.now()) / 1000
  );
  const err = new HttpError(429, 'too_many_attempts',
    bucket === 'login'
      ? `Слишком много попыток входа. Повторите через ${Math.ceil(waitSec / 60)} мин`
      : `Слишком много регистраций. Повторите через ${Math.ceil(waitSec / 60)} мин`);
  err.retryAfter = Math.max(1, waitSec);
  throw err;
}

/* Отметить попытку. Если окно истекло, счёт начинается заново. */
export function hit(bucket, key) {
  const { windowMin } = LIMITS[bucket];
  const id = String(key ?? 'unknown');
  const row = get(
    'SELECT count, first_at FROM rate_limits WHERE bucket = $bucket AND key = $key',
    { bucket, key: id }
  );

  if (!row || row.first_at < windowStart(windowMin)) {
    run(
      `INSERT INTO rate_limits (bucket, key, count, first_at) VALUES ($bucket, $key, 1, $now)
       ON CONFLICT (bucket, key) DO UPDATE SET count = 1, first_at = excluded.first_at`,
      { bucket, key: id, now: nowIso() }
    );
    return;
  }

  run('UPDATE rate_limits SET count = count + 1 WHERE bucket = $bucket AND key = $key',
    { bucket, key: id });
}

/* Успешное действие снимает счётчик: подобравшему пароль это не поможет,
   а человеку, вспомнившему свой, не помешает войти второй раз. */
export function clear(bucket, key) {
  run('DELETE FROM rate_limits WHERE bucket = $bucket AND key = $key',
    { bucket, key: String(key ?? 'unknown') });
}

/* Уборка истёкших окон. Вызывается при входе — отдельного планировщика
   ради этого заводить незачем. */
export function purge() {
  const oldest = Math.max(LIMITS.login.windowMin, LIMITS.signup.windowMin);
  return run('DELETE FROM rate_limits WHERE first_at < $edge', { edge: windowStart(oldest) }).changes;
}
