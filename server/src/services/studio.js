/* Работа студии поверх записей: лист ожидания, абонементы, лояльность,
   материалы, отчёты. Всё, что происходит вокруг визита, а не в нём. */
import { all, get, run, transaction } from '../db.js';
import { badRequest, conflict, forbidden, notFound } from '../http.js';
import { getSettings } from '../slots.js';
import { nowIso, utcToLocal } from '../time.js';

// ── Лист ожидания ───────────────────────────────────────────────────────────

/* Освободилось время — кому предложить. Совпадение по услуге, мастеру
   (или «любой»), дате и времени суток. */
export function matchWaitlist({ masterId, serviceId, startsAt }) {
  const settings = getSettings();
  const local = utcToLocal(new Date(startsAt), settings.timezone);
  const hour = Number(local.time.slice(0, 2));
  const part = hour < 12 ? 'morning' : hour < 17 ? 'day' : 'evening';

  return all(
    `SELECT w.*, u.full_name AS client_name
       FROM waitlist_entries w
       JOIN users u ON u.id = w.client_id
      WHERE w.is_active = 1
        AND w.service_id = $service
        AND (w.master_id IS NULL OR w.master_id = $master)
        AND $date BETWEEN w.date_from AND w.date_to
        AND (w.part_of_day = 'any' OR w.part_of_day = $part)
        AND w.client_id <> $excludeNothing
      ORDER BY w.created_at`,
    { service: serviceId, master: masterId, date: local.date, part, excludeNothing: -1 }
  );
}

export function addToWaitlist({ actor, input }) {
  const clientId = actor.role === 'client' ? actor.id : input.clientId;
  if (!clientId) throw badRequest('Не указан клиент');
  if (!get('SELECT id FROM services WHERE id = $id AND is_active = 1', { id: input.serviceId })) {
    throw notFound('Услуга не найдена');
  }
  if (input.masterId && !get('SELECT user_id FROM master_profiles WHERE user_id = $id', { id: input.masterId })) {
    throw notFound('Мастер не найден');
  }

  try {
    run(
      `INSERT INTO waitlist_entries (client_id, master_id, service_id, date_from, date_to, part_of_day)
       VALUES ($client, $master, $service, $from, $to, $part)`,
      {
        client: clientId, master: input.masterId ?? null, service: input.serviceId,
        from: input.dateFrom, to: input.dateTo, part: input.partOfDay ?? 'any'
      }
    );
  } catch (err) {
    if (/UNIQUE/i.test(err.message)) throw conflict('Такая заявка уже есть в листе ожидания');
    throw err;
  }

  return get('SELECT * FROM waitlist_entries WHERE id = last_insert_rowid()');
}

export function listWaitlist({ actor, clientId }) {
  return all(
    `SELECT w.*, s.title AS service_title, u.full_name AS master_name, c.full_name AS client_name
       FROM waitlist_entries w
       JOIN services s ON s.id = w.service_id
       JOIN users c ON c.id = w.client_id
       LEFT JOIN users u ON u.id = w.master_id
      WHERE w.is_active = 1
        AND ($client IS NULL OR w.client_id = $client)
      ORDER BY w.created_at DESC`,
    { client: actor.role === 'client' ? actor.id : clientId ?? null }
  );
}

export function removeFromWaitlist({ actor, id }) {
  const entry = get('SELECT * FROM waitlist_entries WHERE id = $id', { id });
  if (!entry) throw notFound('Заявка не найдена');
  if (entry.client_id !== actor.id && actor.role === 'client') throw forbidden('Это чужая заявка');
  run('UPDATE waitlist_entries SET is_active = 0 WHERE id = $id', { id });
  return { id, removed: true };
}

// ── Абонементы ──────────────────────────────────────────────────────────────

export function sellPass({ actor, input }) {
  if (!['admin', 'master'].includes(actor.role)) throw forbidden('Абонемент продаёт студия');
  if (!get('SELECT id FROM users WHERE id = $id', { id: input.clientId })) throw notFound('Клиент не найден');
  if (!get('SELECT id FROM services WHERE id = $id', { id: input.serviceId })) throw notFound('Услуга не найдена');

  run(
    `INSERT INTO passes (client_id, service_id, total_visits, price_kopecks, expires_on, sold_by_id)
     VALUES ($client, $service, $total, $price, $expires, $by)`,
    {
      client: input.clientId, service: input.serviceId, total: input.totalVisits,
      price: input.priceKopecks, expires: input.expiresOn ?? null, by: actor.id
    }
  );
  return passWithBalance(get('SELECT id FROM passes WHERE id = last_insert_rowid()').id);
}

