/* Вход через внешний сервис.

   Разделено на две части, и это главное в файле.

   Первая — получение данных от Яндекса: увести человека на его страницу
   согласия, а потом обменять одноразовый код на токен и токеном забрать
   почту с именем. До публикации здесь стояла заглушка — сервису некуда было
   возвращать человека, постоянного адреса не существовало. Теперь адрес есть,
   и заглушки больше нет.

   Вторая — что сервис делает с полученными почтой и именем: ищет человека,
   привязывает вход к существующей учётной записи или заводит новую, выдаёт
   собственный пропуск. Она работала по-настоящему с самого начала и при
   подключении Яндекса не менялась ни строкой.

   Токен Яндекса нигде не сохраняется и внутри сервиса ничего не значит.
   Он подтверждает одно: человек владеет учётной записью в Яндексе. О правах
   в нашем продукте — о ролях, записях, чужих данных — он не говорит ничего,
   поэтому после получения почты выбрасывается, а пропуск выдаётся свой,
   по тем же правилам, что и при обычном входе.

   Хранить его было бы не запасливостью, а ответственностью: этот токен даёт
   доступ к данным человека в Яндексе, и утечка нашей базы стала бы утечкой
   доступа к чужому аккаунту. */
import { get, run, transaction } from '../db.js';
import { badGateway, conflict } from '../http.js';
import { nowIso } from '../time.js';
import * as env from '../env.js';

export const PROVIDER = 'yandex';

const AUTHORIZE_URL = 'https://oauth.yandex.ru/authorize';
const TOKEN_URL = 'https://oauth.yandex.ru/token';
const INFO_URL = 'https://login.yandex.ru/info?format=json';

/* Сколько ждать Яндекс. Без предела запрос висел бы до упора, а вместе с ним
   и человек на белом экране. */
const TIMEOUT_MS = 10_000;

/* Идентификатор и секрет приложения — только из окружения, без запасных
   значений в коде. Значение по умолчанию у секрета означало бы секрет,
   лежащий в репозитории. */
const clientId = () => env.text('YANDEX_CLIENT_ID');
const clientSecret = () => env.text('YANDEX_CLIENT_SECRET');

/* Адрес возврата задаётся строкой, а не собирается из заголовков запроса.
   Яндекс сверяет его посимвольно — протокол, домен, путь, косую черту в конце,
   — и значение, зависящее от того, что прислал браузер, рано или поздно
   разойдётся с тем, что записано в кабинете. */
export const redirectUri = () => env.text('YANDEX_REDIRECT_URI');

/** Настроен ли вход через Яндекс. Без любой из трёх строк — нет. */
export const yandexConfigured = () => Boolean(clientId() && clientSecret() && redirectUri());

/**
 * Адрес страницы согласия Яндекса, куда уводим человека.
 *
 * Права приложение просит минимальные — почту, имя и фамилию, — и просит их
 * не здесь: список задан при регистрации приложения в кабинете. Человек
 * увидит именно его на экране согласия.
 */
export function authorizeUrl(state) {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId());
  url.searchParams.set('redirect_uri', redirectUri());
  url.searchParams.set('state', state);
  return url.toString();
}

