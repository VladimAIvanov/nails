/* Пароли и сеансы.

   В базе лежит только хеш пароля и только хеш токена сеанса — раздел 4.1
   и 4.17 схемы. Открытых значений не хранится нигде. */
import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { db, get, run } from './db.js';
import { nowIso, toIso } from './time.js';
import { unauthorized, forbidden } from './http.js';

const SESSION_TTL_DAYS = 30;

/* Соль генерируется на каждый вызов: одинаковый пароль даёт разные хеши.
   Вызывать нужно отдельно для каждой учётной записи — общий результат
   на всех сводит смысл соли к нулю. */
export function hashPassword(plain) {
  const salt = randomBytes(16);
  const key = scryptSync(plain, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export function verifyPassword(plain, stored) {
  if (!stored) return false;
  const [algo, saltB64, keyB64] = stored.split('$');
  if (algo !== 'scrypt' || !saltB64 || !keyB64) return false;

  const expected = Buffer.from(keyB64, 'base64');
  const actual = scryptSync(plain, Buffer.from(saltB64, 'base64'), expected.length);
  // сравнение за постоянное время: обычное == подсказывает подбирающему длину совпадения
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

export function createSession(userId, { userAgent = null, ip = null } = {}) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = toIso(new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000));

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
    `SELECT u.id, u.role, u.full_name, u.phone, u.email, u.is_active, s.id AS session_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $hash
        AND s.revoked_at IS NULL
        AND s.expires_at > $now
        AND (u.password_changed_at IS NULL OR s.issued_at >= u.password_changed_at)`,
    { hash: tokenHash(token), now: nowIso() }
  );

  if (!row || row.is_active !== 1) return null;
  return { id: row.id, role: row.role, fullName: row.full_name, phone: row.phone, email: row.email };
}

export function requireUser(req) {
  const user = currentUser(req);
  if (!user) throw unauthorized();
  return user;
}

export function requireRole(req, ...roles) {
  const user = requireUser(req);
  if (!roles.includes(user.role)) {
    throw forbidden(`Действие доступно только: ${roles.join(', ')}`);
  }
  return user;
}

/* Чистка просроченных сеансов. Вызывается при входе — отдельного
   планировщика ради этого заводить незачем. */
export function purgeExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(nowIso());
}
