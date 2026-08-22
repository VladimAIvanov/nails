/* Работа со временем. В базе всё хранится в UTC строками ISO-8601 с суффиксом Z
   (раздел 6 схемы). Часовой пояс студии применяется только на границах:
   при разборе графика работы и при показе времени человеку. */

/* Смещение пояса в миллисекундах для конкретного момента.
   Учитывает переходы на летнее время там, где они есть. */
export function zoneOffsetMs(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(instant);

  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUtc - instant.getTime();
}

/* Местное настенное время студии -> момент в UTC.
   Второй проход уточняет смещение: около перехода на летнее время
   первая оценка может попасть не в тот интервал. */
export function localToUtc(dateStr, timeStr, timeZone) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0, 0);

  let offset = zoneOffsetMs(new Date(guess), timeZone);
  offset = zoneOffsetMs(new Date(guess - offset), timeZone);
  return new Date(guess - offset);
}

/* Момент -> части местного времени студии. */
export function utcToLocal(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).formatToParts(instant);

  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`
  };
}

/* Для показа: «24 августа, 10:00». Время суток — по часам студии. */
export function formatForDisplay(iso, timeZone) {
  const { date, time } = utcToLocal(new Date(iso), timeZone);
  return { date, time, display: `${date} ${time}` };
}

/* День недели по ISO-8601: 1 — понедельник, 7 — воскресенье.
   Считается по календарю студии, а не по UTC: поздний вечерний визит
   иначе попал бы в соседний день и подтянул чужой график. */
export function isoWeekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

export function toIso(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function nowIso() {
  return toIso(new Date());
}

export function addMinutes(iso, minutes) {
  return toIso(new Date(Date.parse(iso) + minutes * 60_000));
}

export function minutesBetween(fromIso, toIsoStr) {
  return (Date.parse(toIsoStr) - Date.parse(fromIso)) / 60_000;
}
