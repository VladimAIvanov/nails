-- Схема сервиса записи «Варвара».
-- Соответствует docs/db-schema.md. Нумерация комментариев — разделы того документа.

CREATE EXTENSION IF NOT EXISTS btree_gist;  -- EXCLUDE с равенством по master_id
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- поиск по имени в панели
CREATE EXTENSION IF NOT EXISTS citext;      -- регистронезависимая почта

-- ── Перечисления ────────────────────────────────────────────────────────────
CREATE TYPE user_role          AS ENUM ('client', 'master', 'admin');
CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'done', 'cancelled', 'no_show');
CREATE TYPE booking_source     AS ENUM ('site', 'telegram', 'admin');
CREATE TYPE notification_kind  AS ENUM ('booking_created', 'booking_confirmed', 'reminder',
                                        'cancelled', 'new_slot', 'marketing');

-- ── 4.1 users ───────────────────────────────────────────────────────────────
CREATE TABLE users (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role                user_role   NOT NULL,
  full_name           text        NOT NULL,
  photo_url           text,
  phone               text        UNIQUE,
  email               citext      UNIQUE,
  password_hash       text,
  password_changed_at timestamptz,
  telegram_user_id    bigint      UNIQUE,
  telegram_username   text,
  is_active           boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_client_needs_phone CHECK (role <> 'client' OR phone IS NOT NULL),
  CONSTRAINT users_staff_needs_login  CHECK (role = 'client' OR (email IS NOT NULL AND password_hash IS NOT NULL)),
  CONSTRAINT users_phone_e164         CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$'),
  -- цель для составных внешних ключей, проверяющих роль
  CONSTRAINT users_id_role_key UNIQUE (id, role)
);

-- ── 4.2 master_profiles ─────────────────────────────────────────────────────
CREATE TABLE master_profiles (
  user_id                bigint      PRIMARY KEY,
  role                   user_role   NOT NULL DEFAULT 'master',
  bio                    text,
  photo_url              text,
  accepts_online_booking boolean     NOT NULL DEFAULT true,
  uses_studio_hours      boolean     NOT NULL DEFAULT true,
  sort_order             integer     NOT NULL DEFAULT 100,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT master_profiles_role_fixed CHECK (role = 'master'),
  -- роль проверяется базой, а не приложением
  CONSTRAINT master_profiles_user_fk FOREIGN KEY (user_id, role)
    REFERENCES users (id, role) ON DELETE CASCADE
);

