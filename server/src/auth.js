/* Пароли и сеансы.

   В базе лежит только хеш пароля и только хеш токена сеанса — раздел 4.1
   и 4.17 схемы. Открытых значений не хранится нигде. */
import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { db, all, get, run } from './db.js';
import { nowIso, toIso } from './time.js';
import { unauthorized, forbidden, HttpError } from './http.js';

/* Срок жизни сеанса зависит от прав.

   У администратора и мастера в руках чужие персональные данные, деньги
   студии и настройки записи — украденный токен должен протухать за сутки.
   Клиентке месяц бессменного токена не нужен: семь дней с продлением при
   активности не заставляют её входить заново, но и не оставляют забытый
   в чужом браузере сеанс живым до следующего сезона. */
const days = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const SESSION_TTL_DAYS = {
  staff: days(process.env.SESSION_TTL_DAYS_STAFF, 1),
  client: days(process.env.SESSION_TTL_DAYS, 7)
};

/* Роли берутся из базы: и список user_roles, и основная роль в users.
   Ни то ни другое из запроса не приходит. */
function rolesOf(userId) {
  return all(
    `SELECT role FROM user_roles WHERE user_id = $id
     UNION SELECT role FROM users WHERE id = $id`,
    { id: userId }
  ).map((r) => r.role);
}

const ttlMsFor = (roles) =>
  (roles.includes('admin') || roles.includes('master')
    ? SESSION_TTL_DAYS.staff
    : SESSION_TTL_DAYS.client) * 86_400_000;

/* Параметры стойкости scrypt. Хранятся вместе с хешем, а не подразумеваются:
   иначе смена умолчаний в новой версии Node или наше собственное решение
   поднять стойкость разом сделают все существующие хеши непроверяемыми —
   войти не сможет никто, включая администратора. */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

/* Соль генерируется на каждый вызов: одинаковый пароль даёт разные хеши.
   Вызывать нужно отдельно для каждой учётной записи — общий результат
   на всех сводит смысл соли к нулю. */
