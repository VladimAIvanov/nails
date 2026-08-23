-- Счётчики попыток входа и регистрации.
--
-- Раньше они жили в памяти процесса и обнулялись при каждом перезапуске:
-- достаточно было дождаться развёртывания, чтобы перебор паролей начался
-- заново. В базе они переживают перезапуск.

CREATE TABLE rate_limits (
  bucket   TEXT    NOT NULL CHECK (bucket IN ('login', 'signup')),
  key      TEXT    NOT NULL,
  count    INTEGER NOT NULL DEFAULT 0,
  first_at TEXT    NOT NULL,
  PRIMARY KEY (bucket, key)
);

-- Для уборки просроченных окон.
CREATE INDEX rate_limits_first_idx ON rate_limits (first_at);
