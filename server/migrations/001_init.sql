-- Схема сервиса записи «Ноготочки» для SQLite.
-- Соответствует docs/db-schema.md. Нумерация комментариев — разделы того документа.
--
-- Соглашения, вынужденные отсутствием типов в SQLite:
--   время   — TEXT в ISO-8601 UTC: '2026-08-15T15:00:00Z'. Сравнивается как текст.
--   деньги  — INTEGER, копейки.
--   флаги   — INTEGER 0/1 с проверкой CHECK.
--   наборы  — TEXT с проверкой CHECK вместо типов-перечислений.

-- ── 4.1 users ───────────────────────────────────────────────────────────────
CREATE TABLE users (
  id                  INTEGER PRIMARY KEY,
  role                TEXT    NOT NULL CHECK (role IN ('client', 'master', 'admin')),
  full_name           TEXT    NOT NULL,
  photo_url           TEXT,
  phone               TEXT    UNIQUE,
  email               TEXT    UNIQUE COLLATE NOCASE,
  password_hash       TEXT,
  password_changed_at TEXT,
  telegram_user_id    INTEGER UNIQUE,
  telegram_username   TEXT,
  is_active           INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  CONSTRAINT users_client_needs_phone CHECK (role <> 'client' OR phone IS NOT NULL),
  CONSTRAINT users_staff_needs_login  CHECK (role = 'client' OR (email IS NOT NULL AND password_hash IS NOT NULL)),
  CONSTRAINT users_phone_e164         CHECK (phone IS NULL OR phone GLOB '+[1-9][0-9]*')
);

-- цель для составного внешнего ключа, проверяющего роль мастера
CREATE UNIQUE INDEX users_id_role_idx ON users (id, role);

-- ── 4.2 master_profiles ─────────────────────────────────────────────────────
CREATE TABLE master_profiles (
  user_id                INTEGER PRIMARY KEY,
  role                   TEXT    NOT NULL DEFAULT 'master' CHECK (role = 'master'),
  bio                    TEXT,
  photo_url              TEXT,
  accepts_online_booking INTEGER NOT NULL DEFAULT 1 CHECK (accepts_online_booking IN (0, 1)),
  uses_studio_hours      INTEGER NOT NULL DEFAULT 1 CHECK (uses_studio_hours IN (0, 1)),
  sort_order             INTEGER NOT NULL DEFAULT 100,
  created_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  -- роль проверяется базой: в профили мастеров не попадёт клиентка
  FOREIGN KEY (user_id, role) REFERENCES users (id, role) ON DELETE CASCADE
);

