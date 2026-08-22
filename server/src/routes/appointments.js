/* Записи: создание, свои записи, детали, перенос, отмена. */
import { all, get, run, transaction } from '../db.js';
import { conflict, forbidden, notFound, badRequest } from '../http.js';
import * as v from '../validate.js';
import { requireUser, requireRole } from '../auth.js';
import { getSettings, requiredDuration, purgeExpiredHolds } from '../slots.js';
import { nowIso, addMinutes, utcToLocal } from '../time.js';

/* Что видно в карточке записи. Телефон клиентки показывается только студии:
   клиентке он и так известен, а чужих персональных данных в ответе быть не должно. */
function present(row, tz, { withClient = false } = {}) {
  const view = {
    id: row.id,
    number: row.public_number,
    status: row.status,
    status_title: row.status_title,
    status_color: row.color_token,
    source: row.source,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    local: utcToLocal(new Date(row.starts_at), tz),
    duration_min: row.duration_min,
    price_kopecks: row.price_kopecks,
    service: { id: row.service_id, title: row.service_title },
    master: { id: row.master_id, name: row.master_name },
    master_auto_assigned: row.master_auto_assigned === 1,
    client_comment: row.client_comment,
    created_at: row.created_at
  };
  if (withClient) {
    view.client = { id: row.client_id, name: row.client_name, phone: row.client_phone };
  }
  return view;
}

const SELECT_APPOINTMENT = `
  SELECT a.*, s.title AS service_title,
         mu.full_name AS master_name,
         cu.full_name AS client_name, cu.phone AS client_phone,
         l.title AS status_title, l.color_token
    FROM appointments a
    JOIN services s ON s.id = a.service_id
    JOIN users mu ON mu.id = a.master_id
    JOIN users cu ON cu.id = a.client_id
    JOIN appointment_status_labels l ON l.status = a.status
`;