async function ask(url, options, what) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    /* Сеть, таймаут, недоступный Яндекс — всё это не вина человека
       и не повод показывать ему внутренности. */
    throw badGateway(`Яндекс не ответил (${what}): ${err.message}`);
  }

  const text = await response.text();
  if (!response.ok) {
    throw badGateway(`Яндекс отказал (${what}, код ${response.status}): ${text.slice(0, 200)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw badGateway(`Яндекс вернул не JSON (${what})`);
  }
}

/**
 * Почта и имя от Яндекса по одноразовому коду.
 *
 * Два запроса, оба с нашего сервера, без участия браузера. Первый меняет код
 * на токен — только здесь нужен секрет приложения, и только поэтому он не
 * может лежать на странице. Второй забирает профиль.
 */
export async function yandexProfile(code) {
  if (!yandexConfigured()) {
    throw conflict(
      'Вход через Яндекс не настроен: не заданы YANDEX_CLIENT_ID, '
      + 'YANDEX_CLIENT_SECRET или YANDEX_REDIRECT_URI'
    );
  }

  const token = await ask(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri()
    }).toString()
  }, 'обмен кода на токен');

  if (!token.access_token) throw badGateway('Яндекс не вернул токен доступа');

  const profile = await ask(INFO_URL, {
    headers: { authorization: `OAuth ${token.access_token}` }
  }, 'получение профиля');

  /* Почта — ключ, по которому дальше ищется человек. Яндекс кладёт её
     в default_email, а если у аккаунта их несколько — первая в списке. */
  const email = (profile.default_email ?? profile.emails?.[0] ?? '').trim().toLowerCase();
  if (!email) {
    throw conflict(
      'Яндекс не отдал адрес почты. Проверьте, что приложению разрешён доступ '
      + 'к адресу электронной почты'
    );
  }

  /* Имя: настоящее, если человек его указал, иначе отображаемое, иначе логин.
     Пустым оно быть не может — в базе поле обязательное. */
  const fullName = (profile.real_name || profile.display_name || profile.login || '').trim()
    || 'Клиентка Яндекса';

  return {
    provider: PROVIDER,
    /* Внутренний идентификатор Яндекса. Он, а не почта, — постоянный ключ:
       почту человек может сменить, идентификатор нет. */
    provider_id: String(profile.id),
    email,
    full_name: fullName
  };
  /* Токен на этом заканчивается. Он не возвращается, не пишется в базу
     и не попадает в лог. */
}

/**
 * Найти человека или завести нового по данным внешнего сервиса.
 *
 * Порядок поиска важен. Сначала по паре «сервис + идентификатор»: почта
 * у человека со временем меняется, а идентификатор в Яндексе — нет.
 * Затем по почте: если человек уже регистрировался с паролем, второй пустой
 * кабинет ему заводить нельзя — это один и тот же человек, просто вошёл
 * иначе. И только если не нашли ни там ни там — создаём.
 */
export function linkOrCreate({ provider, providerId, email, fullName }) {
  const byProvider = get(
    'SELECT * FROM users WHERE provider = $provider AND provider_id = $id',
    { provider, id: providerId }
  );
  if (byProvider) {
    if (byProvider.is_active !== 1) throw conflict('Учётная запись отключена');
    return { user: byProvider, created: false, linked: false };
  }

  const byEmail = get('SELECT * FROM users WHERE email = $email', { email });
  if (byEmail) {
    if (byEmail.is_active !== 1) throw conflict('Учётная запись отключена');

    /* Роли не трогаем. Яндекс подтверждает, кто человек, но не решает, что
       ему можно внутри сервиса: администратор останется администратором,
       клиентка — клиенткой. Добавляется только способ входа. */
    run(
      `UPDATE users SET provider = $provider, provider_id = $id, updated_at = $now
        WHERE id = $user`,
      { provider, id: providerId, now: nowIso(), user: byEmail.id }
    );
    return { user: get('SELECT * FROM users WHERE id = $id', { id: byEmail.id }), created: false, linked: true };
  }

  /* Новая учётная запись — всегда клиентка.

     В уроке эта роль называется `user`; в нашей схеме роль обычного
     пользователя называется `client`, и это она. Мастера и администратора
     через внешний вход выдать нельзя ни при каких данных от Яндекса:
     значение здесь записано буквально, а не берётся из ответа сервиса.

     Телефона у неё нет: Яндекс его не отдаёт, и отдельно спрашивать мы его
     не будем. Ради этого случая в миграции 010 требование «у клиентки есть
     телефон» стало «у клиентки есть телефон или внешняя учётная запись». */
  const created = transaction(() => {
    run(
      `INSERT INTO users (role, full_name, email, provider, provider_id)
       VALUES ('client', $name, $email, $provider, $id)`,
      { name: fullName, email, provider, id: providerId }
    );
    const userId = get('SELECT last_insert_rowid() AS id').id;

    /* Те же заготовки, что и при обычной регистрации: без строки настроек
       уведомлений экран профиля у неё окажется пустым. */
    run('INSERT INTO notification_prefs (user_id) VALUES ($id) ON CONFLICT (user_id) DO NOTHING',
      { id: userId });

    return get('SELECT * FROM users WHERE id = $id', { id: userId });
  });

  return { user: created, created: true, linked: false };
}
