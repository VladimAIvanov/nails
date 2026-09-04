-- ПЕРЕСБОРКА ТАБЛИЦЫ
-- Вход через внешний сервис: Яндекс сегодня, при желании другие завтра.
--
-- Что меняется:
--   • появляются provider и provider_id — каким сервисом человек вошёл
--     и как этот сервис его называет;
--   • клиентке больше не обязателен телефон, если она пришла извне.
--
-- Пароль трогать не пришлось: password_hash был необязательным с самого
-- начала — так в базе живут гостьи, которых записала студия сама.
-- А вот ограничение users_client_needs_phone мешает: Яндекс отдаёт почту
-- и имя, телефона среди них нет и не будет. Требование «у клиентки должен
-- быть телефон» превращается в «у клиентки должно быть хоть что-то, по чему
-- её узнают»: телефон или внешняя учётная запись.
--
-- Изменить CHECK у существующего столбца в SQLite нельзя, поэтому таблица
-- пересобирается. На users ссылаются двадцать три таблицы, и DROP TABLE при
-- включённой проверке внешних ключей ведёт себя как DELETE FROM: тянет за
-- собой каскады и упирается в ON DELETE RESTRICT. Отметка «ПЕРЕСБОРКА
-- ТАБЛИЦЫ» в первой строке просит прогон миграций выключить проверку
-- снаружи транзакции и вернуть её обратно, проверив перед фиксацией,
-- что все ссылки сошлись (см. src/migrate.js).

CREATE TABLE users_new (
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

  -- Каким внешним сервисом вошёл человек. Список закрытый: новый провайдер
  -- добавляется миграцией, а не строкой из запроса.
  provider            TEXT    CHECK (provider IS NULL OR provider IN ('yandex')),

  -- Как этот сервис называет человека у себя. Почта со временем меняется,
  -- идентификатор — нет, поэтому при следующем входе узнаём именно по нему.
  provider_id         TEXT,

  is_active           INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

  -- Клиентку должны узнавать: либо по телефону, либо по внешней учётной
  -- записи. Раньше здесь стояло только первое.
  CONSTRAINT users_client_needs_contact CHECK (
    role <> 'client' OR phone IS NOT NULL OR provider IS NOT NULL
  ),
  CONSTRAINT users_staff_needs_login  CHECK (role = 'client' OR (email IS NOT NULL AND password_hash IS NOT NULL)),
  CONSTRAINT users_phone_e164         CHECK (phone IS NULL OR phone GLOB '+[1-9][0-9]*'),

  -- Половинка пары бессмысленна: «вошёл через яндекс, а кто именно —
  -- неизвестно» или «идентификатор есть, сервис неизвестен».
  CONSTRAINT users_provider_pair CHECK ((provider IS NULL) = (provider_id IS NULL))
);

INSERT INTO users_new (id, role, full_name, photo_url, phone, email, password_hash,
                       password_changed_at, telegram_user_id, telegram_username,
                       is_active, created_at, updated_at)
  SELECT id, role, full_name, photo_url, phone, email, password_hash,
         password_changed_at, telegram_user_id, telegram_username,
         is_active, created_at, updated_at
    FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- Индексы и триггеры уходят вместе со старой таблицей — восстанавливаем.
CREATE UNIQUE INDEX users_id_role_idx ON users (id, role);
CREATE INDEX users_name_idx  ON users (full_name);
CREATE INDEX users_phone_idx ON users (phone);

-- Одна учётная запись Яндекса — один человек в сервисе. Без этого повторный
-- вход мог бы завести второго пользователя с тем же provider_id.
CREATE UNIQUE INDEX users_provider_idx ON users (provider, provider_id)
  WHERE provider IS NOT NULL;

CREATE TRIGGER users_role_insert AFTER INSERT ON users
BEGIN
  INSERT INTO user_roles (user_id, role) VALUES (NEW.id, NEW.role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;

CREATE TRIGGER users_role_update AFTER UPDATE OF role ON users
WHEN NEW.role <> OLD.role
BEGIN
  INSERT INTO user_roles (user_id, role) VALUES (NEW.id, NEW.role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
