-- Контакты студии «Ноготочки»: почта и имя Telegram-бота.
--
-- Строку настроек кладёт 002_reference.sql, но на уже созданной базе там
-- остались контакты прежней версии. Применённую миграцию не правим —
-- контакты обновляются отдельным шагом. Бот к сервису по-прежнему
-- не подключён: bot_status не трогаем.
UPDATE studio_settings
   SET email = 'hello@nogotochki.studio',
       telegram_bot_username = 'nogotochki_bot'
 WHERE id = 1;
