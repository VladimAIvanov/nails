/* Уведомления, регулярные записи, календарь и отмена по ссылке. */
import { all, get, run } from '../db.js';
import { badRequest, notFound } from '../http.js';
import * as v from '../validate.js';
import { requireUser, requireRole } from '../auth.js';
import { getSettings } from '../slots.js';
import { nowIso, utcToLocal } from '../time.js';
import { cancelByToken } from '../services/appointments.js';
import { channelsFor, due, markSent } from '../services/notifications.js';
import { createSeries, listSeries, stopSeries, materialize } from '../services/recurring.js';
import { appointmentIcs, feedIcs, issueFeed, revokeFeed } from '../services/calendar.js';

export default function register(router) {
  // ── Уведомления ───────────────────────────────────────────────────────────

  router.get('/api/notifications/prefs', async ({ req }) => {
    const actor = requireUser(req);
    const prefs = get('SELECT * FROM notification_prefs WHERE user_id = $id', { id: actor.id })
      ?? { telegram_reminders: 1, push_reminders: 1, email_reminders: 0, sms_reminders: 0, marketing: 0 };

    return {
      body: {
        telegram: prefs.telegram_reminders === 1,
        push: prefs.push_reminders === 1,
        email: prefs.email_reminders === 1,
        sms: prefs.sms_reminders === 1,
        marketing: prefs.marketing === 1,
        active_channels: channelsFor(actor.id)
      }
    };
  });

  router.patch('/api/notifications/prefs', async ({ body, req }) => {
    const actor = requireUser(req);
    const fields = {
      telegram_reminders: v.bool(body.telegram, 'telegram'),
      push_reminders: v.bool(body.push, 'push'),
      email_reminders: v.bool(body.email, 'email'),
      sms_reminders: v.bool(body.sms, 'sms'),
      marketing: v.bool(body.marketing, 'marketing')
    };

    run(`INSERT INTO notification_prefs (user_id) VALUES ($id)
         ON CONFLICT (user_id) DO NOTHING`, { id: actor.id });

    for (const [column, value] of Object.entries(fields)) {
      if (value === null) continue;
      run(`UPDATE notification_prefs SET ${column} = $v, updated_at = $now WHERE user_id = $id`,
        { v: value, now: nowIso(), id: actor.id });
    }

    return { body: { ok: true, active_channels: channelsFor(actor.id) } };
  });

  /* Регистрация устройства для пуш-уведомлений. Токен приходит от
     мобильного приложения или браузера и хранится как есть: заменить его
     хешем нельзя, он нужен целиком для отправки. */
  router.post('/api/notifications/devices', async ({ body, req }) => {
    const actor = requireUser(req);
    const token = v.str(body.token, 'token', { min: 10, max: 512 });
    const platform = v.oneOf(body.platform, 'platform', ['ios', 'android', 'web']);
    const name = v.optionalStr(body.device_name, 'device_name', { max: 100 });

    run(
      `INSERT INTO push_devices (user_id, token, platform, device_name, last_seen_at)
       VALUES ($user, $token, $platform, $name, $now)
       ON CONFLICT (token) DO UPDATE SET
         user_id = excluded.user_id, is_active = 1, last_seen_at = excluded.last_seen_at`,
      { user: actor.id, token, platform, name, now: nowIso() }
    );

    return { status: 201, body: { ok: true, active_channels: channelsFor(actor.id) } };
  });

  router.delete('/api/notifications/devices/:token', async ({ params, req }) => {
    const actor = requireUser(req);
    const changes = run(
      'UPDATE push_devices SET is_active = 0 WHERE token = $token AND user_id = $user',
      { token: params.token, user: actor.id }
    ).changes;
    if (changes === 0) throw notFound('Устройство не найдено');
    return { body: { ok: true } };
  });

  /* Очередь на отправку — для отправителя сообщений. Доступна администратору:
     это служебные данные, включая контакты клиентов. */
  router.get('/api/admin/notifications/due', async ({ req, query }) => {
    requireRole(req, 'admin');
    const limit = query.get('limit') ? v.int(query.get('limit'), 'limit', { min: 1, max: 200 }) : 50;
    return { body: { notifications: due(limit) } };
  });

  router.post('/api/admin/notifications/:id/sent', async ({ params, body, req }) => {
    requireRole(req, 'admin');
    const id = v.idParam(params.id);
    if (!get('SELECT id FROM notifications WHERE id = $id', { id })) throw notFound('Сообщение не найдено');
    markSent(id, v.optionalStr(body.error, 'error', { max: 500 }));
    return { body: { ok: true } };
  });

  // ── Регулярные записи ─────────────────────────────────────────────────────

  router.post('/api/recurring', async ({ body, req }) => {
    const actor = requireUser(req);

    const input = {
      clientId: body.client_id ? v.idParam(body.client_id, 'client_id') : null,
      masterId: body.master_id ? v.idParam(body.master_id, 'master_id') : null,
      serviceId: v.idParam(body.service_id, 'service_id'),
      intervalWeeks: v.int(body.interval_weeks, 'interval_weeks', { min: 1, max: 12 }),
      weekday: v.int(body.weekday, 'weekday', { min: 1, max: 7 }),
      timeLocal: v.str(body.time_local, 'time_local', { max: 5 }),
      startsOn: v.date(body.starts_on, 'starts_on'),
      endsOn: body.ends_on ? v.date(body.ends_on, 'ends_on') : null,
      occurrences: body.occurrences ? v.int(body.occurrences, 'occurrences', { min: 1, max: 52 }) : null,
      generateAhead: body.generate_ahead ? v.int(body.generate_ahead, 'generate_ahead', { min: 1, max: 12 }) : 3
    };

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.timeLocal)) {
      throw badRequest('Поле «time_local»: время в формате ЧЧ:ММ по часам студии');
    }
    if (!input.endsOn && !input.occurrences) {
      throw badRequest('Укажите ends_on или occurrences: у серии должен быть конец');
    }

    const result = createSeries({ actor, input });
    return {
      status: 201,
      body: {
        series: {
          id: result.series.id,
          interval_weeks: result.series.interval_weeks,
          weekday: result.series.weekday,
          time_local: result.series.time_local,
          starts_on: result.series.starts_on,
          ends_on: result.series.ends_on,
          occurrences: result.series.occurrences
        },
        created: result.created,
        skipped: result.skipped
      }
    };
  });

  router.get('/api/recurring', async ({ req, query }) => {
    const actor = requireUser(req);
    const clientId = query.get('client_id') ? v.idParam(query.get('client_id'), 'client_id') : null;
    if (clientId && actor.role === 'client') throw badRequest('Чужие серии недоступны');
    return { body: { series: listSeries({ actor, clientId }) } };
  });

  /* Досоздание следующих повторов. Обычно вызывается по расписанию,
     но доступно и вручную — например, после освобождения времени. */
  router.post('/api/recurring/:id/extend', async ({ params, req }) => {
    const actor = requireUser(req);
    const id = v.idParam(params.id);
    const series = get('SELECT * FROM recurring_series WHERE id = $id', { id });
    if (!series) throw notFound('Серия не найдена');
    if (actor.role === 'client' && series.client_id !== actor.id) throw badRequest('Это чужая серия');
    return { body: materialize({ actor, series }) };
  });

  router.delete('/api/recurring/:id', async ({ params, query, req }) => {
    const actor = requireUser(req);
    return {
      body: stopSeries({
        actor,
        id: v.idParam(params.id),
        cancelUpcoming: query.get('cancel_upcoming') === 'true'
      })
    };
  });

  // ── Календарь ─────────────────────────────────────────────────────────────

  /* Файл на одну запись — кнопка «Добавить в календарь». */
  router.get('/api/appointments/:id/calendar.ics', async ({ params, req }) => {
    const actor = requireUser(req);
    const id = v.idParam(params.id);
    const appt = get('SELECT client_id, master_id FROM appointments WHERE id = $id', { id });
    if (!appt) throw notFound('Запись не найдена');
    if (appt.client_id !== actor.id && appt.master_id !== actor.id && actor.role !== 'admin') {
      throw notFound('Запись не найдена');
    }

    return {
      raw: {
        contentType: 'text/calendar; charset=utf-8',
        body: appointmentIcs(id),
        headers: { 'content-disposition': `attachment; filename="visit-${id}.ics"` }
      }
    };
  });

  /* Личная лента. Открывается по токену без входа — так устроены все
     календарные подписки: приложение календаря не умеет логиниться. */
  /* Адрес заканчивается на .ics: часть календарей узнаёт формат по расширению,
     а не по заголовку. В шаблоне маршрута расширение не пишется — иначе оно
     стало бы частью имени параметра, — поэтому суффикс снимается здесь. */
  router.get('/api/calendar/:token', async ({ params }) => ({
    raw: {
      contentType: 'text/calendar; charset=utf-8',
      body: feedIcs(params.token.replace(/\.ics$/, ''))
    }
  }));

  router.post('/api/calendar/subscribe', async ({ req }) => {
    const actor = requireUser(req);
    const settings = getSettings();
    const token = issueFeed(actor.id);
    return {
      status: 201,
      body: {
        url: `${settings.public_base_url}/api/calendar/${token}.ics`,
        hint: 'Добавьте ссылку в календарь как подписку — визиты будут появляться сами'
      }
    };
  });

  router.delete('/api/calendar/subscribe', async ({ req }) => {
    const actor = requireUser(req);
    const changes = revokeFeed(actor.id);
    if (changes === 0) throw notFound('Подписка не найдена');
    return { body: { ok: true } };
  });

  // ── Отмена по ссылке ──────────────────────────────────────────────────────

  /* Показать, что именно отменяется, до подтверждения. Ссылка из письма
     ведёт сюда, а отменяет уже POST — чтобы предпросмотр почты или антивирус,
     открывающий ссылки, не отменил визит за клиентку. */
  router.get('/api/appointments/cancel/:token', async ({ params }) => {
    const settings = getSettings();
    const row = get(
      `SELECT a.id, a.starts_at, a.status, s.title AS service, u.full_name AS master
         FROM appointments a
         JOIN services s ON s.id = a.service_id
         JOIN users u ON u.id = a.master_id
        WHERE a.cancel_token = $token`,
      { token: params.token }
    );
    if (!row) throw notFound('Ссылка недействительна');

    return {
      body: {
        appointment: {
          id: row.id,
          service: row.service,
          master: row.master,
          starts_at: row.starts_at,
          local: utcToLocal(new Date(row.starts_at), settings.timezone),
          status: row.status,
          can_cancel: ['pending', 'confirmed'].includes(row.status)
        },
        free_cancellation_lead_min: settings.free_cancellation_lead_min
      }
    };
  });

  router.post('/api/appointments/cancel/:token', async ({ params, body }) => ({
    body: cancelByToken({
      token: params.token,
      reason: v.optionalStr(body.reason, 'reason', { max: 500 })
    })
  }));
}
