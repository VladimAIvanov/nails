-- Расширение: каналы уведомлений, регулярные записи, календарь, отмена по ссылке.

-- ── 1. Каналы уведомлений ───────────────────────────────────────────────────
/* В SQLite нельзя изменить ограничение CHECK у существующего столбца, поэтому
   таблица пересобирается: добавляются каналы push и whatsapp и новые поводы. */
CREATE TABLE notifications_new (
  id             INTEGER PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  appointment_id INTEGER REFERENCES appointments (id) ON DELETE CASCADE,
  kind           TEXT    NOT NULL CHECK (kind IN (
                           'booking_created', 'booking_confirmed', 'reminder', 'cancelled',
                           'new_slot', 'marketing', 'series_created', 'series_ending',
                           'review_request')),
  channel        TEXT    NOT NULL CHECK (channel IN ('telegram', 'sms', 'email', 'push', 'whatsapp')),
  scheduled_at   TEXT    NOT NULL,
  sent_at        TEXT,
  status         TEXT    NOT NULL DEFAULT 'scheduled'
                         CHECK (status IN ('scheduled', 'sent', 'failed', 'cancelled')),
  error          TEXT,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  CONSTRAINT notifications_once UNIQUE (appointment_id, kind, channel)
);

INSERT INTO notifications_new (id, user_id, appointment_id, kind, channel, scheduled_at,
                               sent_at, status, error, created_at)
  SELECT id, user_id, appointment_id, kind, channel, scheduled_at,
         sent_at, status, error, created_at FROM notifications;

DROP TABLE notifications;
ALTER TABLE notifications_new RENAME TO notifications;

CREATE INDEX notifications_due_idx ON notifications (scheduled_at) WHERE status = 'scheduled';
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);

-- ── 2. Устройства для пуш-уведомлений ───────────────────────────────────────
/* Токен устройства хранится в открытом виде — в отличие от пароля и токена
   сеанса, его нельзя заменить хешем: он нужен целиком, чтобы отправить пуш. */
CREATE TABLE push_devices (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token        TEXT    NOT NULL UNIQUE,
  platform     TEXT    NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_name  TEXT,
  is_active    INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  last_seen_at TEXT,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX push_devices_user_idx ON push_devices (user_id) WHERE is_active = 1;

-- Настройки уведомлений: канал выбирается человеком, а не навязывается.
ALTER TABLE notification_prefs ADD COLUMN email_reminders INTEGER NOT NULL DEFAULT 0 CHECK (email_reminders IN (0, 1));
ALTER TABLE notification_prefs ADD COLUMN push_reminders  INTEGER NOT NULL DEFAULT 1 CHECK (push_reminders IN (0, 1));
ALTER TABLE notification_prefs ADD COLUMN sms_reminders   INTEGER NOT NULL DEFAULT 0 CHECK (sms_reminders IN (0, 1));

-- ── 3. Регулярные записи ────────────────────────────────────────────────────
/* Серия — это правило, а не набор записей. Записи из неё создаются вперёд
   на несколько повторов и живут дальше самостоятельно: перенос или отмена
   одного визита не трогает остальные. */
CREATE TABLE recurring_series (
  id               INTEGER PRIMARY KEY,
  client_id        INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  master_id        INTEGER NOT NULL REFERENCES master_profiles (user_id) ON DELETE CASCADE,
  service_id       INTEGER NOT NULL REFERENCES services (id) ON DELETE RESTRICT,
  interval_weeks   INTEGER NOT NULL CHECK (interval_weeks BETWEEN 1 AND 12),
  weekday          INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  time_local       TEXT    NOT NULL,
  starts_on        TEXT    NOT NULL,
  ends_on          TEXT,
  occurrences      INTEGER CHECK (occurrences IS NULL OR occurrences BETWEEN 1 AND 52),
  generate_ahead   INTEGER NOT NULL DEFAULT 3 CHECK (generate_ahead BETWEEN 1 AND 12),
  is_active        INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_by_id    INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE INDEX recurring_series_client_idx ON recurring_series (client_id) WHERE is_active = 1;
CREATE INDEX recurring_series_master_idx ON recurring_series (master_id) WHERE is_active = 1;

-- Связь записи с серией. Пусто у обычных записей.
ALTER TABLE appointments ADD COLUMN series_id INTEGER REFERENCES recurring_series (id) ON DELETE SET NULL;
ALTER TABLE appointments ADD COLUMN occurrence_index INTEGER;

CREATE INDEX appointments_series_idx ON appointments (series_id) WHERE series_id IS NOT NULL;

-- ── 4. Отмена по ссылке ─────────────────────────────────────────────────────
/* Ссылка вида /api/appointments/cancel/<токен> уходит в письме и сообщении.
   Отдельный токен, а не идентификатор записи: по номеру записи можно было бы
   перебором отменять чужие визиты. UNIQUE добавляется индексом — в SQLite
   ALTER TABLE не умеет добавлять ограничения. */
ALTER TABLE appointments ADD COLUMN cancel_token TEXT;
CREATE UNIQUE INDEX appointments_cancel_token_idx ON appointments (cancel_token)
  WHERE cancel_token IS NOT NULL;

-- ── 5. Подписка на календарь ────────────────────────────────────────────────
/* Личная лента в формате iCalendar: человек добавляет её один раз, дальше
   визиты появляются в его календаре сами. Токен отзывается без смены пароля. */
CREATE TABLE calendar_feeds (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token        TEXT    NOT NULL UNIQUE,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  revoked_at   TEXT,
  last_read_at TEXT
);

CREATE INDEX calendar_feeds_user_idx ON calendar_feeds (user_id) WHERE revoked_at IS NULL;

-- Напоминание за сутки — второе, в дополнение к напоминанию за два часа.
ALTER TABLE studio_settings ADD COLUMN reminder_day_before INTEGER NOT NULL DEFAULT 1
  CHECK (reminder_day_before IN (0, 1));
ALTER TABLE studio_settings ADD COLUMN public_base_url TEXT NOT NULL DEFAULT 'http://127.0.0.1:3000';
