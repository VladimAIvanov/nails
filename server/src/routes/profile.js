/* Профиль клиента: свои данные, избранные мастера, подписки на окна,
   согласия, смена пароля и список сеансов.

   Всё это было в схеме и на экранах прототипа, но управлять этим
   через API было нельзя. */
import { all, get, run } from '../db.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../http.js';
import * as v from '../validate.js';
import { requireUser, hashPassword, verifyPassword, createSession } from '../auth.js';
import { nowIso } from '../time.js';

export default function register(router) {
  // ── Свои данные ───────────────────────────────────────────────────────────

  router.patch('/api/profile', async ({ body, req }) => {
    const actor = requireUser(req);
    const updates = {};

    if (body.full_name !== undefined) updates.full_name = v.str(body.full_name, 'full_name', { min: 2, max: 120 });
    if (body.email !== undefined) updates.email = body.email === null ? null : v.email(body.email);
    if (body.photo_url !== undefined) updates.photo_url = v.optionalStr(body.photo_url, 'photo_url', { max: 500 });
    if (body.telegram_username !== undefined) {
      updates.telegram_username = v.optionalStr(body.telegram_username, 'telegram_username', { max: 60 });
    }

    if (Object.keys(updates).length === 0) throw badRequest('Нечего менять');

    /* Телефон не меняется здесь: это логин, и по нему объединяются гостевые
       записи. Смена телефона — отдельный сценарий с подтверждением. */
    if (updates.email && get('SELECT id FROM users WHERE email = $e AND id <> $id',
      { e: updates.email, id: actor.id })) {
      throw conflict('Эта почта уже занята');
    }

    const columns = Object.keys(updates).map((k) => `${k} = $${k}`).join(', ');
    run(`UPDATE users SET ${columns}, updated_at = $now WHERE id = $id`,
      { ...updates, now: nowIso(), id: actor.id });

    return {
      body: get('SELECT id, role, full_name, phone, email, photo_url, telegram_username FROM users WHERE id = $id',
        { id: actor.id })
    };
  });

  /* Смена пароля закрывает все прежние сеансы: поле password_changed_at
     сравнивается с issued_at сеанса при каждой проверке. Текущему устройству
     выдаётся новый токен, чтобы человека не выбросило из приложения. */
  router.post('/api/profile/password', async ({ body, req }) => {
    const actor = requireUser(req);
    const current = v.str(body.current_password, 'current_password', { max: 200 });
    const next = v.password(body.new_password, 'new_password');

    const user = get('SELECT password_hash FROM users WHERE id = $id', { id: actor.id });
    if (!verifyPassword(current, user.password_hash)) {
      throw unauthorized('Текущий пароль неверен');
    }
    if (current === next) throw badRequest('Новый пароль совпадает с текущим');

    /* Сеансы закрываются явно, а не только отметкой времени. Отметка
       остаётся второй линией защиты, но полагаться на неё одну нельзя:
       время хранится с точностью до секунды, и сеанс, открытый в ту же
       секунду, что и смена пароля, проходил бы проверку issued_at >= changed_at. */
    run('UPDATE users SET password_hash = $hash, password_changed_at = $now, updated_at = $now WHERE id = $id',
      { hash: hashPassword(next), now: nowIso(), id: actor.id });
    const closed = run(
      'UPDATE sessions SET revoked_at = $now WHERE user_id = $id AND revoked_at IS NULL',
      { now: nowIso(), id: actor.id }
    ).changes;

    const session = createSession(actor.id, {
      userAgent: req.headers['user-agent'] ?? null,
      ip: req.socket.remoteAddress ?? null
    });

    return { body: { ok: true, sessions_closed: closed, ...session } };
  });

  router.get('/api/profile/sessions', async ({ req }) => {
    const actor = requireUser(req);
    return {
      body: {
        sessions: all(
          `SELECT id, issued_at, expires_at, user_agent, ip FROM sessions
            WHERE user_id = $id AND revoked_at IS NULL AND expires_at > $now
            ORDER BY issued_at DESC`,
          { id: actor.id, now: nowIso() }
        )
      }
    };
  });

  router.delete('/api/profile/sessions/:id', async ({ params, req }) => {
    const actor = requireUser(req);
    const id = v.idParam(params.id);
    const row = get('SELECT user_id FROM sessions WHERE id = $id', { id });
    if (!row) throw notFound('Сеанс не найден');
    if (row.user_id !== actor.id) throw forbidden('Это чужой сеанс');
    run('UPDATE sessions SET revoked_at = $now WHERE id = $id', { now: nowIso(), id });
    return { body: { ok: true, revoked: id } };
  });

  // ── Избранные мастера ─────────────────────────────────────────────────────

  router.get('/api/profile/favorites', async ({ req }) => {
    const actor = requireUser(req);
    return {
      body: {
        masters: all(
          `SELECT u.id, u.full_name, mp.photo_url, r.rating_avg, r.reviews_count
             FROM favorite_masters f
             JOIN master_profiles mp ON mp.user_id = f.master_id
             JOIN users u ON u.id = f.master_id
             LEFT JOIN master_ratings r ON r.master_id = f.master_id
            WHERE f.client_id = $id ORDER BY f.created_at DESC`,
          { id: actor.id }
        )
      }
    };
  });

  router.post('/api/profile/favorites/:masterId', async ({ params, req }) => {
    const actor = requireUser(req);
    const masterId = v.idParam(params.masterId, 'master_id');
    if (!get('SELECT user_id FROM master_profiles WHERE user_id = $id', { id: masterId })) {
      throw notFound('Мастер не найден');
    }
    run(`INSERT INTO favorite_masters (client_id, master_id) VALUES ($c, $m)
         ON CONFLICT (client_id, master_id) DO NOTHING`,
      { c: actor.id, m: masterId });
    return { status: 201, body: { ok: true, master_id: masterId } };
  });

  router.delete('/api/profile/favorites/:masterId', async ({ params, req }) => {
    const actor = requireUser(req);
    const masterId = v.idParam(params.masterId, 'master_id');
    const changes = run('DELETE FROM favorite_masters WHERE client_id = $c AND master_id = $m',
      { c: actor.id, m: masterId }).changes;
    if (changes === 0) throw notFound('Мастера нет в избранном');
    return { body: { ok: true } };
  });

  // ── Подписка на новые окна ────────────────────────────────────────────────

  /* Переключатель «Новые окна у Варвары» из профиля. Состояние — наличие
     активной строки, отдельного флага нет: он был бы вторым выключателем
     одной лампы (раздел 10 схемы). */
  router.get('/api/profile/slot-subscriptions', async ({ req }) => {
    const actor = requireUser(req);
    return {
      body: {
        subscriptions: all(
          `SELECT s.id, s.master_id, u.full_name AS master_name, s.service_id,
                  s.date_from, s.date_to, s.notified_at
             FROM slot_subscriptions s JOIN users u ON u.id = s.master_id
            WHERE s.client_id = $id AND s.is_active = 1`,
          { id: actor.id }
        )
      }
    };
  });

  router.post('/api/profile/slot-subscriptions', async ({ body, req }) => {
    const actor = requireUser(req);
    const masterId = v.idParam(body.master_id, 'master_id');
    if (!get('SELECT user_id FROM master_profiles WHERE user_id = $id', { id: masterId })) {
      throw notFound('Мастер не найден');
    }

    try {
      run(
        `INSERT INTO slot_subscriptions (client_id, master_id, service_id, date_from, date_to)
         VALUES ($c, $m, $s, $from, $to)`,
        {
          c: actor.id, m: masterId,
          s: body.service_id ? v.idParam(body.service_id, 'service_id') : null,
          from: body.date_from ? v.date(body.date_from, 'date_from') : null,
          to: body.date_to ? v.date(body.date_to, 'date_to') : null
        }
      );
    } catch (err) {
      if (/UNIQUE/i.test(err.message)) throw conflict('Подписка на этого мастера уже есть');
      throw err;
    }

    return { status: 201, body: get('SELECT * FROM slot_subscriptions WHERE id = last_insert_rowid()') };
  });

  router.delete('/api/profile/slot-subscriptions/:id', async ({ params, req }) => {
    const actor = requireUser(req);
    const id = v.idParam(params.id);
    const row = get('SELECT client_id FROM slot_subscriptions WHERE id = $id', { id });
    if (!row) throw notFound('Подписка не найдена');
    if (row.client_id !== actor.id) throw forbidden('Это чужая подписка');
    run('UPDATE slot_subscriptions SET is_active = 0 WHERE id = $id', { id });
    return { body: { ok: true } };
  });

  // ── Согласия ──────────────────────────────────────────────────────────────

  /* 152-ФЗ: человек должен видеть, на что согласился, и мочь отозвать. */
  router.get('/api/profile/consents', async ({ req }) => {
    const actor = requireUser(req);
    return {
      body: {
        consents: all(
          `SELECT kind, is_granted, document_version, source, changed_at
             FROM consents WHERE user_id = $id ORDER BY changed_at DESC`,
          { id: actor.id }
        )
      }
    };
  });

  router.post('/api/profile/consents', async ({ body, req }) => {
    const actor = requireUser(req);
    const kind = v.oneOf(body.kind, 'kind', ['personal_data', 'marketing']);
    const granted = v.bool(body.is_granted, 'is_granted');
    if (granted === null) throw badRequest('Поле «is_granted» обязательно');

    /* Отзыв согласия на обработку данных означает удаление профиля,
       а это отдельный сценарий с судьбой истории визитов. */
    if (kind === 'personal_data' && granted === 0) {
      throw conflict('Отзыв согласия на обработку данных оформляется через студию');
    }

    run(
      `INSERT INTO consents (user_id, kind, is_granted, document_version, source)
       VALUES ($id, $kind, $granted, 'v1', 'site')`,
      { id: actor.id, kind, granted }
    );
    if (kind === 'marketing') {
      run(`INSERT INTO notification_prefs (user_id) VALUES ($id) ON CONFLICT (user_id) DO NOTHING`,
        { id: actor.id });
      run('UPDATE notification_prefs SET marketing = $g, updated_at = $now WHERE user_id = $id',
        { g: granted, now: nowIso(), id: actor.id });
    }

    return { status: 201, body: { kind, is_granted: granted === 1 } };
  });

  // ── Один мастер ───────────────────────────────────────────────────────────

  router.get('/api/masters/:id', async ({ params }) => {
    const id = v.idParam(params.id, 'master_id');
    const master = get(
      `SELECT u.id, u.full_name, mp.bio, mp.photo_url, mp.accepts_online_booking,
              r.rating_avg, r.reviews_count
         FROM master_profiles mp JOIN users u ON u.id = mp.user_id
         LEFT JOIN master_ratings r ON r.master_id = mp.user_id
        WHERE mp.user_id = $id AND u.is_active = 1`,
      { id }
    );
    if (!master) throw notFound('Мастер не найден');

    return {
      body: {
        ...master,
        accepts_online_booking: master.accepts_online_booking === 1,
        services: all(
          `SELECT s.id, s.title, s.duration_min, s.price_kopecks, s.price_is_from
             FROM master_services ms JOIN services s ON s.id = ms.service_id
            WHERE ms.master_id = $id AND ms.is_active = 1 AND s.is_active = 1
            ORDER BY s.sort_order`,
          { id }
        ),
        works: all(
          `SELECT id, image_url, title FROM portfolio_works
            WHERE master_id = $id AND is_published = 1 ORDER BY sort_order LIMIT 8`,
          { id }
        )
      }
    };
  });
}
