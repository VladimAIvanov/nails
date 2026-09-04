/* Уведомления в кабинете: одно место, где они создаются.

   Правило одно и оно же — единственная причина, по которой этот файл
   существует отдельно: уведомление создаётся, только если событие произошло
   не по воле самого человека. Клиентка записалась, отменила или перенесла
   визит сама — она уже видела результат на экране, сообщать ей нечего.
   Отменила или перенесла студия — сообщать обязательно.

   Проверка «не сам» живёт здесь, в notifyClient, а не в трёх местах вызова:
   иначе четвёртый вызов однажды забудут. */
import { all, get, run } from '../db.js';
import { nowIso } from '../time.js';

/* «четверг, 4 сентября, 14:00» — по часовому поясу студии, а не по UTC
   и не по поясу сервера. Общая фраза «ваша запись изменена» не годится:
   человек должен понять, что именно поменялось, не открывая кабинет. */
export function whenText(iso, timezone) {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: timezone, weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date(iso));

  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.weekday}, ${p.day} ${p.month}, ${p.hour}:${p.minute}`;
}

/**
 * Кладёт сообщение в кабинет клиентки.
 * Ничего не делает, когда событие вызвал сам получатель.
 */
export function notifyClient({ actorId, clientId, kind, text, appointmentId = null }) {
  if (actorId === clientId) return false;

  run(
    `INSERT INTO inbox (user_id, kind, text, appointment_id, created_at)
     VALUES ($user, $kind, $text, $appointment, $now)`,
    { user: clientId, kind, text, appointment: appointmentId, now: nowIso() }
  );
  return true;
}

/** Список сообщений и число непрочитанных — одним запросом, а не двумя. */
export function inboxFor(userId, { limit = 50 } = {}) {
  const rows = all(
    `SELECT i.id, i.kind, i.text, i.appointment_id, i.read_at, i.created_at,
            a.public_number, a.starts_at, a.status AS appointment_status
       FROM inbox i
       LEFT JOIN appointments a ON a.id = i.appointment_id
      WHERE i.user_id = $user
      ORDER BY i.created_at DESC, i.id DESC
      LIMIT $limit`,
    { user: userId, limit }
  );

  const { unread } = get(
    'SELECT COUNT(*) AS unread FROM inbox WHERE user_id = $user AND read_at IS NULL',
    { user: userId }
  );

  return {
    unread,
    notifications: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      text: r.text,
      created_at: r.created_at,
      is_read: r.read_at !== null,
      appointment: r.appointment_id
        ? {
          id: r.appointment_id,
          number: r.public_number,
          starts_at: r.starts_at,
          status: r.appointment_status
        }
        : null
    }))
  };
}

/* Отметка о прочтении ставится один раз: повторный вызов не переписывает
   время, иначе «прочитано вчера» превращалось бы в «прочитано только что». */
export function markRead(userId, id) {
  const row = get('SELECT id FROM inbox WHERE id = $id AND user_id = $user', { id, user: userId });
  if (!row) return false;
  run('UPDATE inbox SET read_at = $now WHERE id = $id AND read_at IS NULL', { now: nowIso(), id });
  return true;
}

export function markAllRead(userId) {
  run('UPDATE inbox SET read_at = $now WHERE user_id = $user AND read_at IS NULL',
    { now: nowIso(), user: userId });
  return get('SELECT COUNT(*) AS unread FROM inbox WHERE user_id = $user AND read_at IS NULL',
    { user: userId }).unread;
}
