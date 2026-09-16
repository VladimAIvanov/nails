-- Почтовый домен студии: адреса переехали на домен сервиса.
--
-- Демо-учётки сидов и контакт студии заводились на прежнем домене, и на
-- уже созданных базах они такими и остались: сиды и 002_reference.sql
-- применяются один раз. Переписываем адреса на месте — пароли, роли и
-- записи при этом не трогаются, меняется только логин сотрудника.
--
-- Условие по старому домену: адреса, заведённые студией вручную,
-- и администратор из ADMIN_EMAIL остаются как есть.

UPDATE users
   SET email = replace(email, '@nogotochki.studio', '@nogotochkee.ru'),
       updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
 WHERE email LIKE '%@nogotochki.studio';

UPDATE studio_settings
   SET email = 'hello@nogotochkee.ru'
 WHERE id = 1 AND email = 'hello@nogotochki.studio';
