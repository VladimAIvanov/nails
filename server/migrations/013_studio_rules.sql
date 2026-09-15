-- Правила бьюти-студии «Ноготочки».
--
-- • Режим работы: вторник–суббота, 10:00–20:00; воскресенье и понедельник
--   закрыто. Выходной — это отсутствие строки, как и в 002_reference.sql.
-- • Перенести запись можно, если клиент предупредил не позже чем за сутки.
--   Тот же срок считается сроком бесплатной отмены.
-- • Технический перерыв между записями не нужен: визиты идут встык.
--
-- Графики и услуги мастеров здесь не трогаем: на сервере их заводит студия
-- из панели, а демонстрационные — seed.js.

DELETE FROM working_hours WHERE master_id IS NULL;

INSERT INTO working_hours (master_id, weekday, starts_at_local, ends_at_local, valid_from) VALUES
  (NULL, 2, '10:00', '20:00', '2026-01-01'),
  (NULL, 3, '10:00', '20:00', '2026-01-01'),
  (NULL, 4, '10:00', '20:00', '2026-01-01'),
  (NULL, 5, '10:00', '20:00', '2026-01-01'),
  (NULL, 6, '10:00', '20:00', '2026-01-01');

UPDATE studio_settings
   SET free_cancellation_lead_min = 1440,
       default_buffer_min = 0
 WHERE id = 1;

UPDATE services SET buffer_after_min = 0;

-- Рубрика для услуг по бровям. Слаг совпадает с seed.js.
INSERT INTO service_categories (slug, title, sort_order) VALUES ('brows', 'Брови', 50)
ON CONFLICT (slug) DO NOTHING;
