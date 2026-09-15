/* Открытая часть: услуги, мастера и свободное время. Вход не требуется. */
import { all, get } from '../db.js';
import { badRequest, forbidden, notFound } from '../http.js';
import { currentUser, isAdmin } from '../auth.js';
import * as v from '../validate.js';
import { freeSlots, getSettings } from '../slots.js';
import { yandexConfigured } from '../services/external-login.js';

/* Цены отдаются целым числом в копейках — как и хранятся.
   Форматированием занимается интерфейс. */
const publicService = (s) => ({
  id: s.id,
  slug: s.slug,
  title: s.title,
  description: s.description,
  category: { id: s.category_id, slug: s.category_slug, title: s.category_title },
  duration_min: s.duration_min,
  duration_is_from: s.duration_is_from === 1,
  price_kopecks: s.price_kopecks,
  price_is_from: s.price_is_from === 1,
  badge: s.badge
});

/* Специализация мастера не хранится текстом, а собирается из категорий
   его услуг — см. раздел 10 схемы. */
const publicMaster = (m) => ({
  id: m.id,
  name: m.full_name,
  specialization: m.specialization ? m.specialization.split(',') : [],
  photo_url: m.photo_url,
  rating: m.rating_avg,
  reviews_count: m.reviews_count ?? 0,
  accepts_online_booking: m.accepts_online_booking === 1
});

export default function register(router) {
  router.get('/api/services', async ({ query }) => {
    const category = query.get('category');
    const rows = all(
      `SELECT s.*, c.slug AS category_slug, c.title AS category_title
         FROM services s
         JOIN service_categories c ON c.id = s.category_id
        WHERE s.is_active = 1 AND s.is_online_bookable = 1
          AND ($cat IS NULL OR c.slug = $cat)
        ORDER BY s.sort_order`,
      { cat: category ?? null }
    );

    const categories = all(
      'SELECT id, slug, title FROM service_categories ORDER BY sort_order'
    );

    return { body: { categories, services: rows.map(publicService) } };
  });

  router.get('/api/masters', async ({ query }) => {
    const serviceId = query.get('service_id') ? v.idParam(query.get('service_id'), 'service_id') : null;

    const rows = all(
      `SELECT u.id, u.full_name, mp.photo_url, mp.accepts_online_booking,
              r.rating_avg, r.reviews_count,
              (SELECT group_concat(DISTINCT c.title)
                 FROM master_services ms
                 JOIN services s ON s.id = ms.service_id
                 JOIN service_categories c ON c.id = s.category_id
                WHERE ms.master_id = mp.user_id AND ms.is_active = 1 AND s.is_active = 1
              ) AS specialization
         FROM master_profiles mp
         JOIN users u ON u.id = mp.user_id
         LEFT JOIN master_ratings r ON r.master_id = mp.user_id
        WHERE u.is_active = 1
          AND ($service IS NULL OR EXISTS (
                SELECT 1 FROM master_services ms
                 WHERE ms.master_id = mp.user_id AND ms.service_id = $service AND ms.is_active = 1))
        ORDER BY mp.sort_order`,
      { service: serviceId }
    );

    return { body: { masters: rows.map(publicMaster) } };
  });

  /* Свободное время. Услуги передаются списком: длительности складываются,
     потому что визит может состоять из нескольких услуг подряд. */
  router.get('/api/masters/:id/slots', async ({ params, query, req }) => {
    const masterId = v.idParam(params.id, 'master_id');
    const date = v.date(query.get('date'), 'date');

    const raw = query.getAll('service_id');
    // отсутствие обязательного параметра — 400, а не 404: адрес существует
    if (raw.length === 0) {
      throw badRequest('Укажите хотя бы одну услугу: ?service_id=1&service_id=2');
    }
    const serviceIds = raw.map((x) => v.idParam(x, 'service_id'));

    /* Окна для переноса. Переносимый визит сам не должен занимать время:
       иначе запись 14:00–16:30 нельзя сдвинуть на 16:00, хотя после переноса
       это время свободно. Исключить чужую запись нельзя — по разнице в окнах
       можно было бы узнать, когда записан другой человек. */
    let excludeAppointmentId = null;
    if (query.get('exclude_appointment_id')) {
      excludeAppointmentId = v.idParam(query.get('exclude_appointment_id'), 'exclude_appointment_id');
      const appt = get('SELECT client_id, master_id FROM appointments WHERE id = $id', { id: excludeAppointmentId });
      if (!appt) throw notFound('Запись не найдена');
      const user = currentUser(req);
      const allowed = user && (isAdmin(user) || appt.client_id === user.id || appt.master_id === user.id);
      if (!allowed) throw forbidden('Исключить из расчёта можно только свою запись');
      if (appt.master_id !== masterId) throw badRequest('Запись относится к другому мастеру');
    }

    return { body: freeSlots({ masterId, date, serviceIds, excludeAppointmentId }) };
  });

  /* Публичные сведения о студии: адрес, часы, правила отмены. */
  router.get('/api/studio', async () => {
    const s = getSettings();
    const hours = all(
      `SELECT weekday, starts_at_local, ends_at_local FROM working_hours
        WHERE master_id IS NULL ORDER BY weekday`
    );
    return {
      body: {
        title: s.title,
        city: s.city,
        address_line: s.address_line,
        address_note: s.address_note,
        phone: s.phone,
        timezone: s.timezone,
        telegram_bot: s.telegram_bot_username,
        online_booking_enabled: s.online_booking_enabled === 1,
        /* Какие внешние входы сейчас работают. Пустой список — кнопок нет.
           Яндекс считается работающим, только если заданы все три настройки:
           идентификатор, секрет и адрес возврата. Кнопка, которая всегда
           отвечает отказом, хуже отсутствующей. */
        external_login: yandexConfigured() ? ['yandex'] : [],
        free_cancellation_lead_min: s.free_cancellation_lead_min,
        reminder_lead_min: s.reminder_lead_min,
        working_hours: hours
      }
    };
  });
}