export default function register(router) {
  /* Создание записи. Услуг может быть несколько: схема хранит одну услугу
     на запись (раздел 4.9), поэтому визит из нескольких услуг становится
     цепочкой записей подряд, созданной в одной транзакции. */
  router.post('/api/appointments', async ({ body, req }) => {
    const user = requireRole(req, 'client');
    const masterId = v.idParam(body.master_id, 'master_id');
    const serviceIds = v.idList(body.service_ids, 'service_ids');
    const startsAt = v.isoUtc(body.starts_at);
    const comment = v.optionalStr(body.comment, 'comment', { max: 1000 });
    const holdToken = body.hold_token ? v.str(body.hold_token, 'hold_token', { max: 64 }) : null;

    const settings = getSettings();
    if (settings.online_booking_enabled !== 1) throw conflict('Онлайн-запись отключена');

    const need = requiredDuration(masterId, serviceIds, settings);
    const endsAt = addMinutes(startsAt, need.total);

    if (Date.parse(startsAt) - Date.now() < settings.min_lead_time_min * 60_000) {
      throw conflict(`Записаться можно не позднее чем за ${settings.min_lead_time_min} мин`);
    }

    const status = settings.manual_confirmation_required === 1 ? 'pending' : 'confirmed';

    let created;
    try {
      created = transaction(() => {
        purgeExpiredHolds();

        /* Чужое удержание на это время блокирует запись — ради этого оно и есть.
           Своё удержание снимается и уступает место записи. */
        const overlapping = all(
          `SELECT token FROM slot_holds
            WHERE master_id = $master AND expires_at > $now
              AND starts_at < $ends AND ends_at > $starts`,
          { master: masterId, now: nowIso(), starts: startsAt, ends: endsAt }
        );
        const foreign = overlapping.filter((h) => h.token !== holdToken);
        if (foreign.length > 0) {
          throw conflict('Это время удерживает другой клиент, попробуйте другое окно');
        }
        if (holdToken) run('DELETE FROM slot_holds WHERE token = $t', { t: holdToken });

        const ids = [];
        let cursor = startsAt;
        for (const svc of need.services) {
          run(
            `INSERT INTO appointments (client_id, master_id, service_id, starts_at,
                                       duration_min, price_kopecks, status, source, client_comment)
             VALUES ($client, $master, $service, $starts, $duration, $price, $status, $source, $comment)`,
            {
              client: user.id, master: masterId, service: svc.id, starts: cursor,
              duration: svc.duration_min, price: svc.price_kopecks,
              status, source: 'site', comment
            }
          );
          const id = get('SELECT last_insert_rowid() AS id').id;
          run(
            `INSERT INTO appointment_status_log (appointment_id, from_status, to_status, changed_by_id, comment)
             VALUES ($id, NULL, $status, $by, 'запись создана')`,
            { id, status, by: user.id }
          );
          ids.push(id);
          cursor = addMinutes(cursor, svc.duration_min);
        }
        return ids;
      });
    } catch (err) {
      if (/appointments_no_overlap/.test(err.message)) {
        throw conflict('Это время только что заняли, выберите другое окно');
      }
      throw err;
    }

    const rows = created.map((id) => get(`${SELECT_APPOINTMENT} WHERE a.id = $id`, { id }));
    return {
      status: 201,
      body: { appointments: rows.map((r) => present(r, settings.timezone)) }
    };
  });

  /* Свои записи: ближайшие и история, как на экране «Мои записи». */
  router.get('/api/appointments/my', async ({ req, query }) => {
    const user = requireRole(req, 'client');
    const settings = getSettings();
    const scope = query.get('scope') ?? 'all';
    if (!['all', 'upcoming', 'past'].includes(scope)) {
      throw badRequest('Поле «scope»: допустимо all, upcoming, past');
    }

    const rows = all(
      `${SELECT_APPOINTMENT}
        WHERE a.client_id = $client
          AND ($scope = 'all'
               OR ($scope = 'upcoming' AND a.status IN ('pending','confirmed') AND a.starts_at >= $now)
               OR ($scope = 'past' AND (a.status IN ('done','cancelled','no_show') OR a.starts_at < $now)))
        ORDER BY a.starts_at DESC`,
      { client: user.id, scope, now: nowIso() }
    );

    const items = rows.map((r) => present(r, settings.timezone));
    return {
      body: {
        upcoming: items.filter((i) => ['pending', 'confirmed'].includes(i.status) && i.starts_at >= nowIso()),
        past: items.filter((i) => !(['pending', 'confirmed'].includes(i.status) && i.starts_at >= nowIso())),
        address: settings.address_line
      }
    };
  });

  /* Детали записи. Клиентка видит свою, мастер — свою, администратор — любую. */
  router.get('/api/appointments/:id', async ({ params, req }) => {
    const user = requireUser(req);
    const id = v.idParam(params.id);
    const settings = getSettings();

    const row = get(`${SELECT_APPOINTMENT} WHERE a.id = $id`, { id });
    if (!row) throw notFound('Запись не найдена');

    const isOwner = row.client_id === user.id;
    const isMaster = row.master_id === user.id;
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isMaster && !isAdmin) throw forbidden('Это чужая запись');

    const view = present(row, settings.timezone, { withClient: isMaster || isAdmin });
    if (isMaster || isAdmin) {
      view.history = all(
        `SELECT from_status, to_status, comment, changed_at
           FROM appointment_status_log WHERE appointment_id = $id ORDER BY id`,
        { id }
      );
      view.master_note = row.master_note;
    }
    return { body: view };
  });

  /* Перенос. Доступен владелице записи и администратору. */
  router.patch('/api/appointments/:id', async ({ params, body, req }) => {
    const user = requireUser(req);
    const id = v.idParam(params.id);
    const startsAt = v.isoUtc(body.starts_at);
    const settings = getSettings();

    const row = get('SELECT * FROM appointments WHERE id = $id', { id });
    if (!row) throw notFound('Запись не найдена');

    const isOwner = row.client_id === user.id;
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) throw forbidden('Переносить запись может владелец записи или администратор');

    if (!['pending', 'confirmed'].includes(row.status)) {
      throw conflict(`Запись в статусе «${row.status}» переносить нельзя`);
    }
    if (!isAdmin && Date.parse(startsAt) - Date.now() < settings.min_lead_time_min * 60_000) {
      throw conflict(`Перенести можно не позднее чем за ${settings.min_lead_time_min} мин`);
    }

    try {
      transaction(() => {
        run('UPDATE appointments SET starts_at = $starts, updated_at = $now WHERE id = $id',
          { starts: startsAt, now: nowIso(), id });
        run(
          `INSERT INTO appointment_status_log (appointment_id, from_status, to_status, changed_by_id, comment)
           VALUES ($id, $status, $status, $by, $comment)`,
          { id, status: row.status, by: user.id, comment: `перенос с ${row.starts_at} на ${startsAt}` }
        );
      });
    } catch (err) {
      if (/appointments_no_overlap/.test(err.message)) {
        throw conflict('На это время уже есть запись у мастера');
      }
      throw err;
    }

    const updated = get(`${SELECT_APPOINTMENT} WHERE a.id = $id`, { id });
    return { body: present(updated, settings.timezone, { withClient: isAdmin }) };
  });

  /* Отмена. Доступна владелице записи, её мастеру и администратору. */
  router.post('/api/appointments/:id/cancel', async ({ params, body, req }) => {
    const user = requireUser(req);
    const id = v.idParam(params.id);
    const reason = v.optionalStr(body.reason, 'reason', { max: 500 });
    const settings = getSettings();

    const row = get('SELECT * FROM appointments WHERE id = $id', { id });
    if (!row) throw notFound('Запись не найдена');

    const isOwner = row.client_id === user.id;
    const isMaster = row.master_id === user.id;
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isMaster && !isAdmin) throw forbidden('Это чужая запись');

    if (row.status === 'cancelled') throw conflict('Запись уже отменена');
    if (['done', 'no_show'].includes(row.status)) {
      throw conflict('Состоявшийся визит отменить нельзя');
    }

    /* Правило студии: отмена бесплатна за N часов. Позже отменить всё равно
       можно — иначе клиентка просто не придёт, а время останется занятым. */
    const lateMs = settings.free_cancellation_lead_min * 60_000;
    const isLate = Date.parse(row.starts_at) - Date.now() < lateMs;

    transaction(() => {
      run('UPDATE appointments SET status = $s, updated_at = $now WHERE id = $id',
        { s: 'cancelled', now: nowIso(), id });
      run(
        `INSERT INTO appointment_status_log (appointment_id, from_status, to_status, changed_by_id, comment)
         VALUES ($id, $from, 'cancelled', $by, $comment)`,
        { id, from: row.status, by: user.id, comment: reason ?? (isLate ? 'поздняя отмена' : 'отмена') }
      );
    });

    return {
      body: {
        id,
        status: 'cancelled',
        late_cancellation: isLate,
        free_cancellation_lead_min: settings.free_cancellation_lead_min
      }
    };
  });
}
