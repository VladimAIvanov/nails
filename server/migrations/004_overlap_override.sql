-- Осознанное наложение записи поверх занятого времени.
--
-- Сценарий из прототипа: клиентка пришла без записи, мастер согласилась принять,
-- администратор оформляет визит на уже занятый интервал. Это не обход защиты,
-- а отдельное разрешённое действие, поэтому у записи появляется признак.

ALTER TABLE appointments
  ADD COLUMN allow_overlap INTEGER NOT NULL DEFAULT 0 CHECK (allow_overlap IN (0, 1));

-- Триггеры пересоздаются: в условие добавляется проверка признака.
DROP TRIGGER appointments_no_overlap_insert;
DROP TRIGGER appointments_no_overlap_update;

/* Запрет пересечения при добавлении записи.
   Условие пересечения: начало одного визита меньше конца другого,
   а конец одного больше начала другого. Неравенства строгие, поэтому
   визиты встык (15:00–16:00 и 16:00–17:00) пересечением не считаются.
   Отменённые записи время не занимают и в проверку не попадают.

   NEW.allow_overlap = 0 — исключение для осознанного наложения. Признак
   гасит проверку только для самой создаваемой записи: в подзапросе строки x
   по этому признаку не фильтруются, поэтому уже созданная наложенная запись
   продолжает занимать время для всех следующих. */
CREATE TRIGGER appointments_no_overlap_insert BEFORE INSERT ON appointments
WHEN NEW.status IN ('pending', 'confirmed') AND NEW.allow_overlap = 0
BEGIN
  SELECT RAISE(ABORT, 'appointments_no_overlap: время у мастера уже занято')
  WHERE EXISTS (
    SELECT 1 FROM appointments x
    WHERE x.master_id = NEW.master_id
      AND x.status IN ('pending', 'confirmed')
      AND x.starts_at < strftime('%Y-%m-%dT%H:%M:%SZ', NEW.starts_at, '+' || NEW.duration_min || ' minutes')
      AND x.ends_at   > NEW.starts_at
  );
END;

/* То же при изменении. Список столбцов в UPDATE OF важен: перенос меняет
   starts_at, смена мастера — master_id, возврат из отмены — status.
   Без проверки на изменении запись можно было бы создать на свободное время,
   а потом перенести на занятое. */
CREATE TRIGGER appointments_no_overlap_update
BEFORE UPDATE OF starts_at, duration_min, master_id, status, allow_overlap ON appointments
WHEN NEW.status IN ('pending', 'confirmed') AND NEW.allow_overlap = 0
BEGIN
  SELECT RAISE(ABORT, 'appointments_no_overlap: время у мастера уже занято')
  WHERE EXISTS (
    SELECT 1 FROM appointments x
    WHERE x.id <> NEW.id
      AND x.master_id = NEW.master_id
      AND x.status IN ('pending', 'confirmed')
      AND x.starts_at < strftime('%Y-%m-%dT%H:%M:%SZ', NEW.starts_at, '+' || NEW.duration_min || ' minutes')
      AND x.ends_at   > NEW.starts_at
  );
END;

-- Наложения — событие, за которым стоит следить: их всегда единицы.
CREATE INDEX appointments_overlap_idx ON appointments (starts_at) WHERE allow_overlap = 1;