-- ── 4.3 service_categories ──────────────────────────────────────────────────
CREATE TABLE service_categories (
  id         smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug       text        NOT NULL UNIQUE,
  title      text        NOT NULL,
  sort_order smallint    NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 4.4 services ────────────────────────────────────────────────────────────
CREATE TABLE services (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id        smallint    NOT NULL REFERENCES service_categories (id) ON DELETE RESTRICT,
  slug               text        NOT NULL UNIQUE,
  title              text        NOT NULL,
  description        text,
  duration_min       integer     NOT NULL,
  duration_is_from   boolean     NOT NULL DEFAULT false,
  price_kopecks      integer     NOT NULL,
  price_is_from      boolean     NOT NULL DEFAULT false,
  buffer_after_min   integer,
  badge              text,
  is_active          boolean     NOT NULL DEFAULT true,
  is_online_bookable boolean     NOT NULL DEFAULT true,
  sort_order         integer     NOT NULL DEFAULT 100,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT services_duration_ok CHECK (duration_min > 0 AND duration_min % 5 = 0),
  CONSTRAINT services_price_ok    CHECK (price_kopecks >= 0),
  CONSTRAINT services_buffer_ok   CHECK (buffer_after_min IS NULL OR buffer_after_min >= 0)
);

-- ── 4.5 master_services ─────────────────────────────────────────────────────
CREATE TABLE master_services (
  master_id              bigint      NOT NULL REFERENCES master_profiles (user_id) ON DELETE CASCADE,
  service_id             bigint      NOT NULL REFERENCES services (id) ON DELETE CASCADE,
  duration_min_override  integer,
  price_kopecks_override integer,
  is_active              boolean     NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (master_id, service_id),
  CONSTRAINT master_services_duration_ok CHECK (duration_min_override IS NULL OR duration_min_override > 0),
  CONSTRAINT master_services_price_ok    CHECK (price_kopecks_override IS NULL OR price_kopecks_override >= 0)
);

-- ── 4.6 studio_settings ─────────────────────────────────────────────────────
CREATE TABLE studio_settings (
  id                           smallint    PRIMARY KEY DEFAULT 1,
  title                        text        NOT NULL,
  city                         text        NOT NULL,
  address_line                 text        NOT NULL,
  address_note                 text,
  timezone                     text        NOT NULL DEFAULT 'Europe/Moscow',
  phone                        text        NOT NULL,
  email                        text,
  telegram_bot_username        text,
  bot_status                   text        NOT NULL DEFAULT 'disconnected',
  bot_connected_at             timestamptz,
  owner_user_id                bigint      REFERENCES users (id) ON DELETE SET NULL,
  online_booking_enabled       boolean     NOT NULL DEFAULT true,
  manual_confirmation_required boolean     NOT NULL DEFAULT false,
  reminder_lead_min            integer     NOT NULL DEFAULT 120,
  notify_owner_on_new_booking  boolean     NOT NULL DEFAULT true,
  free_cancellation_lead_min   integer     NOT NULL DEFAULT 240,
  booking_horizon_days         integer     NOT NULL DEFAULT 30,
  min_lead_time_min            integer     NOT NULL DEFAULT 60,
  pending_ttl_min              integer     NOT NULL DEFAULT 720,
  default_buffer_min           integer     NOT NULL DEFAULT 0,
  slot_step_min                integer     NOT NULL DEFAULT 30,
  guest_booking_mode           text        NOT NULL DEFAULT 'open',
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_settings_singleton CHECK (id = 1),
  CONSTRAINT studio_settings_bot_status CHECK (bot_status IN ('connected', 'disconnected', 'error')),
  CONSTRAINT studio_settings_guest_mode CHECK (guest_booking_mode IN ('open', 'verify_by_code', 'require_account')),
  CONSTRAINT studio_settings_step_ok    CHECK (slot_step_min > 0 AND slot_step_min % 5 = 0)
);

-- ── 4.7 working_hours ───────────────────────────────────────────────────────
CREATE TABLE working_hours (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  master_id       bigint      REFERENCES master_profiles (user_id) ON DELETE CASCADE,
  weekday         smallint    NOT NULL,
  starts_at_local time        NOT NULL,
  ends_at_local   time        NOT NULL,
  valid_from      date        NOT NULL DEFAULT current_date,
  valid_to        date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT working_hours_weekday_ok CHECK (weekday BETWEEN 1 AND 7),
  CONSTRAINT working_hours_range_ok   CHECK (ends_at_local > starts_at_local),
  CONSTRAINT working_hours_valid_ok   CHECK (valid_to IS NULL OR valid_to >= valid_from),
  -- NULLS NOT DISTINCT: строки студии (master_id IS NULL) тоже не должны дублироваться
  CONSTRAINT working_hours_unique UNIQUE NULLS NOT DISTINCT (master_id, weekday, starts_at_local, valid_from)
);

-- ── 4.8 time_off ────────────────────────────────────────────────────────────
CREATE TABLE time_off (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  master_id     bigint      REFERENCES master_profiles (user_id) ON DELETE CASCADE,
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz NOT NULL,
  kind          text        NOT NULL DEFAULT 'other',
  reason        text,
  created_by_id bigint      REFERENCES users (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT time_off_range_ok CHECK (ends_at > starts_at),
  CONSTRAINT time_off_kind_ok  CHECK (kind IN ('vacation', 'break', 'sick', 'holiday', 'other'))
);

-- ── 4.20 schedule_exceptions ────────────────────────────────────────────────
CREATE TABLE schedule_exceptions (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  master_id       bigint      REFERENCES master_profiles (user_id) ON DELETE CASCADE,
  exception_date  date        NOT NULL,
  is_working      boolean     NOT NULL,
  starts_at_local time,
  ends_at_local   time,
  reason          text,
  created_by_id   bigint      REFERENCES users (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_exceptions_hours_ok CHECK (
    is_working = false OR (starts_at_local IS NOT NULL AND ends_at_local IS NOT NULL)
  ),
  CONSTRAINT schedule_exceptions_range_ok CHECK (
    starts_at_local IS NULL OR ends_at_local IS NULL OR ends_at_local > starts_at_local
  ),
  CONSTRAINT schedule_exceptions_unique UNIQUE NULLS NOT DISTINCT (master_id, exception_date)
);

-- ── 4.9 appointments ────────────────────────────────────────────────────────
CREATE SEQUENCE appointment_public_number_seq START WITH 1042;

/* Вычисляемому полю и ограничению EXCLUDE нужна IMMUTABLE-функция, а оператор
   timestamptz + interval помечен STABLE: интервал может содержать месяцы и дни,
   а их длина зависит от часового пояса. Здесь интервал задан только в минутах —
   это фиксированное смещение в секундах, одинаковое в любом поясе, поэтому
   пометка IMMUTABLE здесь не обман планировщика, а верное утверждение. */
CREATE FUNCTION appointment_end(starts_at timestamptz, duration_min integer)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE STRICT
PARALLEL SAFE
AS $$ SELECT starts_at + make_interval(mins => duration_min) $$;

CREATE TABLE appointments (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_number        bigint      NOT NULL UNIQUE DEFAULT nextval('appointment_public_number_seq'),
  client_id            bigint      NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  master_id            bigint      NOT NULL REFERENCES master_profiles (user_id) ON DELETE RESTRICT,
  service_id           bigint      NOT NULL REFERENCES services (id) ON DELETE RESTRICT,
  starts_at            timestamptz NOT NULL,
  duration_min         integer     NOT NULL,
  ends_at              timestamptz GENERATED ALWAYS AS (appointment_end(starts_at, duration_min)) STORED,
  price_kopecks        integer     NOT NULL,
  status               appointment_status NOT NULL DEFAULT 'pending',
  source               booking_source     NOT NULL,
  master_auto_assigned boolean     NOT NULL DEFAULT false,
  client_comment       text,
  master_note          text,
  rescheduled_from_id  bigint      REFERENCES appointments (id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointments_amounts_ok CHECK (duration_min > 0 AND price_kopecks >= 0),
  -- главное ограничение схемы: у мастера не может быть двух активных записей внахлёст
  CONSTRAINT appointments_no_overlap EXCLUDE USING gist (
    master_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status IN ('pending', 'confirmed'))
);

-- ── 4.10 appointment_status_log ─────────────────────────────────────────────
CREATE TABLE appointment_status_log (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  appointment_id bigint      NOT NULL REFERENCES appointments (id) ON DELETE CASCADE,
  from_status    appointment_status,
  to_status      appointment_status NOT NULL,
  changed_by_id  bigint      REFERENCES users (id) ON DELETE SET NULL,
  comment        text,
  changed_at     timestamptz NOT NULL DEFAULT now()
);

-- ── 4.11 consents ───────────────────────────────────────────────────────────
CREATE TABLE consents (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          bigint      NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  kind             text        NOT NULL,
  is_granted       boolean     NOT NULL,
  document_version text,
  source           booking_source,
  changed_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consents_kind_ok CHECK (kind IN ('personal_data', 'marketing'))
);

-- ── 4.12 notification_prefs ─────────────────────────────────────────────────
CREATE TABLE notification_prefs (
  user_id            bigint      PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  telegram_reminders boolean     NOT NULL DEFAULT true,
  marketing          boolean     NOT NULL DEFAULT false,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ── 4.13 notifications ──────────────────────────────────────────────────────
CREATE TABLE notifications (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        bigint      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  appointment_id bigint      REFERENCES appointments (id) ON DELETE CASCADE,
  kind           notification_kind NOT NULL,
  channel        text        NOT NULL,
  scheduled_at   timestamptz NOT NULL,
  sent_at        timestamptz,
  status         text        NOT NULL DEFAULT 'scheduled',
  error          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_channel_ok CHECK (channel IN ('telegram', 'sms', 'email')),
  CONSTRAINT notifications_status_ok  CHECK (status IN ('scheduled', 'sent', 'failed', 'cancelled')),
  CONSTRAINT notifications_once UNIQUE (appointment_id, kind, channel)
);

-- ── 4.14 reviews ────────────────────────────────────────────────────────────
CREATE TABLE reviews (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  appointment_id bigint      NOT NULL UNIQUE REFERENCES appointments (id) ON DELETE CASCADE,
  rating         smallint    NOT NULL,
  text           text,
  is_published   boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reviews_rating_ok CHECK (rating BETWEEN 1 AND 5)
);

-- ── 4.15 favorite_masters ───────────────────────────────────────────────────
CREATE TABLE favorite_masters (
  client_id  bigint      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  master_id  bigint      NOT NULL REFERENCES master_profiles (user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, master_id)
);

-- ── 4.16 portfolio_works ────────────────────────────────────────────────────
CREATE TABLE portfolio_works (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  master_id    bigint      REFERENCES master_profiles (user_id) ON DELETE SET NULL,
  service_id   bigint      REFERENCES services (id) ON DELETE SET NULL,
  image_url    text        NOT NULL,
  title        text,
  sort_order   integer     NOT NULL DEFAULT 100,
  is_published boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── 4.17 sessions ───────────────────────────────────────────────────────────
CREATE TABLE sessions (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    bigint      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash text        NOT NULL UNIQUE,
  issued_at  timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  user_agent text,
  ip         inet,
  CONSTRAINT sessions_range_ok CHECK (expires_at > issued_at)
);

-- ── 4.18 slot_subscriptions ─────────────────────────────────────────────────
CREATE TABLE slot_subscriptions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id   bigint      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  master_id   bigint      NOT NULL REFERENCES master_profiles (user_id) ON DELETE CASCADE,
  service_id  bigint      REFERENCES services (id) ON DELETE CASCADE,
  date_from   date,
  date_to     date,
  is_active   boolean     NOT NULL DEFAULT true,
  notified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slot_subscriptions_dates_ok CHECK (
    date_to IS NULL OR date_from IS NULL OR date_to >= date_from
  ),
  CONSTRAINT slot_subscriptions_unique UNIQUE NULLS NOT DISTINCT (client_id, master_id, service_id)
);

-- ── 4.19 content_blocks ─────────────────────────────────────────────────────
CREATE TABLE content_blocks (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug         text        NOT NULL UNIQUE,
  section      text        NOT NULL,
  icon         text,
  title        text,
  body         text,
  image_url    text,
  sort_order   integer     NOT NULL DEFAULT 100,
  is_published boolean     NOT NULL DEFAULT true,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_blocks_section_ok CHECK (section IN ('hero', 'highlights', 'about'))
);

-- ── 4.21 appointment_status_labels ──────────────────────────────────────────
CREATE TABLE appointment_status_labels (
  status         appointment_status PRIMARY KEY,
  title          text        NOT NULL,
  title_short    text        NOT NULL,
  color_token    text        NOT NULL,
  sort_order     smallint    NOT NULL DEFAULT 100,
  show_in_filters boolean    NOT NULL DEFAULT true,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ── Раздел 7: индексы ───────────────────────────────────────────────────────
CREATE INDEX appointments_master_start_idx ON appointments (master_id, starts_at);
CREATE INDEX appointments_client_start_idx ON appointments (client_id, starts_at DESC);
CREATE INDEX appointments_active_start_idx ON appointments (starts_at)
  WHERE status IN ('pending', 'confirmed');
CREATE INDEX appointments_pending_idx      ON appointments (status)
  WHERE status = 'pending';
CREATE INDEX appointments_created_idx      ON appointments (created_at DESC);

CREATE INDEX time_off_range_idx ON time_off
  USING gist (master_id, tstzrange(starts_at, ends_at));
CREATE INDEX schedule_exceptions_date_idx ON schedule_exceptions (exception_date);

CREATE INDEX services_active_idx      ON services (category_id) WHERE is_active;
CREATE INDEX reviews_published_idx    ON reviews (appointment_id) WHERE is_published;
CREATE INDEX users_name_trgm_idx      ON users USING gin (full_name gin_trgm_ops);
CREATE INDEX notifications_due_idx    ON notifications (scheduled_at) WHERE status = 'scheduled';
CREATE INDEX portfolio_published_idx  ON portfolio_works (sort_order) WHERE is_published;
CREATE INDEX sessions_active_idx      ON sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX sessions_expires_idx     ON sessions (expires_at);
CREATE INDEX slot_subs_master_idx     ON slot_subscriptions (master_id) WHERE is_active;
CREATE INDEX content_blocks_pub_idx   ON content_blocks (section, sort_order) WHERE is_published;

-- ── Производный объект: рейтинг мастера ─────────────────────────────────────
CREATE MATERIALIZED VIEW master_ratings AS
SELECT a.master_id,
       round(avg(r.rating)::numeric, 1) AS rating_avg,
       count(*)                         AS reviews_count,
       max(r.created_at)                AS last_review_at
FROM reviews r
JOIN appointments a ON a.id = r.appointment_id
WHERE r.is_published
GROUP BY a.master_id;

-- обязателен для REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX master_ratings_master_idx ON master_ratings (master_id);
