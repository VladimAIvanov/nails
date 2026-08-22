/* Единственное место, где записи создаются, переносятся и отменяются.

   Клиент, мастер и администратор приходят сюда из разных обработчиков и с
   разными правами, но сохранение в базу происходит одинаково: одна проверка
   пересечений, одна транзакция, один журнал статусов, одна обработка отказа
   триггера. Второго пути вставки в API нет — если он появится, вместе с ним
   появится и возможность обойти права или транзакцию. */
import { randomBytes } from 'node:crypto';
import { all, get, run, transaction } from '../db.js';
import { conflict, forbidden, notFound } from '../http.js';
import { getSettings, requiredDuration, purgeExpiredHolds, nearestFreeSlots } from '../slots.js';
import { nowIso, addMinutes } from '../time.js';
import {
  scheduleForAppointment, cancelScheduled, rescheduleNotifications
} from './notifications.js';

/* Права на создание. Возвращает поля, разрешённые этой роли: остальные
   значения из запроса сюда просто не доходят. */
function resolveCreatePermissions(actor, input) {
  switch (actor.role) {
    case 'client':
      /* Клиент записывает только себя, только к указанному мастеру
         и никогда — поверх занятого времени. */
      return {
        clientId: actor.id,
        masterId: input.masterId,
        source: 'site',
        allowOverlap: 0,
        enforceLeadTime: true
      };

    case 'master':
      /* Мастер оформляет визит в своём расписании: клиента указывает,
         мастера — нет, им всегда является он сам. */
      return {
        clientId: input.clientId,
        masterId: actor.id,
        source: 'admin',
        allowOverlap: 0,
        enforceLeadTime: false
      };

    case 'admin':
      /* Администратор — единственный, кому доступно осознанное наложение. */
      return {
        clientId: input.clientId,
        masterId: input.masterId,
        source: 'admin',
        allowOverlap: input.allowOverlap ? 1 : 0,
        enforceLeadTime: false
      };

    default:
      throw forbidden('Создавать записи может клиент, мастер или администратор');
  }
}

/**
 * Создание записи. Визит из нескольких услуг становится цепочкой записей
 * подряд: схема хранит одну услугу на запись (раздел 4.9).
 */
