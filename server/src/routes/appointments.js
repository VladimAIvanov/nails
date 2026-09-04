/* Записи: создание, свои записи, детали, перенос, отмена.

   Обработчики здесь только разбирают вход и решают, какие поля вообще
   принимаются от этой роли. Сохранение в базу — в services/appointments.js,
   одной функцией на все три роли. */
import { all, get } from '../db.js';
import { forbidden, notFound, badRequest } from '../http.js';
import * as v from '../validate.js';
import { requireUser, requireRole, isAdmin, actsAsClient, currentUser } from '../auth.js';
import { guestActor } from '../services/guest-booking.js';
import { check as checkRate, hit as hitRate } from '../ratelimit.js';
import { clientIp } from '../net.js';
import { getSettings } from '../slots.js';
import { nowIso, utcToLocal } from '../time.js';
import {
  createAppointment, rescheduleAppointment, cancelAppointment, confirmAppointment
} from '../services/appointments.js';

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
    // наложение — служебный признак студии, клиентке он ничего не говорит
    view.allow_overlap = row.allow_overlap === 1;
  }
  return view;
}

export const SELECT_APPOINTMENT = `
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

export const presentAppointment = present;

export default function register(router) {
  /* Создание записи клиентом — вошедшим или не заводившим кабинет.
     Поля master_id, service_ids, starts_at, comment, hold_token — и всё.
     client_id не принимается: клиент записывает только себя. allow_overlap
     не читается вовсе, поэтому передать его невозможно.

     Гость добавляет к этому имя, телефон и согласие на обработку данных.
     Сеанса ему не выдаётся: записался — остался гостем. Выдать пропуск
     по одному номеру телефона значило бы пускать в чужой кабинет всякого,
     кто этот номер знает.

     Ограничение частоты у гостя своё, по адресу: у вошедшей клиентки за
     спиной пароль, а здесь форму может заполнять кто угодно и сколько
     угодно раз. */
  router.post('/api/appointments', async ({ body, req }) => {
    const settings = getSettings();
    const signedIn = currentUser(req);
    const ip = clientIp(req);

    let actor;
    if (signedIn) {
      actor = requireRole(req, 'client');
    } else {
      checkRate('signup', `guest-booking:${ip}`);
      actor = guestActor(body).actor;
      hitRate('signup', `guest-booking:${ip}`);
    }

    const result = createAppointment({
      actor,
      input: {
        masterId: v.idParam(body.master_id, 'master_id'),
        serviceIds: v.idList(body.service_ids, 'service_ids'),
        startsAt: v.isoUtc(body.starts_at),
        comment: v.optionalStr(body.comment, 'comment', { max: 1000 }),
        holdToken: body.hold_token ? v.str(body.hold_token, 'hold_token', { max: 64 }) : null
      }
    });

    const rows = result.ids.map((id) => get(`${SELECT_APPOINTMENT} WHERE a.id = $id`, { id }));
    return {
      status: 201,
      body: {
        appointments: rows.map((r) => present(r, settings.timezone)),
        /* Гостю карточку визита показывает сам этот ответ: перезапросить
           её по номеру он не сможет — чужие записи сервер не отдаёт,
           а своим он никого не считает. */
        guest: !signedIn
      }
    };
  });

  /* Создание записи мастером — вручную из своего расписания.
     master_id не принимается: мастер оформляет визит только к себе. */
  router.post('/api/master/appointments', async ({ body, req }) => {
    const actor = requireRole(req, 'master');
    const settings = getSettings();

    const result = createAppointment({
      actor,
      input: {
        clientId: v.idParam(body.client_id, 'client_id'),
        serviceIds: v.idList(body.service_ids, 'service_ids'),
        startsAt: v.isoUtc(body.starts_at),
        comment: v.optionalStr(body.comment, 'comment', { max: 1000 })
      }
    });

    const rows = result.ids.map((id) => get(`${SELECT_APPOINTMENT} WHERE a.id = $id`, { id }));
    return {
      status: 201,
      body: { appointments: rows.map((r) => present(r, settings.timezone, { withClient: true })) }
    };
  });

  /* Подтверждение записи мастером — та же функция, что и в панели. */
  router.post('/api/master/appointments/:id/confirm', async ({ params, req }) => {
    const actor = requireRole(req, 'master');
    return { body: confirmAppointment({ actor, id: v.idParam(params.id) }) };
  });

  /* Записи мастера на день — экран «Моё расписание». */
  router.get('/api/master/appointments', async ({ req, query }) => {
    const actor = requireRole(req, 'master');
    const settings = getSettings();
    const date = query.get('date') ? v.date(query.get('date')) : null;

    const rows = all(
      `${SELECT_APPOINTMENT}
        WHERE a.master_id = $master
          AND ($date IS NULL OR substr(a.starts_at, 1, 10) = $date)
        ORDER BY a.starts_at`,
      { master: actor.id, date }
    );

    return {
      body: { appointments: rows.map((r) => present(r, settings.timezone, { withClient: true })) }
    };
  });

  /* Свои записи: ближайшие и история, как на экране «Мои записи». */
  router.get('/api/appointments/my', async ({ req, query }) => {
    const actor = requireRole(req, 'client');
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
      { client: actor.id, scope, now: nowIso() }
    );

    const items = rows.map((r) => present(r, settings.timezone));
    const isUpcoming = (i) => ['pending', 'confirmed'].includes(i.status) && i.starts_at >= nowIso();
    return {
      body: {
        upcoming: items.filter(isUpcoming),
        past: items.filter((i) => !isUpcoming(i)),
        address: settings.address_line
      }
    };
  });

  /* Детали записи. Клиентка видит свою, мастер — свою, администратор — любую. */
  router.get('/api/appointments/:id', async ({ params, req }) => {
    const actor = requireUser(req);
    const id = v.idParam(params.id);
    const settings = getSettings();

    const row = get(`${SELECT_APPOINTMENT} WHERE a.id = $id`, { id });
    if (!row) throw notFound('Запись не найдена');

    const isOwner = row.client_id === actor.id;
    const isTheirMaster = row.master_id === actor.id;
    const admin = isAdmin(actor);
    if (!isOwner && !isTheirMaster && !admin) throw forbidden('Это чужая запись');

    const view = present(row, settings.timezone, { withClient: isTheirMaster || admin });
    if (isTheirMaster || admin) {
      view.history = all(
        `SELECT from_status, to_status, comment, changed_at
           FROM appointment_status_log WHERE appointment_id = $id ORDER BY id`,
        { id }
      );
      view.master_note = row.master_note;
    }
    return { body: view };
  });

  /* Перенос. Права проверяются внутри общей функции. */
  router.patch('/api/appointments/:id', async ({ params, body, req }) => {
    const actor = requireUser(req);
    const settings = getSettings();

    rescheduleAppointment({
      actor,
      id: v.idParam(params.id),
      startsAt: v.isoUtc(body.starts_at)
    });

    const updated = get(`${SELECT_APPOINTMENT} WHERE a.id = $id`, { id: v.idParam(params.id) });
    return {
      body: present(updated, settings.timezone, { withClient: !actsAsClient(actor) })
    };
  });

  /* Отмена. Права проверяются внутри общей функции. */
  router.post('/api/appointments/:id/cancel', async ({ params, body, req }) => {
    const actor = requireUser(req);
    const settings = getSettings();

    const result = cancelAppointment({
      actor,
      id: v.idParam(params.id),
      reason: v.optionalStr(body.reason, 'reason', { max: 500 })
    });

    return {
      body: { ...result, free_cancellation_lead_min: settings.free_cancellation_lead_min }
    };
  });
}