-- ── 4.3 service_categories ──────────────────────────────────────────────────
CREATE TABLE service_categories (
  id         INTEGER PRIMARY KEY,
  slug       TEXT    NOT NULL UNIQUE,
  title      TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ── 4.4 services ────────────────────────────────────────────────────────────
CREATE TABLE services (
  id                 INTEGER PRIMARY KEY,
  category_id        INTEGER NOT NULL REFERENCES service_categories (id) ON DELETE RESTRICT,
  slug               TEXT    NOT NULL UNIQUE,
  title              TEXT    NOT NULL,
  description        TEXT,
  duration_min       INTEGER NOT NULL CHECK (duration_min > 0 AND duration_min % 5 = 0),
  duration_is_from   INTEGER NOT NULL DEFAULT 0 CHECK (duration_is_from IN (0, 1)),
  price_kopecks      INTEGER NOT NULL CHECK (price_kopecks >= 0),
  price_is_from      INTEGER NOT NULL DEFAULT 0 CHECK (price_is_from IN (0, 1)),
  buffer_after_min   INTEGER CHECK (buffer_after_min IS NULL OR buffer_after_min >= 0),
  badge              TEXT,
  is_active          INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  is_online_bookable INTEGER NOT NULL DEFAULT 1 CHECK (is_online_bookable IN (0, 1)),
  sort_order         INTEGER NOT NULL DEFAULT 100,
  created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ── 4.5 master_services ─────────────────────────────────────────────────────
CREATE TABLE master_services (
  master_id              INTEGER NOT NULL REFERENCES master_profiles (user_id) ON DELETE CASCADE,
  service_id             INTEGER NOT NULL REFERENCES services (id) ON DELETE CASCADE,
  duration_min_override  INTEGER CHECK (duration_min_override IS NULL OR duration_min_override > 0),
  price_kopecks_override INTEGER CHECK (price_kopecks_override IS NULL OR price_kopecks_override >= 0),
  is_active              INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (master_id, service_id)
);

-- ── 4.6 studio_settings ─────────────────────────────────────────────────────
CREATE TABLE studio_settings (
  id                           INTEGER PRIMARY KEY CHECK (id = 1),
  title                        TEXT    NOT NULL,
  city                         TEXT    NOT NULL,
  address_line                 TEXT    NOT NULL,
  address_note                 TEXT,
  timezone                     TEXT    NOT NULL DEFAULT 'Europe/Moscow',
  phone                        TEXT    NOT NULL,
  email                        TEXT,
  telegram_bot_username        TEXT,
  bot_status                   TEXT    NOT NULL DEFAULT 'disconnected'
                                       CHECK (bot_status IN ('connected', 'disconnected', 'error')),
  bot_connected_at             TEXT,
  owner_user_id                INTEGER REFERENCES users (id) ON DELETE SET NULL,
  online_booking_enabled       INTEGER NOT NULL DEFAULT 1 CHECK (online_booking_enabled IN (0, 1)),
  manual_confirmation_required INTEGER NOT NULL DEFAULT 0 CHECK (manual_confirmation_required IN (0, 1)),
  reminder_lead_min            INTEGER NOT NULL DEFAULT 120,
  notify_owner_on_new_booking  INTEGER NOT NULL DEFAULT 1 CHECK (notify_owner_on_new_booking IN (0, 1)),
  free_cancellation_lead_min   INTEGER NOT NULL DEFAULT 240,
  booking_horizon_days         INTEGER NOT NULL DEFAULT 30,
  min_lead_time_min            INTEGER NOT NULL DEFAULT 60,
  pending_ttl_min              INTEGER NOT NULL DEFAULT 720,
  default_buffer_min           INTEGER NOT NULL DEFAULT 0,
  slot_step_min                INTEGER NOT NULL DEFAULT 30 CHECK (slot_step_min > 0 AND slot_step_min % 5 = 0),
  guest_booking_mode           TEXT    NOT NULL DEFAULT 'open'
                                       CHECK (guest_booking_mode IN ('open', 'verify_by_code', 'require_account')),
  updated_at                   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ── 4.7 working_hours ───────────────────────────────────────────────────────
CREATE TABLE working_hours (
  id              INTEGER PRIMARY KEY,
  master_id       INTEGER REFERENCES master_profiles (user_id) ON DELETE CASCADE,
  weekday         INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  starts_at_local TEXT    NOT NULL,
  ends_at_local   TEXT    NOT NULL CHECK (ends_at_local > starts_at_local),
  valid_from      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d', 'now')),
  valid_to        TEXT    CHECK (valid_to IS NULL OR valid_to >= valid_from),
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- В SQLite, как и в PostgreSQL по умолчанию, два NULL считаются разными значениями.
-- COALESCE заменяет отсутствующий в SQLite UNIQUE NULLS NOT DISTINCT: строки студии
-- (master_id IS NULL) — самые важные, и дублироваться они не должны.
CREATE UNIQUE INDEX working_hours_unique_idx
  ON working_hours (COALESCE(master_id, 0), weekday, starts_at_local, valid_from);

-- ── 4.8 time_off ────────────────────────────────────────────────────────────
CREATE TABLE time_off (
  id            INTEGER PRIMARY KEY,
  master_id     INTEGER REFERENCES master_profiles (user_id) ON DELETE CASCADE,
  starts_at     TEXT    NOT NULL,
  ends_at       TEXT    NOT NULL CHECK (ends_at > starts_at),
  kind          TEXT    NOT NULL DEFAULT 'other'
                        CHECK (kind IN ('vacation', 'break', 'sick', 'holiday', 'other')),
  reason        TEXT,
  created_by_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ── 4.20 schedule_exceptions ────────────────────────────────────────────────
CREATE TABLE schedule_exceptions (
  id              INTEGER PRIMARY KEY,
  master_id       INTEGER REFERENCES master_profiles (user_id) ON DELETE CASCADE,
  exception_date  TEXT    NOT NULL,
  is_working      INTEGER NOT NULL CHECK (is_working IN (0, 1)),
  starts_at_local TEXT,
  ends_at_local   TEXT,
  reason          TEXT,
  created_by_id   INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  CONSTRAINT schedule_exceptions_hours_ok CHECK (
    is_working = 0 OR (starts_at_local IS NOT NULL AND ends_at_local IS NOT NULL)
  ),
  CONSTRAINT schedule_exceptions_range_ok CHECK (
    starts_at_local IS NULL OR ends_at_local IS NULL OR ends_at_local > starts_at_local
  )
);

CREATE UNIQUE INDEX schedule_exceptions_unique_idx
  ON schedule_exceptions (COALESCE(master_id, 0), exception_date);

-- ── 4.9 appointments ────────────────────────────────────────────────────────
CREATE TABLE appointments (
  id                   INTEGER PRIMARY KEY,
  public_number        INTEGER UNIQUE,
  client_id            INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  master_id            INTEGER NOT NULL REFERENCES master_profiles (user_id) ON DELETE RESTRICT,
  service_id           INTEGER NOT NULL REFERENCES services (id) ON DELETE RESTRICT,
  starts_at            TEXT    NOT NULL,
  duration_min         INTEGER NOT NULL CHECK (duration_min > 0),
  -- конец визита считает база: поле участвует в проверке пересечений и в индексах
  ends_at              TEXT    GENERATED ALWAYS AS
                               (strftime('%Y-%m-%dT%H:%M:%SZ', starts_at, '+' || duration_min || ' minutes')) STORED,
  price_kopecks        INTEGER NOT NULL CHECK (price_kopecks >= 0),
  status               TEXT    NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'confirmed', 'done', 'cancelled', 'no_show')),
  source               TEXT    NOT NULL CHECK (source IN ('site', 'telegram', 'admin')),
  master_auto_assigned INTEGER NOT NULL DEFAULT 0 CHECK (master_auto_assigned IN (0, 1)),
  client_comment       TEXT,
  master_note          TEXT,
  rescheduled_from_id  INTEGER REFERENCES appointments (id) ON DELETE SET NULL,
  created_at           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Номер записи для человека: «Запись №1042», как в прототипе.
CREATE TRIGGER appointments_public_number AFTER INSERT ON appointments
WHEN NEW.public_number IS NULL
BEGIN
  UPDATE appointments
     SET public_number = (SELECT COALESCE(MAX(public_number), 1041) + 1 FROM appointments)
   WHERE id = NEW.id;
END;

/* Главная гарантия схемы: у мастера не может быть двух активных записей внахлёст.
   В PostgreSQL это делал EXCLUDE USING gist; в SQLite такого ограничения нет,
   поэтому проверка живёт в триггерах. Она надёжна, потому что писатель в SQLite
   всегда один: транзакция открывается через BEGIN IMMEDIATE (см. src/db.js),
   и пока она идёт, второй писатель ждёт. Гонки «проверили — вставили» нет. */
CREATE TRIGGER appointments_no_overlap_insert BEFORE INSERT ON appointments
WHEN NEW.status IN ('pending', 'confirmed')
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

CREATE TRIGGER appointments_no_overlap_update BEFORE UPDATE OF starts_at, duration_min, master_id, status ON appointments
WHEN NEW.status IN ('pending', 'confirmed')
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

-- ── 4.10 appointment_status_log ─────────────────────────────────────────────
CREATE TABLE appointment_status_log (
  id             INTEGER PRIMARY KEY,
  appointment_id INTEGER NOT NULL REFERENCES appointments (id) ON DELETE CASCADE,
  from_status    TEXT CHECK (from_status IS NULL OR from_status IN ('pending','confirmed','done','cancelled','no_show')),
  to_status      TEXT NOT NULL CHECK (to_status IN ('pending','confirmed','done','cancelled','no_show')),
  changed_by_id  INTEGER REFERENCES users (id) ON DELETE SET NULL,
  comment        TEXT,
  changed_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ── 4.11 consents ───────────────────────────────────────────────────────────
CREATE TABLE consents (
  id               INTEGER PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  kind             TEXT    NOT NULL CHECK (kind IN ('personal_data', 'marketing')),
  is_granted       INTEGER NOT NULL CHECK (is_granted IN (0, 1)),
  document_version TEXT,
  source           TEXT    CHECK (source IS NULL OR source IN ('site', 'telegram', 'admin')),
  changed_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ── 4.12 notification_prefs ─────────────────────────────────────────────────
CREATE TABLE notification_prefs (
  user_id            INTEGER PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  telegram_reminders INTEGER NOT NULL DEFAULT 1 CHECK (telegram_reminders IN (0, 1)),
  marketing          INTEGER NOT NULL DEFAULT 0 CHECK (marketing IN (0, 1)),
  updated_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ── 4.13 notifications ──────────────────────────────────────────────────────
CREATE TABLE notifications (
  id             INTEGER PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  appointment_id INTEGER REFERENCES appointments (id) ON DELETE CASCADE,
  kind           TEXT    NOT NULL CHECK (kind IN ('booking_created', 'booking_confirmed', 'reminder',
                                                  'cancelled', 'new_slot', 'marketing')),
  channel        TEXT    NOT NULL CHECK (channel IN ('telegram', 'sms', 'email')),
  scheduled_at   TEXT    NOT NULL,
  sent_at        TEXT,
  status         TEXT    NOT NULL DEFAULT 'scheduled'
                         CHECK (status IN ('scheduled', 'sent', 'failed', 'cancelled')),
  error          TEXT,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  CONSTRAINT notifications_once UNIQUE (appointment_id, kind, channel)
);

-- ── 4.14 reviews ────────────────────────────────────────────────────────────
CREATE TABLE reviews (
  id             INTEGER PRIMARY KEY,
  appointment_id INTEGER NOT NULL UNIQUE REFERENCES appointments (id) ON DELETE CASCADE,
  rating         INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text           TEXT,
  is_published   INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)),
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ── 4.15 favorite_masters ───────────────────────────────────────────────────
CREATE TABLE favorite_masters (
  client_id  INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  master_id  INTEGER NOT NULL REFERENCES master_profiles (user_id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (client_id, master_id)
);

-- ── 4.16 portfolio_works ────────────────────────────────────────────────────
CREATE TABLE portfolio_works (
  id           INTEGER PRIMARY KEY,
  master_id    INTEGER REFERENCES master_profiles (user_id) ON DELETE SET NULL,
  service_id   INTEGER REFERENCES services (id) ON DELETE SET NULL,
  image_url    TEXT    NOT NULL,
  title        TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 100,
  is_published INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)),
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ── 4.17 sessions ───────────────────────────────────────────────────────────
CREATE TABLE sessions (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT    NOT NULL UNIQUE,
  issued_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  expires_at TEXT    NOT NULL,
  revoked_at TEXT,
  user_agent TEXT,
  ip         TEXT,
  CHECK (expires_at > issued_at)
);

-- ── 4.18 slot_subscriptions ─────────────────────────────────────────────────
CREATE TABLE slot_subscriptions (
  id          INTEGER PRIMARY KEY,
  client_id   INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  master_id   INTEGER NOT NULL REFERENCES master_profiles (user_id) ON DELETE CASCADE,
  service_id  INTEGER REFERENCES services (id) ON DELETE CASCADE,
  date_from   TEXT,
  date_to     TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  notified_at TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  CHECK (date_to IS NULL OR date_from IS NULL OR date_to >= date_from)
);

CREATE UNIQUE INDEX slot_subscriptions_unique_idx
  ON slot_subscriptions (client_id, master_id, COALESCE(service_id, 0));

-- ── 4.19 content_blocks ─────────────────────────────────────────────────────
CREATE TABLE content_blocks (
  id           INTEGER PRIMARY KEY,
  slug         TEXT    NOT NULL UNIQUE,
  section      TEXT    NOT NULL CHECK (section IN ('hero', 'highlights', 'about')),
  icon         TEXT,
  title        TEXT,
  body         TEXT,
  image_url    TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 100,
  is_published INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)),
  updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ── 4.21 appointment_status_labels ──────────────────────────────────────────
CREATE TABLE appointment_status_labels (
  status          TEXT    PRIMARY KEY
                          CHECK (status IN ('pending', 'confirmed', 'done', 'cancelled', 'no_show')),
  title           TEXT    NOT NULL,
  title_short     TEXT    NOT NULL,
  color_token     TEXT    NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 100,
  show_in_filters INTEGER NOT NULL DEFAULT 1 CHECK (show_in_filters IN (0, 1)),
  updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ── Раздел 7: индексы ───────────────────────────────────────────────────────
CREATE INDEX appointments_master_start_idx ON appointments (master_id, starts_at);
CREATE INDEX appointments_client_start_idx ON appointments (client_id, starts_at DESC);
CREATE INDEX appointments_active_start_idx ON appointments (starts_at)
  WHERE status IN ('pending', 'confirmed');
CREATE INDEX appointments_pending_idx      ON appointments (status) WHERE status = 'pending';
CREATE INDEX appointments_created_idx      ON appointments (created_at DESC);

-- В SQLite нет gist-индексов по диапазонам: пересечения ищутся по началу интервала,
-- отсечение по концу делает сам запрос. На объёмах студии этого достаточно.
CREATE INDEX time_off_master_start_idx     ON time_off (master_id, starts_at);
CREATE INDEX schedule_exceptions_date_idx  ON schedule_exceptions (exception_date);

CREATE INDEX services_active_idx     ON services (category_id) WHERE is_active = 1;
CREATE INDEX reviews_published_idx   ON reviews (appointment_id) WHERE is_published = 1;
-- Поиска по подстроке через триграммы в SQLite нет; поиск по имени идёт через LIKE,
-- а этот индекс покрывает сортировку и поиск по началу строки.
CREATE INDEX users_name_idx          ON users (full_name);
CREATE INDEX users_phone_idx         ON users (phone);
CREATE INDEX notifications_due_idx   ON notifications (scheduled_at) WHERE status = 'scheduled';
CREATE INDEX portfolio_published_idx ON portfolio_works (sort_order) WHERE is_published = 1;
CREATE INDEX sessions_active_idx     ON sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX sessions_expires_idx    ON sessions (expires_at);
CREATE INDEX slot_subs_master_idx    ON slot_subscriptions (master_id) WHERE is_active = 1;
CREATE INDEX content_blocks_pub_idx  ON content_blocks (section, sort_order) WHERE is_published = 1;

-- ── Производный объект: рейтинг мастера ─────────────────────────────────────
-- Материализованных представлений в SQLite нет, поэтому это обычное представление:
-- запрос выполняется при каждом обращении. Источник истины — reviews.
CREATE VIEW master_ratings AS
SELECT a.master_id                      AS master_id,
       ROUND(AVG(r.rating), 1)          AS rating_avg,
       COUNT(*)                         AS reviews_count,
       MAX(r.created_at)                AS last_review_at
FROM reviews r
JOIN appointments a ON a.id = r.appointment_id
WHERE r.is_published = 1
GROUP BY a.master_id;
