/* Удержание слота на время оформления записи.

   Зачем: между «выбрала 18:00» и «нажала Записаться» проходит минута-другая,
   пока заполняются контакты. Без удержания это окно успевает занять кто-то
   другой, и клиентка получает отказ на последнем шаге. Удержание живёт
   несколько минут (studio_settings.hold_ttl_min) и истекает само. */
import { randomBytes } from 'node:crypto';
import { get, run, transaction } from '../db.js';
import { conflict, notFound, badRequest } from '../http.js';
import * as v from '../validate.js';
import { currentUser } from '../auth.js';
import { getSettings, requiredDuration, purgeExpiredHolds } from '../slots.js';
import { nowIso, addMinutes, utcToLocal } from '../time.js';

export default function register(router) {
  router.post('/api/holds', async ({ body, req }) => {
    const masterId = v.idParam(body.master_id, 'master_id');
    const serviceIds = v.idList(body.service_ids, 'service_ids');
    const startsAt = v.isoUtc(body.starts_at);

    const settings = getSettings();
    const user = currentUser(req); // удержание доступно и гостю, оформляющему запись

    if (settings.online_booking_enabled !== 1) {
      throw conflict('Онлайн-запись сейчас отключена');
    }

    const master = get(
      `SELECT mp.user_id, mp.accepts_online_booking, u.is_active
         FROM master_profiles mp JOIN users u ON u.id = mp.user_id WHERE mp.user_id = $id`,
      { id: masterId }
    );
    if (!master) throw notFound('Мастер не найден');
    if (master.is_active !== 1 || master.accepts_online_booking !== 1) {
      throw conflict('Мастер не принимает онлайн-запись');
    }

    const need = requiredDuration(masterId, serviceIds, settings);

    // время в прошлом или слишком близко удерживать бессмысленно
    const leadMs = Date.parse(startsAt) - Date.now();
    if (leadMs < settings.min_lead_time_min * 60_000) {
      throw conflict(`Записаться можно не позднее чем за ${settings.min_lead_time_min} мин`);
    }

    const token = randomBytes(24).toString('base64url');
    const expiresAt = addMinutes(nowIso(), settings.hold_ttl_min);

    try {
      transaction(() => {
        purgeExpiredHolds();
        run(
          `INSERT INTO slot_holds (token, master_id, client_id, starts_at, duration_min, expires_at)
           VALUES ($token, $master, $client, $starts, $duration, $expires)`,
          {
            token, master: masterId, client: user?.id ?? null,
            starts: startsAt, duration: need.total, expires: expiresAt
          }
        );
      });
    } catch (err) {
      // оба триггера сообщают об одном и том же: время занято
      if (/slot_holds_no_overlap/.test(err.message)) {
        throw conflict('Это время уже занято или удерживается', { starts_at: startsAt });
      }
      throw err;
    }

    return {
      status: 201,
      body: {
        hold_token: token,
        master_id: masterId,
        starts_at: startsAt,
        ends_at: addMinutes(startsAt, need.duration),
        duration_min: need.duration,
        buffer_min: need.buffer,
        expires_at: expiresAt,
        expires_in_sec: settings.hold_ttl_min * 60,
        local_time: utcToLocal(new Date(startsAt), settings.timezone).time,
        services: need.services
      }
    };
  });

  /* Явный отказ от удержания: клиентка закрыла форму, время освобождается
     сразу, не дожидаясь истечения. */
  router.delete('/api/holds/:token', async ({ params }) => {
    const token = v.str(params.token, 'token', { max: 64 });
    const changes = run('DELETE FROM slot_holds WHERE token = $token', { token }).changes;
    if (changes === 0) throw notFound('Удержание не найдено или уже истекло');
    return { body: { ok: true } };
  });

  /* Состояние удержания: сколько секунд осталось. */
  router.get('/api/holds/:token', async ({ params }) => {
    const token = v.str(params.token, 'token', { max: 64 });
    purgeExpiredHolds();
    const hold = get(
      `SELECT token, master_id, starts_at, ends_at, duration_min, expires_at
         FROM slot_holds WHERE token = $token AND expires_at > $now`,
      { token, now: nowIso() }
    );
    if (!hold) throw notFound('Удержание не найдено или истекло');
    return {
      body: {
        ...hold,
        expires_in_sec: Math.max(0, Math.round((Date.parse(hold.expires_at) - Date.now()) / 1000))
      }
    };
  });
}
