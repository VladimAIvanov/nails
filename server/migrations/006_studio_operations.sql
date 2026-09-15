-- Работа студии: лист ожидания, отзывы, карточка клиентки, абонементы,
-- депозиты, лояльность, материалы и вознаграждение мастера.

-- ── Лист ожидания ───────────────────────────────────────────────────────────
/* Отличается от подписки на окна (slot_subscriptions) наличием срока:
   «хочу к Анне на этой неделе». Освободившееся время предлагается тем,
   чей интервал его накрывает. */
CREATE TABLE waitlist_entries (
  id           INTEGER PRIMARY KEY,
  client_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  master_id    INTEGER REFERENCES master_profiles (user_id) ON DELETE CASCADE,
  service_id   INTEGER NOT NULL REFERENCES services (id) ON DELETE CASCADE,
  date_from    TEXT    NOT NULL,
  date_to      TEXT    NOT NULL,
  part_of_day  TEXT    NOT NULL DEFAULT 'any'
                       CHECK (part_of_day IN ('any', 'morning', 'day', 'evening')),
  is_active    INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  notified_at  TEXT,
  fulfilled_by INTEGER REFERENCES appointments (id) ON DELETE SET NULL,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  CHECK (date_to >= date_from)
);

CREATE INDEX waitlist_active_idx ON waitlist_entries (service_id, date_from) WHERE is_active = 1;
CREATE UNIQUE INDEX waitlist_unique_idx
  ON waitlist_entries (client_id, COALESCE(master_id, 0), service_id, date_from) WHERE is_active = 1;

-- ── Карточка клиентки ───────────────────────────────────────────────────────
/* То, что мастера ведут в блокнотах: аллергии, форма ногтей, формула покрытия.
   Видна только студии — это не профиль, а рабочие заметки. */
CREATE TABLE client_cards (
  client_id     INTEGER PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  allergies     TEXT,
  nail_form     TEXT,
  preferences   TEXT,
  contraindications TEXT,
  updated_by_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
  updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Фотографии визита: часть попадает в портфолио, часть остаётся служебной.
CREATE TABLE visit_photos (
  id             INTEGER PRIMARY KEY,
  appointment_id INTEGER NOT NULL REFERENCES appointments (id) ON DELETE CASCADE,
  image_url      TEXT    NOT NULL,
  caption        TEXT,
  is_public      INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1)),
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX visit_photos_appt_idx ON visit_photos (appointment_id);

-- ── Абонементы ──────────────────────────────────────────────────────────────
CREATE TABLE passes (
  id            INTEGER PRIMARY KEY,
  client_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  service_id    INTEGER NOT NULL REFERENCES services (id) ON DELETE RESTRICT,
  total_visits  INTEGER NOT NULL CHECK (total_visits BETWEEN 1 AND 50),
  price_kopecks INTEGER NOT NULL CHECK (price_kopecks >= 0),
  purchased_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  expires_on    TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sold_by_id    INTEGER REFERENCES users (id) ON DELETE SET NULL
);

/* Использование — отдельные строки, а не счётчик в абонементе: счётчик
   разошёлся бы с реальностью при отмене визита, а строки просто удаляются. */
CREATE TABLE pass_usages (
  id             INTEGER PRIMARY KEY,
  pass_id        INTEGER NOT NULL REFERENCES passes (id) ON DELETE CASCADE,
  appointment_id INTEGER NOT NULL UNIQUE REFERENCES appointments (id) ON DELETE CASCADE,
  used_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX passes_client_idx ON passes (client_id) WHERE is_active = 1;

-- ── Депозит ─────────────────────────────────────────────────────────────────
/* Здесь только учёт: сколько нужно, внесено ли, что с ним стало. Приём денег
   делает касса или платёжный сервис, сервис записи их не трогает. */
ALTER TABLE appointments ADD COLUMN deposit_kopecks INTEGER NOT NULL DEFAULT 0
  CHECK (deposit_kopecks >= 0);
ALTER TABLE appointments ADD COLUMN deposit_status TEXT NOT NULL DEFAULT 'not_required'
  CHECK (deposit_status IN ('not_required', 'pending', 'paid', 'refunded', 'forfeited'));

ALTER TABLE studio_settings ADD COLUMN deposit_from_kopecks INTEGER NOT NULL DEFAULT 0;
ALTER TABLE studio_settings ADD COLUMN deposit_percent INTEGER NOT NULL DEFAULT 20
  CHECK (deposit_percent BETWEEN 0 AND 100);

-- ── Лояльность ──────────────────────────────────────────────────────────────
/* Баланс не хранится: он сумма событий. Иначе появилось бы второе место
   истины, которое разойдётся при отмене или правке. */
CREATE TABLE loyalty_events (
  id             INTEGER PRIMARY KEY,
  client_id      INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  appointment_id INTEGER REFERENCES appointments (id) ON DELETE SET NULL,
  points         INTEGER NOT NULL,
  kind           TEXT    NOT NULL CHECK (kind IN ('earned', 'spent', 'adjusted', 'expired')),
  comment        TEXT,
  created_by_id  INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX loyalty_client_idx ON loyalty_events (client_id, created_at DESC);
CREATE UNIQUE INDEX loyalty_once_per_visit_idx ON loyalty_events (appointment_id)
  WHERE kind = 'earned' AND appointment_id IS NOT NULL;

ALTER TABLE studio_settings ADD COLUMN loyalty_points_per_100_rub INTEGER NOT NULL DEFAULT 1;

-- ── Материалы ───────────────────────────────────────────────────────────────
CREATE TABLE materials (
  id            INTEGER PRIMARY KEY,
  title         TEXT    NOT NULL,
  unit          TEXT    NOT NULL DEFAULT 'шт',
  stock_qty     INTEGER NOT NULL DEFAULT 0,
  min_qty       INTEGER NOT NULL DEFAULT 0,
  price_kopecks INTEGER NOT NULL DEFAULT 0 CHECK (price_kopecks >= 0),
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE service_materials (
  service_id  INTEGER NOT NULL REFERENCES services (id) ON DELETE CASCADE,
  material_id INTEGER NOT NULL REFERENCES materials (id) ON DELETE CASCADE,
  qty         INTEGER NOT NULL CHECK (qty > 0),
  PRIMARY KEY (service_id, material_id)
);

/* Остаток — тоже сумма движений, а не самостоятельное поле. Поле stock_qty
   оставлено как кеш и пересчитывается из движений при каждом списании. */
CREATE TABLE material_movements (
  id             INTEGER PRIMARY KEY,
  material_id    INTEGER NOT NULL REFERENCES materials (id) ON DELETE CASCADE,
  delta          INTEGER NOT NULL,
  reason         TEXT    NOT NULL CHECK (reason IN ('purchase', 'consumption', 'writeoff', 'correction')),
  appointment_id INTEGER REFERENCES appointments (id) ON DELETE SET NULL,
  comment        TEXT,
  created_by_id  INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX material_movements_idx ON material_movements (material_id, created_at DESC);
CREATE UNIQUE INDEX material_consumption_once_idx
  ON material_movements (material_id, appointment_id) WHERE reason = 'consumption';

-- ── Вознаграждение мастера ──────────────────────────────────────────────────
ALTER TABLE master_profiles ADD COLUMN commission_percent INTEGER NOT NULL DEFAULT 40
  CHECK (commission_percent BETWEEN 0 AND 100);
