/* Экспорт визитов в календарь: формат iCalendar (RFC 5545).

   Два способа. Разовый файл на одну запись — «добавить в календарь» кнопкой.
   Личная лента по ссылке — календарь сам перечитывает её и подхватывает
   новые визиты, переносы и отмены без участия человека. */
import { randomBytes } from 'node:crypto';
import { all, get, run } from '../db.js';
import { notFound } from '../http.js';
import { getSettings } from '../slots.js';
import { nowIso } from '../time.js';

/* Формат календаря: 20260824T100000Z. */
const stamp = (iso) => iso.replace(/[-:]/g, '');

/* Экранирование по RFC 5545: запятая, точка с запятой и обратный слэш
   в тексте значат разделители, перевод строки записывается как \n. */
function esc(text) {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/* Строки длиннее 75 октетов положено переносить. Продолжение начинается
   с пробела. Календари обычно прощают нарушение, но не все. */
function fold(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;

  const parts = [];
  let current = '';
  for (const char of line) {
    const candidate = current + char;
    if (Buffer.byteLength(candidate, 'utf8') > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }
  parts.push(current);
  return parts[0] + parts.slice(1).map((p) => `\r\n ${p}`).join('');
}

function event(appt, settings) {
  const address = `${settings.city}, ${settings.address_line}`;
  const cancelled = ['cancelled', 'no_show'].includes(appt.status);

  const lines = [
    'BEGIN:VEVENT',
    `UID:appointment-${appt.id}@varvara.studio`,
    `DTSTAMP:${stamp(nowIso())}`,
    `DTSTART:${stamp(appt.starts_at)}`,
    `DTEND:${stamp(appt.ends_at)}`,
    `SUMMARY:${esc(`${appt.service_title} — ${appt.master_name}`)}`,
    `LOCATION:${esc(address)}`,
    `DESCRIPTION:${esc(
      `Студия «${settings.title}». Мастер: ${appt.master_name}. ` +
      `Стоимость: ${(appt.price_kopecks / 100).toLocaleString('ru-RU')} ₽. ` +
      `Отмена по ссылке: ${settings.public_base_url}/api/appointments/cancel/${appt.cancel_token}`
    )}`,
    `STATUS:${cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    /* Напоминание средствами самого календаря — независимо от того,
       дошло ли наше сообщение в мессенджер. */
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc('Визит через два часа')}`,
    'END:VALARM',
    'END:VEVENT'
  ];
  return lines.map(fold);
}

const SELECT = `
  SELECT a.id, a.starts_at, a.ends_at, a.price_kopecks, a.status, a.cancel_token,
         s.title AS service_title, u.full_name AS master_name, a.client_id
    FROM appointments a
    JOIN services s ON s.id = a.service_id
    JOIN users u ON u.id = a.master_id
`;

export function appointmentIcs(appointmentId) {
  const settings = getSettings();
  const appt = get(`${SELECT} WHERE a.id = $id`, { id: appointmentId });
  if (!appt) throw notFound('Запись не найдена');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Varvara Studio//Booking//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...event(appt, settings),
    'END:VCALENDAR'
  ].join('\r\n') + '\r\n';
}

/* Личная лента. Отдаёт визиты за последний месяц и все будущие: старое
   календарю не нужно, а месяц назад полезен, чтобы история не пропала. */
export function feedIcs(token) {
  const settings = getSettings();
  const feed = get(
    'SELECT * FROM calendar_feeds WHERE token = $token AND revoked_at IS NULL', { token }
  );
  if (!feed) throw notFound('Лента не найдена или отозвана');

  run('UPDATE calendar_feeds SET last_read_at = $now WHERE id = $id',
    { now: nowIso(), id: feed.id });

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const rows = all(`${SELECT} WHERE a.client_id = $client AND a.starts_at >= $since ORDER BY a.starts_at`,
    { client: feed.user_id, since });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Varvara Studio//Booking//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(`Записи — ${settings.title}`)}`,
    'X-PUBLISHED-TTL:PT1H',
    ...rows.flatMap((appt) => event(appt, settings)),
    'END:VCALENDAR'
  ].join('\r\n') + '\r\n';
}

export function issueFeed(userId) {
  const existing = get(
    'SELECT token FROM calendar_feeds WHERE user_id = $id AND revoked_at IS NULL', { id: userId }
  );
  if (existing) return existing.token;

  const token = randomBytes(24).toString('base64url');
  run('INSERT INTO calendar_feeds (user_id, token) VALUES ($id, $token)', { id: userId, token });
  return token;
}

export function revokeFeed(userId) {
  return run(
    'UPDATE calendar_feeds SET revoked_at = $now WHERE user_id = $id AND revoked_at IS NULL',
    { now: nowIso(), id: userId }
  ).changes;
}
