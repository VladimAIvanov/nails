/* Административные адреса. Все требуют роль admin. */
import { all, get, run, transaction } from '../db.js';
import { badRequest, conflict, notFound } from '../http.js';
import * as v from '../validate.js';
import { requireRole, hashPassword } from '../auth.js';
import { getSettings } from '../slots.js';
import { createAppointment, confirmAppointment } from '../services/appointments.js';
import { nowIso, utcToLocal } from '../time.js';

const STATUSES = ['pending', 'confirmed', 'done', 'cancelled', 'no_show'];

/* «1 запись», «2 записи», «5 записей». Сообщение об отказе читает человек,
   и «5 запись» в нём выглядит как недоделка. */
function plural(n, one, few, many) {
  const last = n % 10;
  const two = n % 100;
  if (last === 1 && two !== 11) return `${n} ${one}`;
  if (last >= 2 && last <= 4 && (two < 12 || two > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

/* Перечисление того, что держит строку: «3 записи и 1 абонемент». */
const listLinks = (parts) => parts.filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' и $1');

export default function register(router) {
  /* Все записи студии с фильтрами — экран «Записи» в панели. */
  router.get('/api/admin/appointments', async ({ req, query }) => {
    requireRole(req, 'admin');
    const settings = getSettings();

    const status = query.get('status') ? v.oneOf(query.get('status'), 'status', STATUSES) : null;
    const date = query.get('date') ? v.date(query.get('date')) : null;
    const masterId = query.get('master_id') ? v.idParam(query.get('master_id'), 'master_id') : null;
    const search = query.get('search') ? v.str(query.get('search'), 'search', { max: 100 }) : null;
    const limit = query.get('limit') ? v.int(query.get('limit'), 'limit', { min: 1, max: 200 }) : 50;

    const rows = all(
      `SELECT a.id, a.public_number, a.starts_at, a.ends_at, a.duration_min, a.price_kopecks,
              a.status, a.source, a.created_at,
              s.title AS service_title, mu.full_name AS master_name, a.master_id,
              cu.id AS client_id, cu.full_name AS client_name, cu.phone AS client_phone,
              l.title AS status_title, l.color_token
         FROM appointments a
         JOIN services s ON s.id = a.service_id
         JOIN users mu ON mu.id = a.master_id
         JOIN users cu ON cu.id = a.client_id
         JOIN appointment_status_labels l ON l.status = a.status
        WHERE ($status IS NULL OR a.status = $status)
          AND ($master IS NULL OR a.master_id = $master)
          AND ($date IS NULL OR substr(a.starts_at, 1, 10) = $date)
          AND ($search IS NULL OR cu.full_name LIKE '%' || $search || '%'
                               OR cu.phone LIKE '%' || $search || '%')
        ORDER BY a.starts_at DESC
        LIMIT $limit`,
      { status, master: masterId, date, search, limit }
    );

    const summary = get(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
              SUM(CASE WHEN status = 'confirmed' THEN price_kopecks ELSE 0 END) AS expected_kopecks
         FROM appointments
        WHERE ($date IS NULL OR substr(starts_at, 1, 10) = $date)`,
      { date }
    );

    return {
      body: {
        summary: {
          total: summary.total,
          pending: summary.pending ?? 0,
          expected_revenue_kopecks: summary.expected_kopecks ?? 0
        },
        appointments: rows.map((r) => ({
          id: r.id,
          number: r.public_number,
          starts_at: r.starts_at,
          ends_at: r.ends_at,
          local: utcToLocal(new Date(r.starts_at), settings.timezone),
          duration_min: r.duration_min,
          price_kopecks: r.price_kopecks,
          status: r.status,
          status_title: r.status_title,
          status_color: r.color_token,
          source: r.source,
          service: r.service_title,
          master: { id: r.master_id, name: r.master_name },
          client: { id: r.client_id, name: r.client_name, phone: r.client_phone }
        }))
      }
    };
  });

  /* Создание записи администратором. Сохранение — той же функцией
     createAppointment, что и у клиента с мастером; отличается только набор
     полей, которые обработчик соглашается принять.

     allow_overlap читается ровно здесь и нигде больше, а попасть сюда может
     лишь admin — проверка ролью в первой строке. */
  router.post('/api/admin/appointments', async ({ body, req }) => {
    const actor = requireRole(req, 'admin');
    const settings = getSettings();
    const startsAt = v.isoUtc(body.starts_at);

    const result = createAppointment({
      actor,
      input: {
        clientId: v.idParam(body.client_id, 'client_id'),
        masterId: v.idParam(body.master_id, 'master_id'),
        serviceIds: v.idList(body.service_ids, 'service_ids'),
        startsAt,
        comment: v.optionalStr(body.comment, 'comment', { max: 1000 }),
        allowOverlap: v.bool(body.allow_overlap, 'allow_overlap') === 1,
        status: body.status ? v.oneOf(body.status, 'status', ['pending', 'confirmed']) : undefined
      }
    });

    return {
      status: 201,
      body: {
        appointment_ids: result.ids,
        allow_overlap: result.allowOverlap,
        status: result.status,
        starts_at: startsAt,
        local: utcToLocal(new Date(startsAt), settings.timezone)
      }
    };
  });

  /* Подтверждение записи — кнопка «Подтвердить» в таблице. */
  router.post('/api/admin/appointments/:id/confirm', async ({ params, req }) => {
    const actor = requireRole(req, 'admin');
    return { body: confirmAppointment({ actor, id: v.idParam(params.id) }) };
  });

  // ── Услуги ────────────────────────────────────────────────────────────────

  router.get('/api/admin/services', async ({ req }) => {
    requireRole(req, 'admin');
    return {
      body: {
        services: all(
          `SELECT s.*, c.title AS category_title FROM services s
             JOIN service_categories c ON c.id = s.category_id ORDER BY s.sort_order`
        )
      }
    };
  });

  router.post('/api/admin/services', async ({ body, req }) => {
    requireRole(req, 'admin');
    const slug = v.slug(body.slug);
    const title = v.str(body.title, 'title', { max: 120 });
    const categoryId = v.idParam(body.category_id, 'category_id');
    const duration = v.int(body.duration_min, 'duration_min', { min: 5, max: 600 });
    const price = v.int(body.price_kopecks, 'price_kopecks', { min: 0, max: 100_000_000 });
    const description = v.optionalStr(body.description, 'description', { max: 500 });
    const buffer = body.buffer_after_min === undefined ? null
      : v.int(body.buffer_after_min, 'buffer_after_min', { min: 0, max: 120 });

    if (duration % 5 !== 0) throw badRequest('Поле «duration_min»: кратно 5 минутам');
    if (!get('SELECT id FROM service_categories WHERE id = $id', { id: categoryId })) {
      throw notFound('Категория не найдена');
    }
    if (get('SELECT id FROM services WHERE slug = $slug', { slug })) {
      throw conflict('Услуга с таким slug уже есть');
    }

    run(
      `INSERT INTO services (category_id, slug, title, description, duration_min,
                             price_kopecks, buffer_after_min, is_online_bookable, sort_order)
       VALUES ($cat, $slug, $title, $desc, $dur, $price, $buffer, $online, $sort)`,
      {
        cat: categoryId, slug, title, desc: description, dur: duration, price, buffer,
        online: v.bool(body.is_online_bookable, 'is_online_bookable') ?? 1,
        sort: body.sort_order ?? 100
      }
    );

    return { status: 201, body: get('SELECT * FROM services WHERE slug = $slug', { slug }) };
  });

  router.patch('/api/admin/services/:id', async ({ params, body, req }) => {
    requireRole(req, 'admin');
    const id = v.idParam(params.id);
    const current = get('SELECT * FROM services WHERE id = $id', { id });
    if (!current) throw notFound('Услуга не найдена');

    const patch = {
      title: body.title === undefined ? current.title : v.str(body.title, 'title', { max: 120 }),
      description: body.description === undefined ? current.description
        : v.optionalStr(body.description, 'description', { max: 500 }),
      duration_min: body.duration_min === undefined ? current.duration_min
        : v.int(body.duration_min, 'duration_min', { min: 5, max: 600 }),
      price_kopecks: body.price_kopecks === undefined ? current.price_kopecks
        : v.int(body.price_kopecks, 'price_kopecks', { min: 0, max: 100_000_000 }),
      buffer_after_min: body.buffer_after_min === undefined ? current.buffer_after_min
        : v.int(body.buffer_after_min, 'buffer_after_min', { min: 0, max: 120 }),
      is_active: body.is_active === undefined ? current.is_active : v.bool(body.is_active, 'is_active'),
      is_online_bookable: body.is_online_bookable === undefined ? current.is_online_bookable
        : v.bool(body.is_online_bookable, 'is_online_bookable')
    };

    if (patch.duration_min % 5 !== 0) throw badRequest('Поле «duration_min»: кратно 5 минутам');

    run(
      `UPDATE services SET title = $title, description = $description, duration_min = $duration_min,
              price_kopecks = $price_kopecks, buffer_after_min = $buffer_after_min,
              is_active = $is_active, is_online_bookable = $is_online_bookable, updated_at = $now
        WHERE id = $id`,
      { ...patch, now: nowIso(), id }
    );

    return { body: get('SELECT * FROM services WHERE id = $id', { id }) };
  });

  /* Что произойдёт по кнопке «Удалить», решает сервер, а не тот, кто нажал.

     Администратор не обязан помнить, есть ли по услуге записи, — и не должен
     получать отказ с советом «сделайте PATCH is_active=false»: это не ответ
     человеку, а инструкция программисту. Поэтому здесь два исхода, и оба
     успешные: строку без ссылок сервер удаляет, строку с историей отключает
     и объясняет, почему.

     Справочник отвечает на вопрос, что студия предлагает сейчас; записи —
     что происходило раньше. Стереть услугу значит оставить прошлые визиты
     без названия: у них снимок цены и длительности, но не имени. */
  router.delete('/api/admin/services/:id', async ({ params, req }) => {
    requireRole(req, 'admin');
    const id = v.idParam(params.id);
    const service = get('SELECT id, title, is_active FROM services WHERE id = $id', { id });
    if (!service) throw notFound('Услуга не найдена');

    /* Три таблицы держат услугу намертво (ON DELETE RESTRICT): записи,
       регулярные серии и абонементы. Считаем их до попытки удаления —
       иначе в объяснении будет нечего назвать. */
    const links = get(
      `SELECT (SELECT COUNT(*) FROM appointments     WHERE service_id = $id) AS appointments,
              (SELECT COUNT(*) FROM recurring_series WHERE service_id = $id) AS recurring,
              (SELECT COUNT(*) FROM passes           WHERE service_id = $id) AS passes`,
      { id }
    );
    const held = links.appointments + links.recurring + links.passes;

    if (held === 0) {
      try {
        run('DELETE FROM services WHERE id = $id', { id });
        return {
          body: {
            deleted: true,
            disabled: false,
            id,
            message: `Услуга «${service.title}» удалена: на неё никто не ссылался`
          }
        };
      } catch (err) {
        /* Ссылка нашлась там, где мы не считали. Это не повод показывать
           человеку ошибку базы: исход тот же — отключаем. */
        if (!/FOREIGN KEY/i.test(err.message)) throw err;
      }
    }

    run('UPDATE services SET is_active = 0, updated_at = $now WHERE id = $id', { now: nowIso(), id });

    const what = listLinks([
      links.appointments ? plural(links.appointments, 'запись', 'записи', 'записей') : null,
      links.recurring ? plural(links.recurring, 'регулярная серия', 'регулярные серии', 'регулярных серий') : null,
      links.passes ? plural(links.passes, 'абонемент', 'абонемента', 'абонементов') : null
    ]);

    return {
      body: {
        deleted: false,
        disabled: true,
        id,
        references: links,
        message: what
          ? `Удалить услугу «${service.title}» нельзя: на неё ссылается история студии — ${what}. Иначе прошлые визиты потеряют название. Услуга отключена: клиентам она больше не видна, а сами визиты остались как были`
          : `Услугу «${service.title}» удалить не вышло: на неё ещё что-то ссылается. Она отключена — клиентам не видна, в списке студии осталась`
      }
    };
  });

  // ── Мастера ───────────────────────────────────────────────────────────────

  /* Список мастеров вместе с закреплёнными услугами.

     Раньше отдавался только счётчик, и экрану правки приходилось бы
     дозапрашивать состав по каждому мастеру — да ещё клиентским адресом,
     который отключённые услуги не показывает. Здесь нужны все: снятая
     с публикации услуга всё равно остаётся закреплённой за мастером. */
  router.get('/api/admin/masters', async ({ req }) => {
    requireRole(req, 'admin');
    const masters = all(
      `SELECT u.id, u.full_name, u.email, u.phone, u.is_active,
              mp.accepts_online_booking, mp.uses_studio_hours, mp.sort_order,
              (SELECT COUNT(*) FROM master_services ms WHERE ms.master_id = mp.user_id) AS services_count
         FROM master_profiles mp JOIN users u ON u.id = mp.user_id
        ORDER BY mp.sort_order`
    );

    const links = all(
      'SELECT master_id, service_id FROM master_services WHERE is_active = 1 ORDER BY service_id'
    );

    return {
      body: {
        masters: masters.map((m) => ({
          ...m,
          service_ids: links.filter((l) => l.master_id === m.id).map((l) => l.service_id)
        }))
      }
    };
  });

  router.post('/api/admin/masters', async ({ body, req }) => {
    requireRole(req, 'admin');
    const fullName = v.str(body.full_name, 'full_name', { min: 2, max: 120 });
    const email = v.email(body.email);
    const phoneNumber = v.phone(body.phone);
    const password = v.password(body.password);
    const serviceIds = body.service_ids === undefined ? [] : v.idList(body.service_ids, 'service_ids', { min: 0, max: 50 });

    if (get('SELECT id FROM users WHERE email = $email', { email })) {
      throw conflict('Пользователь с такой почтой уже есть');
    }
    if (get('SELECT id FROM users WHERE phone = $phone', { phone: phoneNumber })) {
      throw conflict('Пользователь с таким телефоном уже есть');
    }

    const id = transaction(() => {
      run(
        `INSERT INTO users (role, full_name, email, phone, password_hash, password_changed_at)
         VALUES ('master', $name, $email, $phone, $hash, $now)`,
        { name: fullName, email, phone: phoneNumber, hash: hashPassword(password), now: nowIso() }
      );
      const userId = get('SELECT id FROM users WHERE email = $email', { email }).id;
      run('INSERT INTO master_profiles (user_id, sort_order) VALUES ($id, $sort)',
        { id: userId, sort: body.sort_order ?? 100 });
      for (const serviceId of serviceIds) {
        if (!get('SELECT id FROM services WHERE id = $id', { id: serviceId })) {
          throw notFound(`Услуга ${serviceId} не найдена`);
        }
        run('INSERT INTO master_services (master_id, service_id) VALUES ($m, $s)',
          { m: userId, s: serviceId });
      }
      return userId;
    });

    return {
      status: 201,
      body: get('SELECT id, full_name, email, phone, role FROM users WHERE id = $id', { id })
    };
  });

  router.patch('/api/admin/masters/:id', async ({ params, body, req }) => {
    requireRole(req, 'admin');
    const id = v.idParam(params.id);
    const profile = get('SELECT * FROM master_profiles WHERE user_id = $id', { id });
    if (!profile) throw notFound('Мастер не найден');

    transaction(() => {
      if (body.full_name !== undefined) {
        run('UPDATE users SET full_name = $name, updated_at = $now WHERE id = $id',
          { name: v.str(body.full_name, 'full_name', { max: 120 }), now: nowIso(), id });
      }
      if (body.is_active !== undefined) {
        run('UPDATE users SET is_active = $a, updated_at = $now WHERE id = $id',
          { a: v.bool(body.is_active, 'is_active'), now: nowIso(), id });
      }
      const fields = {
        accepts_online_booking: body.accepts_online_booking === undefined ? profile.accepts_online_booking
          : v.bool(body.accepts_online_booking, 'accepts_online_booking'),
        uses_studio_hours: body.uses_studio_hours === undefined ? profile.uses_studio_hours
          : v.bool(body.uses_studio_hours, 'uses_studio_hours'),
        sort_order: body.sort_order === undefined ? profile.sort_order
          : v.int(body.sort_order, 'sort_order', { min: 0, max: 10_000 })
      };
      run(
        `UPDATE master_profiles SET accepts_online_booking = $accepts_online_booking,
                uses_studio_hours = $uses_studio_hours, sort_order = $sort_order, updated_at = $now
          WHERE user_id = $id`,
        { ...fields, now: nowIso(), id }
      );

      if (body.service_ids !== undefined) {
        const ids = v.idList(body.service_ids, 'service_ids', { min: 0, max: 50 });
        run('DELETE FROM master_services WHERE master_id = $id', { id });
        for (const serviceId of ids) {
          if (!get('SELECT id FROM services WHERE id = $id', { id: serviceId })) {
            throw notFound(`Услуга ${serviceId} не найдена`);
          }
          run('INSERT INTO master_services (master_id, service_id) VALUES ($m, $s)',
            { m: id, s: serviceId });
        }
      }
    });

    return {
      body: get(
        `SELECT u.id, u.full_name, u.email, u.phone, u.is_active,
                mp.accepts_online_booking, mp.uses_studio_hours, mp.sort_order
           FROM master_profiles mp JOIN users u ON u.id = mp.user_id WHERE mp.user_id = $id`,
        { id }
      )
    };
  });

  /* С мастером ровно то же, что и с услугой: решает сервер.

     Разница одна — у мастера бывают предстоящие визиты, и про них нужно
     сказать отдельно. Отключённый мастер исчезает из выбора при записи,
     но уже записанные к нему клиентки никуда не деваются: с ними придётся
     разбираться руками, и администратор должен об этом узнать. */
  router.delete('/api/admin/masters/:id', async ({ params, req }) => {
    requireRole(req, 'admin');
    const id = v.idParam(params.id);
    const master = get(
      `SELECT u.id, u.full_name FROM master_profiles mp
         JOIN users u ON u.id = mp.user_id WHERE mp.user_id = $id`,
      { id }
    );
    if (!master) throw notFound('Мастер не найден');

    const links = get(
      `SELECT (SELECT COUNT(*) FROM appointments WHERE master_id = $id) AS appointments,
              (SELECT COUNT(*) FROM appointments
                WHERE master_id = $id AND status IN ('pending', 'confirmed')
                  AND starts_at >= $now) AS upcoming`,
      { id, now: nowIso() }
    );

    if (links.appointments === 0) {
      try {
        transaction(() => {
          run('DELETE FROM master_profiles WHERE user_id = $id', { id });
          run('DELETE FROM users WHERE id = $id', { id });
        });
        return {
          body: {
            deleted: true,
            disabled: false,
            id,
            message: `Мастер ${master.full_name} удалён из списка: записей за ним не числилось`
          }
        };
      } catch (err) {
        if (!/FOREIGN KEY/i.test(err.message)) throw err;
      }
    }

    run('UPDATE users SET is_active = 0, updated_at = $now WHERE id = $id', { now: nowIso(), id });

    const upcoming = links.upcoming
      ? ` Предстоящих визитов: ${links.upcoming} — их нужно перенести или отменить вручную.`
      : '';

    return {
      body: {
        deleted: false,
        disabled: true,
        id,
        references: links,
        message: `Удалить мастера ${master.full_name} нельзя: за ним числится история студии — ${plural(links.appointments, 'запись', 'записи', 'записей')}. Иначе прошлые визиты потеряют исполнителя. Мастер отключён: при записи его больше не предложат.${upcoming}`
      }
    };
  });
}



