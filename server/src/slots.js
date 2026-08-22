/* Расчёт свободного времени мастера. Реализация алгоритма из раздела 5 схемы.

   Таблицы заранее нарезанных слотов нет и не будет: окна вычисляются в момент
   запроса из графика работы, исключений по датам, блокировок, существующих
   записей и живых удержаний. */
import { all, get, run } from './db.js';
import { badRequest, notFound } from './http.js';
import { localToUtc, utcToLocal, isoWeekday, toIso, nowIso, addMinutes } from './time.js';

export function getSettings() {
  return get('SELECT * FROM studio_settings WHERE id = 1');
}

/* Истёкшие удержания удаляются лениво — перед каждым расчётом и перед записью.
   Отдельный планировщик ради этого не нужен, а строк всегда единицы. */
export function purgeExpiredHolds() {
  return run('DELETE FROM slot_holds WHERE expires_at <= $now', { now: nowIso() }).changes;
}

const ms = (iso) => Date.parse(iso);

/* Вычитание занятых отрезков из свободных. Оба списка — пары [начало, конец]. */
function subtract(free, busy) {
  let result = free;
  for (const [bs, be] of busy) {
    const next = [];
    for (const [fs, fe] of result) {
      if (be <= fs || bs >= fe) { next.push([fs, fe]); continue; }
      if (bs > fs) next.push([fs, bs]);
      if (be < fe) next.push([be, fe]);
    }
    result = next;
  }
  return result.filter(([s, e]) => e > s);
}

/* Шаг 5: сколько времени нужно занять. Длительности услуг складываются,
   у мастера может быть своя. Уборка добавляется один раз — она делается
   после визита целиком, а не после каждой услуги, поэтому берётся
   наибольшее значение среди выбранных. */
export function requiredDuration(masterId, serviceIds, settings) {
  let duration = 0;
  let buffer = 0;
  const services = [];

  for (const id of serviceIds) {
    const row = get(
      `SELECT s.id, s.title, s.duration_min, s.price_kopecks, s.buffer_after_min,
              s.is_active, s.is_online_bookable,
              ms.duration_min_override, ms.price_kopecks_override, ms.is_active AS link_active
         FROM services s
         LEFT JOIN master_services ms ON ms.service_id = s.id AND ms.master_id = $master
        WHERE s.id = $id`,
      { id, master: masterId }
    );

    if (!row) throw notFound(`Услуга ${id} не найдена`);
    if (row.is_active !== 1) throw badRequest(`Услуга «${row.title}» отключена`);
    if (row.link_active === null) throw badRequest(`Мастер не оказывает услугу «${row.title}»`);
    if (row.link_active !== 1) throw badRequest(`Мастер временно не оказывает услугу «${row.title}»`);

    const dur = row.duration_min_override ?? row.duration_min;
    const price = row.price_kopecks_override ?? row.price_kopecks;
    duration += dur;
    buffer = Math.max(buffer, row.buffer_after_min ?? settings.default_buffer_min);
    services.push({ id: row.id, title: row.title, duration_min: dur, price_kopecks: price });
  }

  return { duration, buffer, total: duration + buffer, services };
}

/* Шаг 2: рабочие интервалы на дату, в местном времени студии. */
function workingIntervals(masterId, date, settings) {
  const tz = settings.timezone;

  /* Исключение заменяет недельное правило целиком. Студийное сильнее личного:
     если студия закрыта на праздник, разовая смена мастера день не открывает. */
  const exceptions = all(
    `SELECT master_id, is_working, starts_at_local, ends_at_local
       FROM schedule_exceptions
      WHERE exception_date = $date AND (master_id IS NULL OR master_id = $master)`,
    { date, master: masterId }
  );

  const studioException = exceptions.find((e) => e.master_id === null);
  const masterException = exceptions.find((e) => e.master_id === masterId);
  const exception = studioException ?? masterException;

  if (exception) {
    if (exception.is_working !== 1) return [];
    return [[exception.starts_at_local, exception.ends_at_local]];
  }

  const master = get('SELECT uses_studio_hours FROM master_profiles WHERE user_id = $id',
    { id: masterId });

  const owner = master.uses_studio_hours === 1 ? null : masterId;
  const rows = all(
    `SELECT starts_at_local, ends_at_local
       FROM working_hours
      WHERE weekday = $weekday
        AND valid_from <= $date
        AND (valid_to IS NULL OR valid_to >= $date)
        AND master_id IS $owner
      ORDER BY starts_at_local`,
    { weekday: isoWeekday(date), date, owner }
  );

  return rows.map((r) => [r.starts_at_local, r.ends_at_local]);
}