export function createAppointment({ actor, input }) {
  const perms = resolveCreatePermissions(actor, input);
  const settings = getSettings();

  if (!perms.clientId) throw notFound('Не указан клиент');

  const client = get('SELECT id, is_active FROM users WHERE id = $id', { id: perms.clientId });
  if (!client) throw notFound('Клиент не найден');
  if (client.is_active !== 1) throw conflict('Учётная запись клиента отключена');

  const master = get(
    `SELECT mp.user_id, mp.accepts_online_booking, u.is_active
       FROM master_profiles mp JOIN users u ON u.id = mp.user_id WHERE mp.user_id = $id`,
    { id: perms.masterId }
  );
  if (!master) throw notFound('Мастер не найден');
  if (master.is_active !== 1) throw conflict('Мастер отключён');

  /* Онлайн-запись выключают, когда студия не хочет принимать заявки с сайта.
     На оформление из панели это не влияет: студия записывает вручную всегда. */
  if (actor.role === 'client') {
    if (settings.online_booking_enabled !== 1) throw conflict('Онлайн-запись сейчас отключена');
    if (master.accepts_online_booking !== 1) throw conflict('Мастер не принимает онлайн-запись');
  }

  const need = requiredDuration(perms.masterId, input.serviceIds, settings);
  const endsAt = addMinutes(input.startsAt, need.total);

  if (perms.enforceLeadTime
      && Date.parse(input.startsAt) - Date.now() < settings.min_lead_time_min * 60_000) {
    throw conflict(`Записаться можно не позднее чем за ${settings.min_lead_time_min} мин`);
  }

  const status = input.status
    ?? (settings.manual_confirmation_required === 1 && actor.role === 'client' ? 'pending' : 'confirmed');

  let ids;
  try {
    ids = transaction(() => {
      purgeExpiredHolds();

      /* Чужое удержание блокирует запись — ради этого оно и есть.
         Своё снимается и уступает место. Наложение администратора
         удержания игнорирует: он оформляет визит, который уже идёт. */
      if (perms.allowOverlap === 0) {
        const overlapping = all(
          `SELECT token FROM slot_holds
            WHERE master_id = $master AND expires_at > $now
              AND starts_at < $ends AND ends_at > $starts`,
          { master: perms.masterId, now: nowIso(), starts: input.startsAt, ends: endsAt }
        );
        const foreign = overlapping.filter((h) => h.token !== input.holdToken);
        if (foreign.length > 0) {
          throw conflict('Это время удерживает другой клиент, попробуйте другое окно');
        }
      }
      if (input.holdToken) run('DELETE FROM slot_holds WHERE token = $t', { t: input.holdToken });

      const created = [];
      let cursor = input.startsAt;
      for (const svc of need.services) {
        run(
          `INSERT INTO appointments (client_id, master_id, service_id, starts_at, duration_min,
                                     price_kopecks, status, source, client_comment, allow_overlap,
                                     cancel_token)
           VALUES ($client, $master, $service, $starts, $duration, $price, $status, $source,
                   $comment, $overlap, $token)`,
          {
            client: perms.clientId, master: perms.masterId, service: svc.id, starts: cursor,
            duration: svc.duration_min, price: svc.price_kopecks, status,
            source: perms.source, comment: input.comment ?? null, overlap: perms.allowOverlap,
            /* Токен отмены по ссылке. Свой у каждой записи и случайный:
               по номеру записи можно было бы перебором отменять чужие визиты. */
            token: randomBytes(18).toString('base64url')
          }
        );
        const id = get('SELECT last_insert_rowid() AS id').id;
        writeLog(id, null, status, actor.id, createNote(actor, perms));
        created.push(id);
        cursor = addMinutes(cursor, svc.duration_min);
      }
      return created;
    });
  } catch (err) {
    throw mapOverlapError(err, {
      masterId: perms.masterId, serviceIds: input.serviceIds, startsAt: input.startsAt,
      hint: actor.role === 'admin'
        ? 'Время занято. Чтобы записать поверх, передайте allow_overlap: true'
        : 'Это время только что заняли. Выберите другое окно'
    });
  }

  /* Уведомления ставятся после коммита: сообщение о записи, которая
     откатилась, — хуже, чем отсутствие сообщения. */
  const notifications = scheduleForAppointment(ids[0]);

  return {
    ids, allowOverlap: perms.allowOverlap === 1, status, services: need.services, notifications
  };
}

/** Перенос. Доступен владельцу записи и администратору. */
export function rescheduleAppointment({ actor, id, startsAt }) {
  const settings = getSettings();
  const row = get('SELECT * FROM appointments WHERE id = $id', { id });
  if (!row) throw notFound('Запись не найдена');

  const isOwner = row.client_id === actor.id;
  const isAdmin = actor.role === 'admin';
  if (!isOwner && !isAdmin) {
    throw forbidden('Переносить запись может владелец записи или администратор');
  }

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
      writeLog(id, row.status, row.status, actor.id, `перенос с ${row.starts_at} на ${startsAt}`);
    });
  } catch (err) {
    throw mapOverlapError(err, {
      masterId: row.master_id, serviceIds: [row.service_id], startsAt,
      hint: 'На это время у мастера уже есть запись'
    });
  }

  // напоминания пересобираются от нового времени
  rescheduleNotifications(id);

  return get('SELECT * FROM appointments WHERE id = $id', { id });
}

