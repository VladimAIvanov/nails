/* Управление студией: настройки, график, исключения, блокировки времени,
   категории, тексты лендинга, портфолио.

   Всё это было в схеме с самого начала, но управлялось только правкой базы
   руками — экранов и адресов не было. */
import { all, get, run, transaction } from '../db.js';
import { badRequest, conflict, forbidden, notFound } from '../http.js';
import * as v from '../validate.js';
import { requireRole } from '../auth.js';
import { nowIso } from '../time.js';

const BOOL_SETTINGS = [
  'online_booking_enabled', 'manual_confirmation_required', 'notify_owner_on_new_booking',
  'reminder_day_before'
];
const INT_SETTINGS = [
  'reminder_lead_min', 'free_cancellation_lead_min', 'booking_horizon_days',
  'min_lead_time_min', 'pending_ttl_min', 'default_buffer_min', 'slot_step_min',
  'hold_ttl_min', 'deposit_from_kopecks', 'deposit_percent', 'loyalty_points_per_100_rub'
];
const TEXT_SETTINGS = [
  'title', 'city', 'address_line', 'address_note', 'phone', 'email',
  'telegram_bot_username', 'timezone', 'public_base_url'
];

export default function register(router) {
  // ── Настройки студии ──────────────────────────────────────────────────────

  router.get('/api/admin/settings', async ({ req }) => {
    requireRole(req, 'admin');
    return { body: get('SELECT * FROM studio_settings WHERE id = 1') };
  });

  router.patch('/api/admin/settings', async ({ body, req }) => {
    requireRole(req, 'admin');
    const updates = {};

    for (const key of TEXT_SETTINGS) {
      if (body[key] === undefined) continue;
      updates[key] = v.str(body[key], key, { max: 200 });
    }
    for (const key of INT_SETTINGS) {
      if (body[key] === undefined) continue;
      updates[key] = v.int(body[key], key, { min: 0, max: 10_000_000 });
    }
    for (const key of BOOL_SETTINGS) {
      if (body[key] === undefined) continue;
      updates[key] = v.bool(body[key], key);
    }
    if (body.guest_booking_mode !== undefined) {
      updates.guest_booking_mode = v.oneOf(body.guest_booking_mode, 'guest_booking_mode',
        ['open', 'verify_by_code', 'require_account']);
    }
    if (body.bot_status !== undefined) {
      updates.bot_status = v.oneOf(body.bot_status, 'bot_status',
        ['connected', 'disconnected', 'error']);
      updates.bot_connected_at = updates.bot_status === 'connected' ? nowIso() : null;
    }

    if (Object.keys(updates).length === 0) throw badRequest('Нечего менять');
    if (updates.slot_step_min !== undefined && updates.slot_step_min % 5 !== 0) {
      throw badRequest('Поле «slot_step_min»: кратно 5 минутам');
    }
    if (updates.deposit_percent !== undefined && updates.deposit_percent > 100) {
      throw badRequest('Поле «deposit_percent»: не больше 100');
    }

    const columns = Object.keys(updates).map((k) => `${k} = $${k}`).join(', ');
    run(`UPDATE studio_settings SET ${columns}, updated_at = $now WHERE id = 1`,
      { ...updates, now: nowIso() });

    return { body: get('SELECT * FROM studio_settings WHERE id = 1') };
  });

  // ── График работы ─────────────────────────────────────────────────────────

  /* master_id не задан — график студии. Он же используется мастерами,
     у которых uses_studio_hours = 1. */
  router.get('/api/admin/working-hours', async ({ req, query }) => {
    requireRole(req, 'admin', 'master');
    const masterId = query.get('master_id') ? v.idParam(query.get('master_id'), 'master_id') : null;
    return {
      body: {
        hours: all(
          `SELECT * FROM working_hours WHERE master_id IS $master ORDER BY weekday, starts_at_local`,
          { master: masterId }
        )
      }
    };
  });

  /* Полная замена графика: недельное расписание правят целиком,
     а не по одному интервалу — так не остаётся забытых строк. */
  router.put('/api/admin/working-hours', async ({ body, req }) => {
    const actor = requireRole(req, 'admin', 'master');
    const masterId = body.master_id === undefined || body.master_id === null
      ? null
      : v.idParam(body.master_id, 'master_id');

    if (actor.role === 'master' && masterId !== actor.id) {
      throw forbidden('Мастер правит только свой график');
    }
    if (masterId !== null && !get('SELECT user_id FROM master_profiles WHERE user_id = $id', { id: masterId })) {
      throw notFound('Мастер не найден');
    }
    if (!Array.isArray(body.hours)) throw badRequest('Поле «hours»: список интервалов');

    const validFrom = body.valid_from ? v.date(body.valid_from, 'valid_from')
      : nowIso().slice(0, 10);

    const rows = body.hours.map((h, i) => {
      const weekday = v.int(h.weekday, `hours[${i}].weekday`, { min: 1, max: 7 });
      const from = v.str(h.starts_at_local, `hours[${i}].starts_at_local`, { max: 5 });
      const to = v.str(h.ends_at_local, `hours[${i}].ends_at_local`, { max: 5 });
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(from) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(to)) {
        throw badRequest(`hours[${i}]: время в формате ЧЧ:ММ`);
      }
      if (to <= from) throw badRequest(`hours[${i}]: конец должен быть позже начала`);
      return { weekday, from, to };
    });

    transaction(() => {
      run('DELETE FROM working_hours WHERE master_id IS $master', { master: masterId });
      for (const r of rows) {
        run(
          `INSERT INTO working_hours (master_id, weekday, starts_at_local, ends_at_local, valid_from)
           VALUES ($master, $weekday, $from, $to, $validFrom)`,
          { master: masterId, weekday: r.weekday, from: r.from, to: r.to, validFrom }
        );
      }
    });

    return {
      body: {
        master_id: masterId,
        hours: all('SELECT * FROM working_hours WHERE master_id IS $master ORDER BY weekday',
          { master: masterId })
      }
    };
  });

  // ── Исключения по датам ───────────────────────────────────────────────────

  router.get('/api/admin/schedule-exceptions', async ({ req, query }) => {
    requireRole(req, 'admin', 'master');
    const from = query.get('from') ? v.date(query.get('from'), 'from') : nowIso().slice(0, 10);
    return {
      body: {
        exceptions: all(
          `SELECT e.*, u.full_name AS master_name FROM schedule_exceptions e
             LEFT JOIN users u ON u.id = e.master_id
            WHERE e.exception_date >= $from ORDER BY e.exception_date`,
          { from }
        )
      }
    };
  });

  router.post('/api/admin/schedule-exceptions', async ({ body, req }) => {
    const actor = requireRole(req, 'admin', 'master');
    const masterId = body.master_id === undefined || body.master_id === null
      ? null
      : v.idParam(body.master_id, 'master_id');

    if (actor.role === 'master' && masterId !== actor.id) {
      throw forbidden('Мастер задаёт исключения только себе');
    }

    const isWorking = v.bool(body.is_working, 'is_working');
    if (isWorking === null) throw badRequest('Поле «is_working» обязательно');

    const startsAt = isWorking === 1 ? v.str(body.starts_at_local, 'starts_at_local', { max: 5 }) : null;
    const endsAt = isWorking === 1 ? v.str(body.ends_at_local, 'ends_at_local', { max: 5 }) : null;
    if (isWorking === 1 && endsAt <= startsAt) {
      throw badRequest('Конец рабочего дня должен быть позже начала');
    }

    try {
      run(
        `INSERT INTO schedule_exceptions (master_id, exception_date, is_working,
                                          starts_at_local, ends_at_local, reason, created_by_id)
         VALUES ($master, $date, $working, $from, $to, $reason, $by)`,
        {
          master: masterId, date: v.date(body.exception_date, 'exception_date'),
          working: isWorking, from: startsAt, to: endsAt,
          reason: v.optionalStr(body.reason, 'reason', { max: 200 }), by: actor.id
        }
      );
    } catch (err) {
      if (/UNIQUE/i.test(err.message)) throw conflict('Исключение на эту дату уже есть');
      throw err;
    }

    return { status: 201, body: get('SELECT * FROM schedule_exceptions WHERE id = last_insert_rowid()') };
  });

  router.delete('/api/admin/schedule-exceptions/:id', async ({ params, req }) => {
    const actor = requireRole(req, 'admin', 'master');
    const id = v.idParam(params.id);
    const row = get('SELECT master_id FROM schedule_exceptions WHERE id = $id', { id });
    if (!row) throw notFound('Исключение не найдено');
    if (actor.role === 'master' && row.master_id !== actor.id) throw forbidden('Это чужое исключение');
    run('DELETE FROM schedule_exceptions WHERE id = $id', { id });
    return { body: { ok: true, deleted: id } };
  });

  // ── Блокировки времени ────────────────────────────────────────────────────

  /* Отпуск, обед, больничный. Раньше существовали только в схеме —
     закрыть время через API было нельзя. */
  router.get('/api/admin/time-off', async ({ req, query }) => {
    const actor = requireRole(req, 'admin', 'master');
    const from = query.get('from') ? v.date(query.get('from'), 'from') : nowIso().slice(0, 10);
    return {
      body: {
        blocks: all(
          `SELECT t.*, u.full_name AS master_name FROM time_off t
             LEFT JOIN users u ON u.id = t.master_id
            WHERE t.ends_at >= $from
              AND ($master IS NULL OR t.master_id IS NULL OR t.master_id = $master)
            ORDER BY t.starts_at`,
          { from, master: actor.role === 'master' ? actor.id : null }
        )
      }
    };
  });

  router.post('/api/admin/time-off', async ({ body, req }) => {
    const actor = requireRole(req, 'admin', 'master');
    const masterId = body.master_id === undefined || body.master_id === null
      ? null
      : v.idParam(body.master_id, 'master_id');

    if (actor.role === 'master' && masterId !== actor.id) {
      throw forbidden('Мастер закрывает только своё время');
    }

    const startsAt = v.isoUtc(body.starts_at, 'starts_at');
    const endsAt = v.isoUtc(body.ends_at, 'ends_at');
    if (endsAt <= startsAt) throw badRequest('Поле «ends_at» должно быть позже «starts_at»');

    /* Уже назначенные визиты не отменяются молча: студия должна увидеть,
       кого придётся переносить. */
    const affected = all(
      `SELECT a.id, a.public_number, a.starts_at, u.full_name AS client
         FROM appointments a JOIN users u ON u.id = a.client_id
        WHERE a.status IN ('pending','confirmed')
          AND ($master IS NULL OR a.master_id = $master)
          AND a.starts_at < $ends AND a.ends_at > $starts`,
      { master: masterId, starts: startsAt, ends: endsAt }
    );

    run(
      `INSERT INTO time_off (master_id, starts_at, ends_at, kind, reason, created_by_id)
       VALUES ($master, $starts, $ends, $kind, $reason, $by)`,
      {
        master: masterId, starts: startsAt, ends: endsAt,
        kind: body.kind ? v.oneOf(body.kind, 'kind', ['vacation', 'break', 'sick', 'holiday', 'other']) : 'other',
        reason: v.optionalStr(body.reason, 'reason', { max: 200 }), by: actor.id
      }
    );

    return {
      status: 201,
      body: {
        block: get('SELECT * FROM time_off WHERE id = last_insert_rowid()'),
        /* Блокировка не выселяет существующие записи: свободное время
           перестанет предлагаться, а с уже записанными надо разбираться вручную. */
        appointments_to_reschedule: affected
      }
    };
  });

  router.delete('/api/admin/time-off/:id', async ({ params, req }) => {
    const actor = requireRole(req, 'admin', 'master');
    const id = v.idParam(params.id);
    const row = get('SELECT master_id FROM time_off WHERE id = $id', { id });
    if (!row) throw notFound('Блокировка не найдена');
    if (actor.role === 'master' && row.master_id !== actor.id) throw forbidden('Это чужая блокировка');
    run('DELETE FROM time_off WHERE id = $id', { id });
    return { body: { ok: true, deleted: id } };
  });

  // ── Категории услуг ───────────────────────────────────────────────────────

  router.post('/api/admin/categories', async ({ body, req }) => {
    requireRole(req, 'admin');
    const slug = v.slug(body.slug);
    if (get('SELECT id FROM service_categories WHERE slug = $slug', { slug })) {
      throw conflict('Категория с таким slug уже есть');
    }
    run('INSERT INTO service_categories (slug, title, sort_order) VALUES ($slug, $title, $sort)',
      {
        slug, title: v.str(body.title, 'title', { max: 80 }),
        sort: body.sort_order ?? 100
      });
    return { status: 201, body: get('SELECT * FROM service_categories WHERE slug = $slug', { slug }) };
  });

  router.delete('/api/admin/categories/:id', async ({ params, req }) => {
    requireRole(req, 'admin');
    const id = v.idParam(params.id);
    if (!get('SELECT id FROM service_categories WHERE id = $id', { id })) throw notFound('Категория не найдена');
    try {
      run('DELETE FROM service_categories WHERE id = $id', { id });
    } catch (err) {
      if (/FOREIGN KEY/i.test(err.message)) {
        throw conflict('В категории есть услуги, удалить нельзя');
      }
      throw err;
    }
    return { body: { ok: true, deleted: id } };
  });

  // ── Тексты лендинга ───────────────────────────────────────────────────────

  /* Заявленная возможность: владелица правит обещания клиенту сама,
     без разработчика. До сих пор блоки существовали только в базе. */
  router.get('/api/content', async () => ({
    body: {
      blocks: all(
        `SELECT slug, section, icon, title, body, image_url, sort_order
           FROM content_blocks WHERE is_published = 1 ORDER BY section, sort_order`
      )
    }
  }));

  router.patch('/api/admin/content/:slug', async ({ params, body, req }) => {
    requireRole(req, 'admin');
    const slug = v.slug(params.slug);
    if (!get('SELECT id FROM content_blocks WHERE slug = $slug', { slug })) {
      throw notFound('Блок не найден');
    }
    run(
      `UPDATE content_blocks SET
         title = COALESCE($title, title), body = COALESCE($text, body),
         icon = COALESCE($icon, icon), image_url = COALESCE($image, image_url),
         is_published = COALESCE($published, is_published), updated_at = $now
       WHERE slug = $slug`,
      {
        title: v.optionalStr(body.title, 'title', { max: 200 }),
        text: v.optionalStr(body.body, 'body', { max: 1000 }),
        icon: v.optionalStr(body.icon, 'icon', { max: 40 }),
        image: v.optionalStr(body.image_url, 'image_url', { max: 500 }),
        published: v.bool(body.is_published, 'is_published'),
        now: nowIso(), slug
      }
    );
    return { body: get('SELECT * FROM content_blocks WHERE slug = $slug', { slug }) };
  });

  // ── Портфолио ─────────────────────────────────────────────────────────────

  router.get('/api/portfolio', async ({ query }) => {
    const masterId = query.get('master_id') ? v.idParam(query.get('master_id'), 'master_id') : null;
    return {
      body: {
        works: all(
          `SELECT p.id, p.image_url, p.title, p.master_id, u.full_name AS master_name
             FROM portfolio_works p LEFT JOIN users u ON u.id = p.master_id
            WHERE p.is_published = 1 AND ($master IS NULL OR p.master_id = $master)
            ORDER BY p.sort_order`,
          { master: masterId }
        )
      }
    };
  });

  router.post('/api/admin/portfolio', async ({ body, req }) => {
    const actor = requireRole(req, 'admin', 'master');
    const masterId = actor.role === 'master' ? actor.id
      : (body.master_id ? v.idParam(body.master_id, 'master_id') : null);

    run(
      `INSERT INTO portfolio_works (master_id, service_id, image_url, title, sort_order, is_published)
       VALUES ($master, $service, $url, $title, $sort, $published)`,
      {
        master: masterId,
        service: body.service_id ? v.idParam(body.service_id, 'service_id') : null,
        url: v.str(body.image_url, 'image_url', { max: 500 }),
        title: v.optionalStr(body.title, 'title', { max: 200 }),
        sort: body.sort_order ?? 100,
        published: v.bool(body.is_published, 'is_published') ?? 1
      }
    );
    return { status: 201, body: get('SELECT * FROM portfolio_works WHERE id = last_insert_rowid()') };
  });

  router.delete('/api/admin/portfolio/:id', async ({ params, req }) => {
    const actor = requireRole(req, 'admin', 'master');
    const id = v.idParam(params.id);
    const row = get('SELECT master_id FROM portfolio_works WHERE id = $id', { id });
    if (!row) throw notFound('Работа не найдена');
    if (actor.role === 'master' && row.master_id !== actor.id) throw forbidden('Это чужая работа');
    run('DELETE FROM portfolio_works WHERE id = $id', { id });
    return { body: { ok: true, deleted: id } };
  });

  // ── Клиенты студии ────────────────────────────────────────────────────────

  /* Поиск по имени и телефону — без него администратор не может оформить
     запись из панели: нужен client_id, а взять его было неоткуда. */
  router.get('/api/admin/clients', async ({ req, query }) => {
    requireRole(req, 'admin', 'master');
    const search = query.get('search') ? v.str(query.get('search'), 'search', { max: 100 }) : null;
    const limit = query.get('limit') ? v.int(query.get('limit'), 'limit', { min: 1, max: 100 }) : 20;

    return {
      body: {
        clients: all(
          `SELECT u.id, u.full_name, u.phone, u.email,
                  (SELECT COUNT(*) FROM appointments a WHERE a.client_id = u.id AND a.status = 'done') AS visits,
                  (SELECT MAX(a.starts_at) FROM appointments a WHERE a.client_id = u.id) AS last_visit
             FROM users u
            WHERE u.role = 'client' AND u.is_active = 1
              AND ($search IS NULL OR u.full_name LIKE '%' || $search || '%'
                                   OR u.phone LIKE '%' || $search || '%')
            ORDER BY last_visit DESC NULLS LAST LIMIT $limit`,
          { search, limit }
        )
      }
    };
  });

  // ── Депозит ───────────────────────────────────────────────────────────────

  /* Отметка о внесении депозита. Деньги принимает касса — сюда попадает
     только факт. Поэтому и доступно это студии, а не клиенту. */
  router.post('/api/admin/appointments/:id/deposit', async ({ params, body, req }) => {
    requireRole(req, 'admin', 'master');
    const id = v.idParam(params.id);
    const status = v.oneOf(body.status, 'status', ['paid', 'refunded', 'forfeited', 'not_required']);

    const row = get('SELECT deposit_kopecks, deposit_status FROM appointments WHERE id = $id', { id });
    if (!row) throw notFound('Запись не найдена');
    if (row.deposit_kopecks === 0 && status !== 'not_required') {
      throw conflict('По этой записи депозит не требуется');
    }

    run('UPDATE appointments SET deposit_status = $s, updated_at = $now WHERE id = $id',
      { s: status, now: nowIso(), id });

    return { body: { id, deposit_kopecks: row.deposit_kopecks, deposit_status: status } };
  });
}