/* Основной расчёт. date — календарная дата по часам студии. */
export function freeSlots({ masterId, date, serviceIds }) {
  const settings = getSettings();
  const tz = settings.timezone;

  const master = get(
    `SELECT mp.user_id, u.full_name, mp.accepts_online_booking, u.is_active
       FROM master_profiles mp JOIN users u ON u.id = mp.user_id
      WHERE mp.user_id = $id`,
    { id: masterId }
  );
  if (!master) throw notFound('Мастер не найден');

  const need = requiredDuration(masterId, serviceIds, settings);

  const empty = {
    date,
    timezone: tz,
    step_min: settings.slot_step_min,
    duration_min: need.duration,
    buffer_min: need.buffer,
    services: need.services,
    slots: []
  };

  if (settings.online_booking_enabled !== 1) return { ...empty, reason: 'online_booking_disabled' };
  if (master.is_active !== 1 || master.accepts_online_booking !== 1) {
    return { ...empty, reason: 'master_not_bookable' };
  }

  // Шаг 7 (верхняя граница): дальше горизонта запись закрыта
  const today = utcToLocal(new Date(), tz).date;
  const horizonMs = Date.parse(`${today}T00:00:00Z`) + settings.booking_horizon_days * 86_400_000;
  if (Date.parse(`${date}T00:00:00Z`) > horizonMs) return { ...empty, reason: 'beyond_horizon' };

  // Шаг 2
  const intervals = workingIntervals(masterId, date, settings);
  if (intervals.length === 0) return { ...empty, reason: 'day_off' };

  purgeExpiredHolds();

  // местное настенное время -> моменты
  let free = intervals.map(([from, to]) => [
    localToUtc(date, from, tz).getTime(),
    localToUtc(date, to, tz).getTime()
  ]);

  const dayStart = toIso(new Date(Math.min(...free.map((i) => i[0]))));
  const dayEnd = toIso(new Date(Math.max(...free.map((i) => i[1]))));

  // Шаг 3: блокировки, личные и общестудийные
  const blocks = all(
    `SELECT starts_at, ends_at FROM time_off
      WHERE (master_id IS NULL OR master_id = $master)
        AND starts_at < $dayEnd AND ends_at > $dayStart`,
    { master: masterId, dayStart, dayEnd }
  );

  // Шаг 4: существующие записи. Отменённые время не занимают
  const busy = all(
    `SELECT starts_at, ends_at FROM appointments
      WHERE master_id = $master
        AND status IN ('pending', 'confirmed')
        AND starts_at < $dayEnd AND ends_at > $dayStart`,
    { master: masterId, dayStart, dayEnd }
  );

  // Живые удержания — как занятое время, пока не истекли
  const holds = all(
    `SELECT starts_at, ends_at FROM slot_holds
      WHERE master_id = $master AND expires_at > $now
        AND starts_at < $dayEnd AND ends_at > $dayStart`,
    { master: masterId, now: nowIso(), dayStart, dayEnd }
  );

  const occupied = [...blocks, ...busy, ...holds].map((r) => [ms(r.starts_at), ms(r.ends_at)]);
  free = subtract(free, occupied);

  // Шаг 6: нарезка сеткой и отбор тех точек, где помещается вся длительность
  const stepMs = settings.slot_step_min * 60_000;
  const needMs = need.total * 60_000;
  const notBefore = Date.now() + settings.min_lead_time_min * 60_000;

  const slots = [];
  for (const [from, to] of free) {
    // старт выравнивается по сетке от начала рабочего дня
    let cursor = Math.ceil(from / stepMs) * stepMs;
    while (cursor + needMs <= to) {
      if (cursor >= notBefore) {
        const startsAt = toIso(new Date(cursor));
        slots.push({
          starts_at: startsAt,
          ends_at: addMinutes(startsAt, need.duration),
          local_time: utcToLocal(new Date(cursor), tz).time
        });
      }
      cursor += stepMs;
    }
  }

  return { ...empty, slots, free_count: slots.length };
}

/* Ближайшие свободные окна — для подсказки в ответе 409, когда выбранное
   время только что заняли. Сканируем вперёд по дням, пока не наберём
   нужное количество или не упрёмся в горизонт записи. */
export function nearestFreeSlots({ masterId, serviceIds, fromIso, limit = 5, maxDays = 14 }) {
  const settings = getSettings();
  const tz = settings.timezone;
  const found = [];
  const start = new Date(fromIso ?? Date.now());

  for (let offset = 0; offset < maxDays && found.length < limit; offset++) {
    const day = new Date(start.getTime() + offset * 86_400_000);
    const date = utcToLocal(day, tz).date;

    let result;
    try {
      result = freeSlots({ masterId, date, serviceIds });
    } catch {
      break; // услуга или мастер стали недоступны — подсказывать нечего
    }

    for (const slot of result.slots) {
      if (fromIso && slot.starts_at <= fromIso && offset === 0) continue;
      found.push({ date, starts_at: slot.starts_at, local_time: slot.local_time });
      if (found.length >= limit) break;
    }
  }

  return found;
}
