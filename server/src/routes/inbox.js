/* Уведомления в кабинете: список и отметка о прочтении.

   Адреса соседствуют с настройками каналов (`/api/notifications/prefs`
   в routes/extras.js) — это разные вещи под одним корнем: там человек
   выбирает, куда ему писать, здесь читает то, что уже написано.

   Список отдаётся вместе с числом непрочитанных. Отдельного адреса ради
   одного числа нет: счётчик в шапке и список открываются одновременно,
   и второй запрос был бы лишним обращением к базе на каждой странице. */
import { notFound } from '../http.js';
import * as v from '../validate.js';
import { requireUser } from '../auth.js';
import { inboxFor, markRead, markAllRead } from '../services/inbox.js';

export default function register(router) {
  /* Свои сообщения. Чужие получить нельзя: выборка идёт по пропуску,
     идентификатор пользователя из запроса не принимается вовсе. */
  router.get('/api/notifications', async ({ req, query }) => {
    const user = requireUser(req);
    const limit = query.get('limit') ? v.int(query.get('limit'), 'limit', { min: 1, max: 200 }) : 50;
    return { body: inboxFor(user.id, { limit }) };
  });

  router.post('/api/notifications/:id/read', async ({ params, req }) => {
    const user = requireUser(req);
    const id = v.idParam(params.id);

    /* Чужое сообщение и несуществующее отвечают одинаково — «не найдено».
       Разные ответы позволили бы перебором узнать, сколько уведомлений
       у соседа и когда они появились. */
    if (!markRead(user.id, id)) throw notFound('Уведомление не найдено');

    return { body: inboxFor(user.id) };
  });

  router.post('/api/notifications/read-all', async ({ req }) => {
    const user = requireUser(req);
    markAllRead(user.id);
    return { body: inboxFor(user.id) };
  });
}
