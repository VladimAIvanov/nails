/* Регулярные записи: «каждые две недели по вторникам в 18:00».

   Серия — это правило, а не набор записей. Записи создаются вперёд на
   несколько повторов и дальше живут самостоятельно: перенос или отмена
   одного визита не трогает остальные, а серия продолжает выдавать следующие. */
import { all, get, run, transaction } from '../db.js';
import { badRequest, conflict, forbidden, notFound } from '../http.js';
import { getSettings, requiredDuration } from '../slots.js';
import { localToUtc, utcToLocal, isoWeekday, nowIso, toIso } from '../time.js';
import { createAppointment } from './appointments.js';

/* Даты повторов по правилу, в календаре студии. */
export function occurrenceDates(series, count) {
  const dates = [];
  const [y, m, d] = series.starts_on.split('-').map(Number);
  let cursor = new Date(Date.UTC(y, m - 1, d));

  // сдвигаемся к первому нужному дню недели, не раньше даты начала
  while (isoWeekday(toIso(cursor).slice(0, 10)) !== series.weekday) {
    cursor = new Date(cursor.getTime() + 86_400_000);
  }

  let index = 0;
  while (dates.length < count) {
    const date = toIso(cursor).slice(0, 10);
    if (series.ends_on && date > series.ends_on) break;
    if (series.occurrences && index >= series.occurrences) break;
    dates.push({ date, index });
    index++;
    cursor = new Date(cursor.getTime() + series.interval_weeks * 7 * 86_400_000);
  }
  return dates;
}

/* Создание серии. Права те же, что у обычной записи: клиент оформляет себе,
   мастер и администратор — кому угодно. Сами записи создаются общей функцией
   createAppointment, поэтому проверка пересечений, снимок цены и журнал
   статусов работают ровно так же, как у одиночного визита. */
export function createSeries({ actor, input }) {
  const settings = getSettings();

  const clientId = actor.role === 'client' ? actor.id : input.clientId;
  const masterId = actor.role === 'master' ? actor.id : input.masterId;
  if (!clientId) throw badRequest('Не указан клиент');
  if (!masterId) throw badRequest('Не указан мастер');

  if (!get('SELECT id FROM users WHERE id = $id', { id: clientId })) throw notFound('Клиент не найден');
  if (!get('SELECT user_id FROM master_profiles WHERE user_id = $id', { id: masterId })) {
    throw notFound('Мастер не найден');
  }

  // услуга проверяется тем же кодом, что и при обычной записи
  requiredDuration(masterId, [input.serviceId], settings);

  const seriesId = transaction(() => {
    run(
      `INSERT INTO recurring_series (client_id, master_id, service_id, interval_weeks, weekday,
                                     time_local, starts_on, ends_on, occurrences, generate_ahead,
                                     created_by_id)
       VALUES ($client, $master, $service, $interval, $weekday, $time, $from, $to, $times, $ahead, $by)`,
      {
        client: clientId, master: masterId, service: input.serviceId,
        interval: input.intervalWeeks, weekday: input.weekday, time: input.timeLocal,
        from: input.startsOn, to: input.endsOn ?? null, times: input.occurrences ?? null,
        ahead: input.generateAhead ?? 3, by: actor.id
      }
    );
    return get('SELECT last_insert_rowid() AS id').id;
  });

  const series = get('SELECT * FROM recurring_series WHERE id = $id', { id: seriesId });
  const result = materialize({ actor, series });

  return { series, ...result };
}

/* Создание ближайших записей серии. Занятые повторы пропускаются с причиной:
   серия не должна падать целиком из-за одного занятого вторника. */
export function materialize({ actor, series }) {
  const settings = getSettings();
  const created = [];
  const skipped = [];

  const existing = get(
    'SELECT COUNT(*) AS n, MAX(occurrence_index) AS last FROM appointments WHERE series_id = $id',
    { id: series.id }
  );
  const alreadyDone = existing.n ?? 0;

  const dates = occurrenceDates(series, alreadyDone + series.generate_ahead);

  for (const { date, index } of dates) {
    if (index <= (existing.last ?? -1)) continue;

    const startsAt = toIso(localToUtc(date, series.time_local, settings.timezone));
    if (startsAt <= nowIso()) { skipped.push({ date, reason: 'дата уже прошла' }); continue; }

    try {
      const res = createAppointment({
        actor,
        input: {
          clientId: series.client_id,
          masterId: series.master_id,
          serviceIds: [series.service_id],
          startsAt,
          comment: 'регулярная запись'
        }
      });
      run('UPDATE appointments SET series_id = $s, occurrence_index = $i WHERE id = $id',
        { s: series.id, i: index, id: res.ids[0] });
      created.push({ id: res.ids[0], date, starts_at: startsAt, index });
    } catch (err) {
      if (err.status === 409) {
        skipped.push({ date, starts_at: startsAt, reason: err.message });
      } else {
        throw err;
      }
    }
  }

  return { created, skipped };
}

export function listSeries({ actor, clientId }) {
  const target = actor.role === 'client' ? actor.id : clientId ?? null;
  const rows = all(
    `SELECT rs.*, s.title AS service_title, u.full_name AS master_name,
            (SELECT COUNT(*) FROM appointments a
              WHERE a.series_id = rs.id AND a.status IN ('pending','confirmed')) AS upcoming
       FROM recurring_series rs
       JOIN services s ON s.id = rs.service_id
       JOIN users u ON u.id = rs.master_id
      WHERE ($client IS NULL OR rs.client_id = $client)
        AND ($master IS NULL OR rs.master_id = $master)
      ORDER BY rs.created_at DESC`,
    {
      client: target,
      master: actor.role === 'master' ? actor.id : null
    }
  );
  return rows;
}

/* Остановка серии. Уже созданные записи по умолчанию остаются: клиентка
   на них рассчитывает. Отменить их можно явным запросом. */
export function stopSeries({ actor, id, cancelUpcoming = false }) {
  const series = get('SELECT * FROM recurring_series WHERE id = $id', { id });
  if (!series) throw notFound('Серия не найдена');

  const isOwner = series.client_id === actor.id;
  const isMaster = series.master_id === actor.id;
  const isAdmin = actor.role === 'admin';
  if (!isOwner && !isMaster && !isAdmin) throw forbidden('Это чужая серия');
  if (series.is_active !== 1) throw conflict('Серия уже остановлена');

  const upcoming = all(
    `SELECT id FROM appointments
      WHERE series_id = $id AND status IN ('pending','confirmed') AND starts_at > $now`,
    { id, now: nowIso() }
  );

  transaction(() => {
    run('UPDATE recurring_series SET is_active = 0 WHERE id = $id', { id });
    if (cancelUpcoming) {
      for (const a of upcoming) {
        run('UPDATE appointments SET status = \'cancelled\', updated_at = $now WHERE id = $id',
          { now: nowIso(), id: a.id });
        run(
          `INSERT INTO appointment_status_log (appointment_id, from_status, to_status, changed_by_id, comment)
           VALUES ($id, NULL, 'cancelled', $by, 'серия остановлена')`,
          { id: a.id, by: actor.id }
        );
      }
    }
  });

  return {
    id,
    stopped: true,
    cancelled_appointments: cancelUpcoming ? upcoming.length : 0,
    kept_appointments: cancelUpcoming ? 0 : upcoming.length
  };
}
