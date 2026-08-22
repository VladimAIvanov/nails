-- Удержание слота на время оформления записи.
--
-- Это НЕ таблица заранее нарезанных слотов: строка появляется, когда конкретная
-- клиентка выбрала время и пошла заполнять контакты, и живёт несколько минут.
-- Свободное время по-прежнему вычисляется, а удержания лишь временно вычитаются
-- из результата наравне с записями и блокировками.

CREATE TABLE slot_holds (
  id           INTEGER PRIMARY KEY,
  token        TEXT    NOT NULL UNIQUE,
  master_id    INTEGER NOT NULL REFERENCES master_profiles (user_id) ON DELETE CASCADE,
  client_id    INTEGER REFERENCES users (id) ON DELETE CASCADE,
  starts_at    TEXT    NOT NULL,
  duration_min INTEGER NOT NULL CHECK (duration_min > 0),
  ends_at      TEXT    GENERATED ALWAYS AS
                       (strftime('%Y-%m-%dT%H:%M:%SZ', starts_at, '+' || duration_min || ' minutes')) STORED,
  expires_at   TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  CHECK (expires_at > created_at)
);

-- client_id пуст у гостя: запись без регистрации разрешена картой связей.

CREATE INDEX slot_holds_master_idx  ON slot_holds (master_id, starts_at);
CREATE INDEX slot_holds_expires_idx ON slot_holds (expires_at);

/* Два удержания на одно время у одного мастера бессмысленны: вторая клиентка
   всё равно не сможет записаться. Проверяются только живые удержания —
   истёкшие время не занимают. Как и у записей, неравенства строгие:
   удержание встык разрешено. */
CREATE TRIGGER slot_holds_no_overlap BEFORE INSERT ON slot_holds
BEGIN
  SELECT RAISE(ABORT, 'slot_holds_no_overlap: время уже удерживается')
  WHERE EXISTS (
    SELECT 1 FROM slot_holds h
    WHERE h.master_id = NEW.master_id
      AND h.expires_at > strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      AND h.starts_at < strftime('%Y-%m-%dT%H:%M:%SZ', NEW.starts_at, '+' || NEW.duration_min || ' minutes')
      AND h.ends_at   > NEW.starts_at
  );
END;

/* Удержание не должно перекрывать уже существующую запись. */
CREATE TRIGGER slot_holds_no_appointment_overlap BEFORE INSERT ON slot_holds
BEGIN
  SELECT RAISE(ABORT, 'slot_holds_no_overlap: время у мастера уже занято')
  WHERE EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.master_id = NEW.master_id
      AND a.status IN ('pending', 'confirmed')
      AND a.starts_at < strftime('%Y-%m-%dT%H:%M:%SZ', NEW.starts_at, '+' || NEW.duration_min || ' minutes')
      AND a.ends_at   > NEW.starts_at
  );
END;

-- Сколько минут живёт удержание. Настройка студии, рядом с остальными правилами записи.
ALTER TABLE studio_settings ADD COLUMN hold_ttl_min INTEGER NOT NULL DEFAULT 10;