export function hashPassword(plain) {
  const salt = randomBytes(16);
  const key = scryptSync(plain, salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$N=${SCRYPT.N},r=${SCRYPT.r},p=${SCRYPT.p}` +
    `$${salt.toString('base64')}$${key.toString('base64')}`;
}

export function verifyPassword(plain, stored) {
  if (!stored) return false;
  const parts = stored.split('$');

  /* Старый формат scrypt$соль$ключ — без параметров. Проверяем его на
     умолчаниях, чтобы не выбросить уже заведённые пароли; при следующей
     смене пароля хеш перезапишется новым форматом. */
  let params = SCRYPT;
  let saltB64;
  let keyB64;

  if (parts.length === 4) {
    const [algo, raw, salt, key] = parts;
    if (algo !== 'scrypt') return false;
    const parsed = Object.fromEntries(
      raw.split(',').map((kv) => kv.split('=')).map(([k, val]) => [k, Number(val)])
    );
    if (!parsed.N || !parsed.r || !parsed.p) return false;
    params = { ...parsed, keylen: SCRYPT.keylen };
    saltB64 = salt;
    keyB64 = key;
  } else if (parts.length === 3) {
    const [algo, salt, key] = parts;
    if (algo !== 'scrypt') return false;
    saltB64 = salt;
    keyB64 = key;
  } else {
    return false;
  }

  const expected = Buffer.from(keyB64, 'base64');
  let actual;
  try {
    actual = scryptSync(plain, Buffer.from(saltB64, 'base64'), expected.length,
      { N: params.N, r: params.r, p: params.p });
  } catch {
    return false;
  }
  // сравнение за постоянное время: обычное == подсказывает подбирающему длину совпадения
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

export function createSession(userId, { userAgent = null, ip = null } = {}) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = toIso(new Date(Date.now() + ttlMsFor(rolesOf(userId))));

  run(
    `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip)
     VALUES ($user, $hash, $expires, $ua, $ip)`,
    { user: userId, hash: tokenHash(token), expires: expiresAt, ua: userAgent, ip }
  );

  return { token, expiresAt };
}

export function revokeSession(token) {
  run('UPDATE sessions SET revoked_at = $now WHERE token_hash = $hash AND revoked_at IS NULL',
    { now: nowIso(), hash: tokenHash(token) });
}

/* Сеанс действителен, когда сходятся три условия: не отозван вручную,
   не истёк по сроку и открыт уже после последней смены пароля. */
export function currentUser(req) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return null;

  const row = get(
    `SELECT u.id, u.role, u.full_name, u.phone, u.email, u.is_active,
            s.id AS session_id, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $hash
        AND s.revoked_at IS NULL
        AND s.expires_at > $now
        AND (u.password_changed_at IS NULL OR s.issued_at >= u.password_changed_at)`,
    { hash: tokenHash(token), now: nowIso() }
  );

  if (!row || row.is_active !== 1) return null;

  /* Роли берутся из базы списком, а не из запроса и не из единственного поля.
     У одного человека их может быть несколько: владелица студии одновременно
     администратор и мастер. */
  const roles = all('SELECT role FROM user_roles WHERE user_id = $id', { id: row.id })
    .map((r) => r.role);
  if (!roles.includes(row.role)) roles.push(row.role);

  /* Продление при активности. Короткий срок не должен выбрасывать человека
     посреди работы, но и запись в базу на каждый запрос ни к чему: срок
     сдвигается, только когда истекла половина. */
  const ttlMs = ttlMsFor(roles);
  if (Date.parse(row.expires_at) - Date.now() < ttlMs / 2) {
    run('UPDATE sessions SET expires_at = $exp WHERE id = $id',
      { exp: toIso(new Date(Date.now() + ttlMs)), id: row.session_id });
  }

  return {
    id: row.id,
    role: row.role,          // основная роль: на неё опирается целостность данных
    roles,                   // полный список: по нему проверяются права
    fullName: row.full_name,
    phone: row.phone,
    email: row.email
  };
}

export function requireUser(req) {
  const user = currentUser(req);
  if (!user) throw unauthorized();
  return user;
}

/* Проверяется наличие нужной роли в списке, а не совпадение с единственным
   значением: иначе человек с двумя ролями теряет доступ по одной из них. */
export function requireRole(req, ...roles) {
  const user = requireUser(req);
  if (!user.roles.some((r) => roles.includes(r))) {
    throw forbidden(`Действие доступно только: ${roles.join(', ')}`);
  }
  return user;
}

/* Проверки для мест, где роль решает не доступ, а поведение.

   Сравнивать `user.role === 'master'` нельзя: у человека ролей может быть
   несколько, и владелица-мастер потеряла бы либо панель, либо расписание.
   Старшинство ролей: администратор сильнее мастера, мастер сильнее клиента. */
export function hasRole(user, ...roles) {
  return Boolean(user?.roles?.some((r) => roles.includes(r)));
}

export const isAdmin = (user) => hasRole(user, 'admin');
export const isMaster = (user) => hasRole(user, 'master');

/* «Только мастер» — ограничения своим расписанием применяются к нему,
   но не к администратору, который по совместительству мастер. */
export const isMasterOnly = (user) => isMaster(user) && !isAdmin(user);

/* «Действует как клиент» — нет ни административных, ни мастерских прав. */
export const actsAsClient = (user) => !isAdmin(user) && !isMaster(user);

/* Ограничение частоты вынесено в ratelimit.js: счётчики хранятся в базе
   и переживают перезапуск сервиса. */
export { check as checkRate, hit as hitRate, clear as clearRate } from './ratelimit.js';

/* Чистка просроченных сеансов. Вызывается при входе — отдельного
   планировщика ради этого заводить незачем. */
export function purgeExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(nowIso());
}



