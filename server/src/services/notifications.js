/* Постановка уведомлений в очередь.

   Отправкой занимается отдельный отправитель — здесь только решение, кому,
   когда и по каким каналам написать. Так канал можно добавить, не трогая
   логику записи, а неотправленное сообщение видно в таблице. */
import { all, get, run } from '../db.js';
import { getSettings } from '../slots.js';
import { nowIso, addMinutes } from '../time.js';

/* Каналы, доступные человеку: пересечение того, что он включил в настройках,
   и того, чем до него вообще можно достучаться. */
export function channelsFor(userId) {
  const user = get('SELECT telegram_user_id, email, phone FROM users WHERE id = $id', { id: userId });
  if (!user) return [];

  /* Строки настроек может не быть: её заводит регистрация, а клиентка могла
     появиться при гостевой записи или из тестовых данных. Отсутствие настроек
     означает «по умолчанию», а не «связи нет» — иначе человек молча остаётся
     без единственного напоминания о визите. */
  const prefs = get('SELECT * FROM notification_prefs WHERE user_id = $id', { id: userId })
    ?? { telegram_reminders: 1, push_reminders: 1, email_reminders: 0, sms_reminders: 0 };

  const hasPush = get(
    'SELECT COUNT(*) AS n FROM push_devices WHERE user_id = $id AND is_active = 1', { id: userId }
  ).n > 0;

  const channels = [];
  if (prefs.telegram_reminders === 1 && user.telegram_user_id) channels.push('telegram');
  if (prefs.push_reminders === 1 && hasPush) channels.push('push');
  if (prefs.email_reminders === 1 && user.email) channels.push('email');
  if (prefs.sms_reminders === 1 && user.phone) channels.push('sms');

  /* Если человек отключил всё, а сообщение важное, остаётся телефон:
     напоминание о визите — не рассылка, от него не отписываются. */
  return channels.length > 0 ? channels : ['sms'];
}

function enqueue({ userId, appointmentId = null, kind, channel, scheduledAt }) {
  /* Ограничение notifications_once не даёт поставить два одинаковых
     сообщения на одну запись — повторный вызов просто ничего не сделает. */
  try {
    run(
      `INSERT INTO notifications (user_id, appointment_id, kind, channel, scheduled_at)
       VALUES ($user, $appt, $kind, $channel, $at)`,
      { user: userId, appt: appointmentId, kind, channel, at: scheduledAt }
    );
    return true;
  } catch (err) {
    if (/UNIQUE/i.test(err.message)) return false;
    throw err;
  }
}

/* Уведомления по созданной записи: подтверждение сразу, напоминания —
   за сутки и за два часа до визита. */
export function scheduleForAppointment(appointmentId) {
  const settings = getSettings();
  const appt = get(
    'SELECT id, client_id, starts_at, status FROM appointments WHERE id = $id', { id: appointmentId }
  );
  if (!appt) return { scheduled: 0 };

  const channels = channelsFor(appt.client_id);
  let scheduled = 0;

  const kind = appt.status === 'pending' ? 'booking_created' : 'booking_confirmed';
  for (const channel of channels) {
    if (enqueue({ userId: appt.client_id, appointmentId, kind, channel, scheduledAt: nowIso() })) scheduled++;
  }

  const remindAt = addMinutes(appt.starts_at, -settings.reminder_lead_min);
  if (remindAt > nowIso()) {
    for (const channel of channels) {
      if (enqueue({ userId: appt.client_id, appointmentId, kind: 'reminder', channel, scheduledAt: remindAt })) {
        scheduled++;
      }
    }
  }

  /* Напоминание за сутки ставится только там, где оно не дублирует
     напоминание за два часа: у записи на сегодня суточного быть не может. */
  if (settings.reminder_day_before === 1 && channels.length > 0) {
    const dayBefore = addMinutes(appt.starts_at, -24 * 60);
    if (dayBefore > nowIso() && dayBefore < remindAt) {
      enqueue({
        userId: appt.client_id, appointmentId, kind: 'reminder',
        channel: channels[0], scheduledAt: dayBefore
      });
    }
  }

  // Владелице — сообщение о новой записи, если она этого просила
  if (settings.notify_owner_on_new_booking === 1 && settings.owner_user_id) {
    if (enqueue({
      userId: settings.owner_user_id, appointmentId, kind: 'booking_created',
      channel: 'telegram', scheduledAt: nowIso()
    })) scheduled++;
  }

  return { scheduled, channels };
}

/* Отмена: напоминания снимаются, иначе клиентке придёт напоминание
   о визите, которого не будет. */
export function cancelScheduled(appointmentId) {
  const changed = run(
    `UPDATE notifications SET status = 'cancelled'
      WHERE appointment_id = $id AND status = 'scheduled'`,
    { id: appointmentId }
  ).changes;

  const appt = get('SELECT client_id FROM appointments WHERE id = $id', { id: appointmentId });
  if (appt) {
    for (const channel of channelsFor(appt.client_id)) {
      enqueue({
        userId: appt.client_id, appointmentId, kind: 'cancelled', channel, scheduledAt: nowIso()
      });
    }
  }
  return { cancelled: changed };
}

/* Перенос: старые напоминания снимаются и ставятся заново от нового времени. */
export function rescheduleNotifications(appointmentId) {
  run(
    `UPDATE notifications SET status = 'cancelled'
      WHERE appointment_id = $id AND kind = 'reminder' AND status = 'scheduled'`,
    { id: appointmentId }
  );
  run(
    `DELETE FROM notifications WHERE appointment_id = $id AND kind = 'reminder' AND status = 'cancelled'`,
    { id: appointmentId }
  );
  return scheduleForAppointment(appointmentId);
}

/* Что отправитель должен разослать прямо сейчас. */
export function due(limit = 50) {
  return all(
    `SELECT n.*, u.full_name, u.phone, u.email, u.telegram_user_id
       FROM notifications n JOIN users u ON u.id = n.user_id
      WHERE n.status = 'scheduled' AND n.scheduled_at <= $now
      ORDER BY n.scheduled_at LIMIT $limit`,
    { now: nowIso(), limit }
  );
}

export function markSent(id, error = null) {
  run(
    `UPDATE notifications SET status = $status, sent_at = $now, error = $error WHERE id = $id`,
    { status: error ? 'failed' : 'sent', now: nowIso(), error, id }
  );
}
