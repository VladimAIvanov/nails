/* Работа студии: лист ожидания, отзывы, карточка клиентки, абонементы,
   лояльность, материалы, отчёты. */
import { all, get, run } from '../db.js';
import { badRequest, conflict, forbidden, notFound } from '../http.js';
import * as v from '../validate.js';
import { requireUser, requireRole, isMasterOnly, actsAsClient } from '../auth.js';
import { completeAppointment } from '../services/appointments.js';
import {
  addToWaitlist, listWaitlist, removeFromWaitlist,
  sellPass, clientPasses, passWithBalance,
  loyaltyBalance, loyaltyHistory, spendPoints,
  materialsList, moveMaterial, payroll, analytics
} from '../services/studio.js';
import { nowIso } from '../time.js';

export default function register(router) {
  // ── Завершение визита ─────────────────────────────────────────────────────

  /* Момент, когда визит превращается в факт: списывается абонемент,
     начисляются баллы, расходуются материалы. */
  router.post('/api/appointments/:id/complete', async ({ params, body, req }) => {
    const actor = requireUser(req);
    const outcome = body.outcome ? v.oneOf(body.outcome, 'outcome', ['done', 'no_show']) : 'done';
    return { body: completeAppointment({ actor, id: v.idParam(params.id), outcome }) };
  });

  // ── Лист ожидания ─────────────────────────────────────────────────────────

  router.post('/api/waitlist', async ({ body, req }) => {
    const actor = requireUser(req);
    const dateFrom = v.date(body.date_from, 'date_from');
    const dateTo = v.date(body.date_to, 'date_to');
    if (dateTo < dateFrom) throw badRequest('Поле «date_to» не может быть раньше «date_from»');

    return {
      status: 201,
      body: addToWaitlist({
        actor,
        input: {
          clientId: body.client_id ? v.idParam(body.client_id, 'client_id') : null,
          masterId: body.master_id ? v.idParam(body.master_id, 'master_id') : null,
          serviceId: v.idParam(body.service_id, 'service_id'),
          dateFrom, dateTo,
          partOfDay: body.part_of_day
            ? v.oneOf(body.part_of_day, 'part_of_day', ['any', 'morning', 'day', 'evening'])
            : 'any'
        }
      })
    };
  });

  router.get('/api/waitlist', async ({ req, query }) => {
    const actor = requireUser(req);
    const clientId = query.get('client_id') ? v.idParam(query.get('client_id'), 'client_id') : null;
    return { body: { entries: listWaitlist({ actor, clientId }) } };
  });

  router.delete('/api/waitlist/:id', async ({ params, req }) => {
    const actor = requireUser(req);
    return { body: removeFromWaitlist({ actor, id: v.idParam(params.id) }) };
  });

  // ── Отзывы ────────────────────────────────────────────────────────────────

  /* Одна кнопка вместо анкеты: оценка обязательна, текст — нет. */
  router.post('/api/appointments/:id/review', async ({ params, body, req }) => {
    const actor = requireRole(req, 'client');
    const id = v.idParam(params.id);
    const rating = v.int(body.rating, 'rating', { min: 1, max: 5 });
    const text = v.optionalStr(body.text, 'text', { max: 2000 });

    const appt = get('SELECT client_id, status FROM appointments WHERE id = $id', { id });
    if (!appt) throw notFound('Запись не найдена');
    if (appt.client_id !== actor.id) throw forbidden('Это чужая запись');
    if (appt.status !== 'done') throw conflict('Оценить можно только состоявшийся визит');

    try {
      run('INSERT INTO reviews (appointment_id, rating, text) VALUES ($id, $rating, $text)',
        { id, rating, text });
    } catch (err) {
      if (/UNIQUE/i.test(err.message)) throw conflict('Отзыв на этот визит уже оставлен');
      throw err;
    }

    return { status: 201, body: { appointment_id: id, rating } };
  });

  router.get('/api/masters/:id/reviews', async ({ params }) => {
    const masterId = v.idParam(params.id, 'master_id');
    const rating = get('SELECT * FROM master_ratings WHERE master_id = $id', { id: masterId })
      ?? { rating_avg: null, reviews_count: 0 };

    /* Наружу — только оценка, текст и месяц. Имя клиентки и дата визита
       не отдаются: по ним восстанавливается, кто и когда приходил. */
    const reviews = all(
      `SELECT r.rating, r.text, substr(r.created_at, 1, 7) AS month
         FROM reviews r JOIN appointments a ON a.id = r.appointment_id
        WHERE a.master_id = $id AND r.is_published = 1
        ORDER BY r.created_at DESC LIMIT 20`,
      { id: masterId }
    );

    return { body: { rating: rating.rating_avg, count: rating.reviews_count, reviews } };
  });

  // ── Карточка клиентки ─────────────────────────────────────────────────────

  /* Рабочие заметки мастера: аллергии, форма ногтей, формула покрытия.
     Клиентке не показываются — это не её профиль, а записная книжка студии. */
  router.get('/api/clients/:id/card', async ({ params, req }) => {
    const actor = requireRole(req, 'master', 'admin');
    const clientId = v.idParam(params.id, 'client_id');

    const client = get('SELECT id, full_name, phone FROM users WHERE id = $id', { id: clientId });
    if (!client) throw notFound('Клиент не найден');

    /* Мастер видит карточку только тех, кто к нему приходил. */
    if (isMasterOnly(actor)) {
      const seen = get(
        'SELECT COUNT(*) AS n FROM appointments WHERE client_id = $c AND master_id = $m',
        { c: clientId, m: actor.id }
      ).n;
      if (seen === 0) throw forbidden('Эта клиентка к вам не записывалась');
    }

    const card = get('SELECT * FROM client_cards WHERE client_id = $id', { id: clientId }) ?? {};
    const visits = all(
      `SELECT a.id, a.starts_at, a.status, a.master_note, s.title AS service, u.full_name AS master
         FROM appointments a
         JOIN services s ON s.id = a.service_id
         JOIN users u ON u.id = a.master_id
        WHERE a.client_id = $id ORDER BY a.starts_at DESC LIMIT 20`,
      { id: clientId }
    );
    const photos = all(
      `SELECT p.id, p.image_url, p.caption, p.is_public, a.starts_at
         FROM visit_photos p JOIN appointments a ON a.id = p.appointment_id
        WHERE a.client_id = $id ORDER BY a.starts_at DESC LIMIT 30`,
      { id: clientId }
    );

    return {
      body: {
        client,
        card: {
          allergies: card.allergies ?? null,
          nail_form: card.nail_form ?? null,
          preferences: card.preferences ?? null,
          contraindications: card.contraindications ?? null,
          updated_at: card.updated_at ?? null
        },
        loyalty_points: loyaltyBalance(clientId),
        passes: clientPasses(clientId),
        visits,
        photos
      }
    };
  });

  router.patch('/api/clients/:id/card', async ({ params, body, req }) => {
    const actor = requireRole(req, 'master', 'admin');
    const clientId = v.idParam(params.id, 'client_id');
    if (!get('SELECT id FROM users WHERE id = $id', { id: clientId })) throw notFound('Клиент не найден');

    run(`INSERT INTO client_cards (client_id) VALUES ($id) ON CONFLICT (client_id) DO NOTHING`,
      { id: clientId });
    run(
      `UPDATE client_cards SET
         allergies = COALESCE($allergies, allergies),
         nail_form = COALESCE($form, nail_form),
         preferences = COALESCE($prefs, preferences),
         contraindications = COALESCE($contra, contraindications),
         updated_by_id = $by, updated_at = $now
       WHERE client_id = $id`,
      {
        allergies: v.optionalStr(body.allergies, 'allergies', { max: 1000 }),
        form: v.optionalStr(body.nail_form, 'nail_form', { max: 200 }),
        prefs: v.optionalStr(body.preferences, 'preferences', { max: 1000 }),
        contra: v.optionalStr(body.contraindications, 'contraindications', { max: 1000 }),
        by: actor.id, now: nowIso(), id: clientId
      }
    );

    return { body: get('SELECT * FROM client_cards WHERE client_id = $id', { id: clientId }) };
  });

  /* Заметка мастера к конкретному визиту — формула покрытия, что делали. */
  router.patch('/api/appointments/:id/note', async ({ params, body, req }) => {
    const actor = requireRole(req, 'master', 'admin');
    const id = v.idParam(params.id);
    const appt = get('SELECT master_id FROM appointments WHERE id = $id', { id });
    if (!appt) throw notFound('Запись не найдена');
    if (isMasterOnly(actor) && appt.master_id !== actor.id) throw forbidden('Это чужая запись');

    run('UPDATE appointments SET master_note = $note, updated_at = $now WHERE id = $id',
      { note: v.optionalStr(body.master_note, 'master_note', { max: 2000 }), now: nowIso(), id });
    return { body: { id, saved: true } };
  });

  router.post('/api/appointments/:id/photos', async ({ params, body, req }) => {
    const actor = requireRole(req, 'master', 'admin');
    const id = v.idParam(params.id);
    const appt = get('SELECT master_id FROM appointments WHERE id = $id', { id });
    if (!appt) throw notFound('Запись не найдена');
    if (isMasterOnly(actor) && appt.master_id !== actor.id) throw forbidden('Это чужая запись');

    run(
      `INSERT INTO visit_photos (appointment_id, image_url, caption, is_public)
       VALUES ($id, $url, $caption, $public)`,
      {
        id, url: v.str(body.image_url, 'image_url', { max: 500 }),
        caption: v.optionalStr(body.caption, 'caption', { max: 200 }),
        public: v.bool(body.is_public, 'is_public') ?? 0
      }
    );
    return { status: 201, body: { appointment_id: id, saved: true } };
  });

  // ── Абонементы ────────────────────────────────────────────────────────────

  router.post('/api/passes', async ({ body, req }) => {
    const actor = requireUser(req);
    return {
      status: 201,
      body: sellPass({
        actor,
        input: {
          clientId: v.idParam(body.client_id, 'client_id'),
          serviceId: v.idParam(body.service_id, 'service_id'),
          totalVisits: v.int(body.total_visits, 'total_visits', { min: 1, max: 50 }),
          priceKopecks: v.int(body.price_kopecks, 'price_kopecks', { min: 0, max: 100_000_000 }),
          expiresOn: body.expires_on ? v.date(body.expires_on, 'expires_on') : null
        }
      })
    };
  });

  router.get('/api/passes', async ({ req, query }) => {
    const actor = requireUser(req);
    /* Проверка наличия параметра — до разбора: иначе клиент получал бы
       «некорректный client_id» вместо понятного «укажите client_id». */
    if (!actsAsClient(actor) && !query.get('client_id')) throw badRequest('Укажите client_id');
    const clientId = actsAsClient(actor) ? actor.id : v.idParam(query.get('client_id'), 'client_id');
    return { body: { passes: clientPasses(clientId) } };
  });

  router.get('/api/passes/:id', async ({ params, req }) => {
    const actor = requireUser(req);
    const pass = passWithBalance(v.idParam(params.id));
    if (actsAsClient(actor) && pass.client_id !== actor.id) throw forbidden('Это чужой абонемент');
    return { body: pass };
  });

  // ── Лояльность ────────────────────────────────────────────────────────────

  router.get('/api/loyalty', async ({ req, query }) => {
    const actor = requireUser(req);
    if (!actsAsClient(actor) && !query.get('client_id')) throw badRequest('Укажите client_id');
    const clientId = actsAsClient(actor) ? actor.id : v.idParam(query.get('client_id'), 'client_id');

    return {
      body: { balance: loyaltyBalance(clientId), history: loyaltyHistory(clientId) }
    };
  });

  router.post('/api/loyalty/spend', async ({ body, req }) => {
    const actor = requireUser(req);
    return {
      body: spendPoints({
        actor,
        clientId: v.idParam(body.client_id, 'client_id'),
        points: v.int(body.points, 'points', { min: 1, max: 100_000 }),
        comment: v.optionalStr(body.comment, 'comment', { max: 200 })
      })
    };
  });

  // ── Материалы ─────────────────────────────────────────────────────────────

  router.get('/api/admin/materials', async ({ req }) => {
    requireRole(req, 'admin', 'master');
    const list = materialsList();
    return { body: { materials: list, low_stock: list.filter((m) => m.low) } };
  });

  router.post('/api/admin/materials', async ({ body, req }) => {
    requireRole(req, 'admin');
    run(
      `INSERT INTO materials (title, unit, min_qty, price_kopecks) VALUES ($title, $unit, $min, $price)`,
      {
        title: v.str(body.title, 'title', { max: 120 }),
        unit: v.optionalStr(body.unit, 'unit', { max: 20 }) ?? 'шт',
        min: v.int(body.min_qty ?? 0, 'min_qty', { min: 0, max: 100_000 }),
        price: v.int(body.price_kopecks ?? 0, 'price_kopecks', { min: 0, max: 100_000_000 })
      }
    );
    return { status: 201, body: get('SELECT * FROM materials WHERE id = last_insert_rowid()') };
  });

  router.post('/api/admin/materials/:id/movement', async ({ params, body, req }) => {
    const actor = requireRole(req, 'admin', 'master');
    return {
      body: moveMaterial({
        actor,
        materialId: v.idParam(params.id),
        delta: v.int(body.delta, 'delta', { min: -100_000, max: 100_000 }),
        reason: v.oneOf(body.reason, 'reason', ['purchase', 'writeoff', 'correction']),
        comment: v.optionalStr(body.comment, 'comment', { max: 200 })
      })
    };
  });

  /* Нормы расхода: сколько чего уходит на одну услугу. */
  router.put('/api/admin/services/:id/materials', async ({ params, body, req }) => {
    requireRole(req, 'admin');
    const serviceId = v.idParam(params.id, 'service_id');
    if (!get('SELECT id FROM services WHERE id = $id', { id: serviceId })) throw notFound('Услуга не найдена');
    if (!Array.isArray(body.materials)) throw badRequest('Поле «materials»: список');

    run('DELETE FROM service_materials WHERE service_id = $id', { id: serviceId });
    for (const item of body.materials) {
      run('INSERT INTO service_materials (service_id, material_id, qty) VALUES ($s, $m, $q)',
        {
          s: serviceId,
          m: v.idParam(item.material_id, 'material_id'),
          q: v.int(item.qty, 'qty', { min: 1, max: 1000 })
        });
    }
    return {
      body: {
        service_id: serviceId,
        materials: all('SELECT * FROM service_materials WHERE service_id = $id', { id: serviceId })
      }
    };
  });

  // ── Отчёты ────────────────────────────────────────────────────────────────

  router.get('/api/admin/payroll', async ({ req, query }) => {
    const actor = requireRole(req, 'admin', 'master');
    const from = v.date(query.get('from'), 'from');
    const to = v.date(query.get('to'), 'to');
    /* Мастер видит только своё вознаграждение — чужие заработки не его дело. */
    const masterId = isMasterOnly(actor)
      ? actor.id
      : (query.get('master_id') ? v.idParam(query.get('master_id'), 'master_id') : null);
    return { body: payroll({ from, to, masterId }) };
  });

  router.get('/api/admin/analytics', async ({ req, query }) => {
    requireRole(req, 'admin');
    return {
      body: analytics({ from: v.date(query.get('from'), 'from'), to: v.date(query.get('to'), 'to') })
    };
  });
}