export function passWithBalance(passId) {
  const row = get(
    `SELECT p.*, s.title AS service_title,
            (SELECT COUNT(*) FROM pass_usages u WHERE u.pass_id = p.id) AS used
       FROM passes p JOIN services s ON s.id = p.service_id WHERE p.id = $id`,
    { id: passId }
  );
  if (!row) throw notFound('Абонемент не найден');
  return { ...row, remaining: row.total_visits - row.used };
}

export function clientPasses(clientId) {
  return all(
    `SELECT p.id FROM passes p WHERE p.client_id = $id AND p.is_active = 1 ORDER BY p.purchased_at DESC`,
    { id: clientId }
  ).map((r) => passWithBalance(r.id));
}

/* Списание визита с абонемента. Вызывается при завершении визита:
   пока клиентка не пришла, абонемент тратить не за что. */
export function usePassFor(appointment) {
  const pass = all(
    `SELECT p.id, p.total_visits, p.expires_on,
            (SELECT COUNT(*) FROM pass_usages u WHERE u.pass_id = p.id) AS used
       FROM passes p
      WHERE p.client_id = $client AND p.service_id = $service AND p.is_active = 1
      ORDER BY p.purchased_at`,
    { client: appointment.client_id, service: appointment.service_id }
  ).find((p) => p.used < p.total_visits
    && (!p.expires_on || p.expires_on >= nowIso().slice(0, 10)));

  if (!pass) return null;

  run('INSERT INTO pass_usages (pass_id, appointment_id) VALUES ($pass, $appt)',
    { pass: pass.id, appt: appointment.id });
  return pass.id;
}

// ── Лояльность ──────────────────────────────────────────────────────────────

/* Баланс — сумма событий, а не хранимое поле: иначе появилось бы второе
   место истины, которое разойдётся при отмене или правке. */
export function loyaltyBalance(clientId) {
  const row = get(
    'SELECT COALESCE(SUM(points), 0) AS balance FROM loyalty_events WHERE client_id = $id',
    { id: clientId }
  );
  return row.balance;
}

export function loyaltyHistory(clientId, limit = 50) {
  return all(
    `SELECT id, appointment_id, points, kind, comment, created_at
       FROM loyalty_events WHERE client_id = $id ORDER BY created_at DESC LIMIT $limit`,
    { id: clientId, limit }
  );
}

export function awardPointsFor(appointment) {
  const settings = getSettings();
  const points = Math.floor(appointment.price_kopecks / 10000) * settings.loyalty_points_per_100_rub;
  if (points <= 0) return 0;

  try {
    run(
      `INSERT INTO loyalty_events (client_id, appointment_id, points, kind, comment)
       VALUES ($client, $appt, $points, 'earned', 'за визит')`,
      { client: appointment.client_id, appt: appointment.id, points }
    );
    return points;
  } catch (err) {
    // уникальный индекс не даёт начислить дважды за один визит
    if (/UNIQUE/i.test(err.message)) return 0;
    throw err;
  }
}

export function spendPoints({ actor, clientId, points, comment }) {
  if (!['admin', 'master'].includes(actor.role)) throw forbidden('Списывает баллы студия');
  const balance = loyaltyBalance(clientId);
  if (points > balance) throw conflict(`Недостаточно баллов: на счету ${balance}`);

  run(
    `INSERT INTO loyalty_events (client_id, points, kind, comment, created_by_id)
     VALUES ($client, $points, 'spent', $comment, $by)`,
    { client: clientId, points: -points, comment: comment ?? 'списание', by: actor.id }
  );
  return { balance: loyaltyBalance(clientId) };
}

// ── Материалы ───────────────────────────────────────────────────────────────

export function materialsList() {
  return all(
    `SELECT m.*, (SELECT COALESCE(SUM(delta), 0) FROM material_movements mm WHERE mm.material_id = m.id) AS computed_qty
       FROM materials m WHERE m.is_active = 1 ORDER BY m.title`
  ).map((m) => ({ ...m, low: m.computed_qty <= m.min_qty }));
}

export function moveMaterial({ actor, materialId, delta, reason, comment, appointmentId = null }) {
  if (!['admin', 'master'].includes(actor.role)) throw forbidden('Движения материалов ведёт студия');
  if (!get('SELECT id FROM materials WHERE id = $id', { id: materialId })) throw notFound('Материал не найден');

  transaction(() => {
    run(
      `INSERT INTO material_movements (material_id, delta, reason, appointment_id, comment, created_by_id)
       VALUES ($id, $delta, $reason, $appt, $comment, $by)`,
      { id: materialId, delta, reason, appt: appointmentId, comment: comment ?? null, by: actor.id }
    );
    run(
      `UPDATE materials SET stock_qty =
         (SELECT COALESCE(SUM(delta), 0) FROM material_movements WHERE material_id = $id)
       WHERE id = $id`,
      { id: materialId }
    );
  });

  return get('SELECT id, title, stock_qty, min_qty FROM materials WHERE id = $id', { id: materialId });
}

