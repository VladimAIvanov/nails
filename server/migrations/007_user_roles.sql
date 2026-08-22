-- Роли списком: у одного человека их может быть несколько.
--
-- Владелица студии, которая сама принимает клиентов, должна быть
-- одновременно администратором и мастером. С единственным полем роли
-- ей пришлось бы заводить вторую учётную запись, и её визиты выпали бы
-- из расписания и отчётов.

CREATE TABLE user_roles (
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role       TEXT    NOT NULL CHECK (role IN ('client', 'master', 'admin')),
  granted_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  granted_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, role)
);

CREATE INDEX user_roles_role_idx ON user_roles (role);

-- Переносим то, что уже есть.
INSERT INTO user_roles (user_id, role) SELECT id, role FROM users;

/* users.role остаётся и продолжает работать как основная роль: на неё
   опирается составной внешний ключ master_profiles(user_id, role), который
   не пускает клиентку в профили мастеров. Список ролей — надстройка над ним,
   а не замена: проверка прав идёт по списку, целостность данных — по полю. */

-- Роль всегда должна присутствовать и в списке: иначе человек потеряет
-- доступ, который у него формально есть.
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
