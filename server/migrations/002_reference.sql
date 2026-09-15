-- Справочные данные, без которых сервис не работает.
-- В отличие от сидов, это часть схемы: подписи статусов, настройки и часы студии.

-- Подписи и цвета статусов. Цвета прототипа: глиняный — подтверждена,
-- медовый — ждёт подтверждения, песочный зачёркнутый — отменена.
INSERT INTO appointment_status_labels (status, title, title_short, color_token, sort_order, show_in_filters) VALUES
  ('pending',   'Ожидает подтверждения', 'Ожидает',      '--honey-500', 10, 1),
  ('confirmed', 'Подтверждена',          'Подтверждена', '--clay-600',  20, 1),
  ('done',      'Визит состоялся',       'Выполнена',    '--sage-600',  30, 0),
  ('cancelled', 'Отменена',              'Отменена',     '--sand-300',  40, 1),
  ('no_show',   'Клиент не пришёл',      'Не пришла',    '--sand-500',  50, 0);

-- Единственная строка настроек студии.
INSERT INTO studio_settings (
  id, title, city, address_line, address_note, timezone, phone, email,
  telegram_bot_username, bot_status,
  online_booking_enabled, manual_confirmation_required,
  reminder_lead_min, notify_owner_on_new_booking, free_cancellation_lead_min,
  booking_horizon_days, min_lead_time_min, pending_ttl_min,
  default_buffer_min, slot_step_min, guest_booking_mode
) VALUES (
  1, 'Анна', 'Санкт-Петербург', 'ул. Рубинштейна, 24',
  'Второй этаж, домофон 24', 'Europe/Moscow', '+79210000000', 'hello@nogotochki.studio',
  'nogotochki_bot', 'disconnected',
  1, 0,
  120, 1, 240,
  30, 60, 720,
  15, 30, 'open'
);

-- Часы работы студии: понедельник–суббота 10:00–21:00, воскресенье выходной.
-- Выходной — это отсутствие строки, а не строка нулевой длины.
INSERT INTO working_hours (master_id, weekday, starts_at_local, ends_at_local, valid_from) VALUES
  (NULL, 1, '10:00', '21:00', '2026-01-01'),
  (NULL, 2, '10:00', '21:00', '2026-01-01'),
  (NULL, 3, '10:00', '21:00', '2026-01-01'),
  (NULL, 4, '10:00', '21:00', '2026-01-01'),
  (NULL, 5, '10:00', '21:00', '2026-01-01'),
  (NULL, 6, '10:00', '21:00', '2026-01-01');