/** Отмена. Доступна владельцу записи, её мастеру и администратору. */
export function cancelAppointment({ actor, id, reason }) {
  const settings = getSettings();
  const row = get('SELECT * FROM appointments WHERE id = $id', { id });
  if (!row) throw notFound('Запись не найдена');

  const isOwner = row.client_id === actor.id;
  const isMaster = row.master_id === actor.id;
  const isAdmin = actor.role === 'admin';
  if (!isOwner && !isMaster && !isAdmin) throw forbidden('Это чужая запись');

  if (row.status === 'cancelled') throw conflict('Запись уже отменена');
  if (['done', 'no_show'].includes(row.status)) throw conflict('Состоявшийся визит отменить нельзя');

  /* Правило студии: отмена бесплатна за N часов. Позже отменить всё равно
     можно — иначе клиентка просто не придёт, а время останется занятым. */
  const isLate = Date.parse(row.starts_at) - Date.now() < settings.free_cancellation_lead_min * 60_000;

  transaction(() => {
    run('UPDATE appointments SET status = \'cancelled\', updated_at = $now WHERE id = $id',
      { now: nowIso(), id });
    writeLog(id, row.status, 'cancelled', actor.id,
      reason ?? (isLate ? 'поздняя отмена' : 'отмена'));
  });

  // напоминания снимаются: иначе придёт напоминание о визите, которого не будет
  cancelScheduled(id);

  return { id, status: 'cancelled', late_cancellation: isLate };
}

/* Отмена по ссылке из письма или сообщения — без входа в кабинет.
   Знание токена и есть подтверждение права: он случайный, свой у каждой
   записи и уходит только её владелице. */
export function cancelByToken({ token, reason }) {
  const row = get(
    `SELECT a.*, u.full_name AS client_name FROM appointments a
       JOIN users u ON u.id = a.client_id WHERE a.cancel_token = $token`,
    { token }
  );
  if (!row) throw notFound('Ссылка недействительна');

  return cancelAppointment({
    actor: { id: row.client_id, role: 'client' },
    id: row.id,
    reason: reason ?? 'отмена по ссылке'
  });
}

/** Подтверждение. Доступно администратору и мастеру, которому запись адресована. */
export function confirmAppointment({ actor, id }) {
  const row = get('SELECT * FROM appointments WHERE id = $id', { id });
  if (!row) throw notFound('Запись не найдена');

  const isMaster = row.master_id === actor.id;
  const isAdmin = actor.role === 'admin';
  if (!isMaster && !isAdmin) throw forbidden('Подтверждать запись может мастер или администратор');

  if (row.status !== 'pending') {
    throw conflict(`Запись в статусе «${row.status}», подтверждать нечего`);
  }

  transaction(() => {
    run('UPDATE appointments SET status = \'confirmed\', updated_at = $now WHERE id = $id',
      { now: nowIso(), id });
    writeLog(id, 'pending', 'confirmed', actor.id,
      isAdmin ? 'подтверждено в панели' : 'подтверждено мастером');
  });

  return { id, status: 'confirmed' };
}

// ── вспомогательное ─────────────────────────────────────────────────────────

function writeLog(appointmentId, from, to, byId, comment) {
  run(
    `INSERT INTO appointment_status_log (appointment_id, from_status, to_status, changed_by_id, comment)
     VALUES ($id, $from, $to, $by, $comment)`,
    { id: appointmentId, from, to, by: byId, comment }
  );
}

function createNote(actor, perms) {
  if (perms.allowOverlap === 1) return 'создано администратором поверх занятого времени';
  if (actor.role === 'master') return 'оформлено мастером';
  if (actor.role === 'admin') return 'создано администратором';
  return 'запись создана';
}

/* Отказ триггера превращается в 409 с подсказкой. Текст ошибки базы наружу
   не уходит: пользователю нужен понятный текст и что делать дальше. */
function mapOverlapError(err, { masterId, serviceIds, startsAt, hint }) {
  if (!/appointments_no_overlap/.test(err.message)) return err;
  return conflict(hint, {
    starts_at: startsAt,
    available: nearestFreeSlots({ masterId, serviceIds, fromIso: startsAt })
  });
}