/* Списание по нормам услуги при завершении визита. Уникальный индекс
   не даёт списать дважды за один визит. */
export function consumeMaterialsFor(appointment) {
  const norms = all(
    'SELECT material_id, qty FROM service_materials WHERE service_id = $id',
    { id: appointment.service_id }
  );
  const consumed = [];

  for (const norm of norms) {
    try {
      run(
        `INSERT INTO material_movements (material_id, delta, reason, appointment_id, comment)
         VALUES ($id, $delta, 'consumption', $appt, 'списано по норме услуги')`,
        { id: norm.material_id, delta: -norm.qty, appt: appointment.id }
      );
      run(
        `UPDATE materials SET stock_qty =
           (SELECT COALESCE(SUM(delta), 0) FROM material_movements WHERE material_id = $id)
         WHERE id = $id`,
        { id: norm.material_id }
      );
      consumed.push(norm.material_id);
    } catch (err) {
      if (!/UNIQUE/i.test(err.message)) throw err;
    }
  }
  return consumed;
}

// ── Отчёты ──────────────────────────────────────────────────────────────────

/* Вознаграждение мастера: процент от состоявшихся визитов за период.
   Считается из записей, отдельной таблицы начислений нет — она была бы
   копией того, что и так выводится. */
export function payroll({ from, to, masterId = null }) {
  const rows = all(
    `SELECT u.id AS master_id, u.full_name AS master, mp.commission_percent,
            COUNT(*) AS visits,
            SUM(a.price_kopecks) AS revenue_kopecks,
            SUM(a.price_kopecks * mp.commission_percent / 100) AS payout_kopecks
       FROM appointments a
       JOIN master_profiles mp ON mp.user_id = a.master_id
       JOIN users u ON u.id = a.master_id
      WHERE a.status = 'done'
        AND substr(a.starts_at, 1, 10) BETWEEN $from AND $to
        AND ($master IS NULL OR a.master_id = $master)
      GROUP BY u.id ORDER BY payout_kopecks DESC`,
    { from, to, master: masterId }
  );

  return {
    period: { from, to },
    masters: rows,
    total_revenue_kopecks: rows.reduce((s, r) => s + r.revenue_kopecks, 0),
    total_payout_kopecks: rows.reduce((s, r) => s + r.payout_kopecks, 0)
  };
}

export function analytics({ from, to }) {
  const totals = get(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
            SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) AS no_show,
            SUM(CASE WHEN status = 'done' THEN price_kopecks ELSE 0 END) AS revenue_kopecks
       FROM appointments WHERE substr(starts_at, 1, 10) BETWEEN $from AND $to`,
    { from, to }
  );

  const byService = all(
    `SELECT s.title, COUNT(*) AS visits, SUM(a.price_kopecks) AS revenue_kopecks
       FROM appointments a JOIN services s ON s.id = a.service_id
      WHERE a.status = 'done' AND substr(a.starts_at, 1, 10) BETWEEN $from AND $to
      GROUP BY s.id ORDER BY revenue_kopecks DESC`,
    { from, to }
  );

  const bySource = all(
    `SELECT source, COUNT(*) AS n FROM appointments
      WHERE substr(starts_at, 1, 10) BETWEEN $from AND $to GROUP BY source`,
    { from, to }
  );

  /* Псевдоним не «returning»: это зарезервированное слово SQLite
     (клауза RETURNING), запрос с ним не разбирается. */
  const repeat = get(
    `SELECT COUNT(*) AS clients,
            SUM(CASE WHEN visits > 1 THEN 1 ELSE 0 END) AS repeat_clients
       FROM (SELECT client_id, COUNT(*) AS visits FROM appointments
              WHERE status = 'done' AND substr(starts_at, 1, 10) BETWEEN $from AND $to
              GROUP BY client_id)`,
    { from, to }
  );

  const done = totals.done ?? 0;
  return {
    period: { from, to },
    totals: {
      ...totals,
      average_check_kopecks: done > 0 ? Math.round((totals.revenue_kopecks ?? 0) / done) : 0,
      cancellation_rate: totals.total > 0 ? Math.round((totals.cancelled ?? 0) * 100 / totals.total) : 0,
      no_show_rate: totals.total > 0 ? Math.round((totals.no_show ?? 0) * 100 / totals.total) : 0
    },
    by_service: byService,
    by_source: bySource,
    clients: {
      total: repeat.clients ?? 0,
      returning: repeat.repeat_clients ?? 0,
      returning_rate: repeat.clients > 0
        ? Math.round((repeat.repeat_clients ?? 0) * 100 / repeat.clients) : 0
    }
  };
}
