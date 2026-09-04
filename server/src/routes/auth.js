/* Регистрация, вход и выход. */
import { get, run, transaction } from '../db.js';
import { badRequest, conflict, unauthorized } from '../http.js';
import * as v from '../validate.js';
import {
  hashPassword, verifyPassword, createSession, revokeSession, requireUser, purgeExpiredSessions,
  sessionCookie, clearSessionCookie, tokenFromRequest, rolesOf
} from '../auth.js';
import { check as checkRate, hit as hitRate, clear as clearRate, purge as purgeRates } from '../ratelimit.js';
import { clientIp, isSecure } from '../net.js';
import { yandexProfile, linkOrCreate } from '../services/external-login.js';
import { nowIso } from '../time.js';

/* Наружу отдаём только то, что нужно интерфейсу. Хеша пароля здесь нет
   и быть не может — поле в выборку не попадает.

   Ролей две штуки не по недосмотру. `role` — основная, на неё опирается
   целостность данных в базе. `roles` — полный список: по нему интерфейс
   решает, куда вести человека после входа и показывать ли пункт меню.
   Владелица студии одновременно администратор и мастер, и по одному
   полю `role` её от обычного мастера не отличить.

   Права этот список не выдаёт: их сервер проверяет сам, по базе. Даже если
   страница нарисует себе меню администратора, каждый запрос к /api/admin
   всё равно упрётся в проверку роли. */
const publicUser = (u) => ({
  id: u.id,
  role: u.role,
  roles: u.roles ?? rolesOf(u.id),
  full_name: u.full_name ?? u.fullName,
  phone: u.phone,
  email: u.email ?? null
});

/* Пропуск уезжает клиенту куком, который ставит сервер: страница его
   не видит и не хранит. Токен в теле ответа остаётся для скриптов
   проверки и внешних клиентов, у которых куки нет. */
const withSession = (res, req, session) => {
  res.setHeader('set-cookie', sessionCookie(session.token, session.expiresAt, { secure: isSecure(req) }));
};

export default function register(router) {
  /* Регистрация клиентки. Мастеров и администратора заводит владелица
     через административные адреса, самостоятельно такую роль получить нельзя. */
  router.post('/api/auth/register', async ({ body, req, res }) => {
    /* Ключ — адрес клиента с учётом доверенных прокси, а не адрес соединения:
       за прокси последний одинаков для всех и ограничение теряет смысл. */
    const ip = clientIp(req);
    checkRate('signup', ip);

    const fullName = v.str(body.full_name, 'full_name', { min: 2, max: 120 });
    const phoneNumber = v.phone(body.phone);
    const password = v.password(body.password);
    const mail = body.email ? v.email(body.email) : null;

    if (body.consent_personal_data !== true) {
      throw badRequest('Нужно согласие на обработку персональных данных');
    }

    const existing = get('SELECT id, password_hash FROM users WHERE phone = $phone',
      { phone: phoneNumber });

    if (existing && existing.password_hash) {
      throw conflict('Этот телефон уже зарегистрирован');
    }

    const user = transaction(() => {
      let id;
      if (existing) {
        /* Гостья, записавшаяся без регистрации, заводит пароль к своему же
           профилю — история визитов сохраняется. */
        run(`UPDATE users SET full_name = $name, email = $mail, password_hash = $hash,
                              password_changed_at = $now, updated_at = $now
              WHERE id = $id`,
          { name: fullName, mail, hash: hashPassword(password), now: nowIso(), id: existing.id });
        id = existing.id;
      } else {
        run(`INSERT INTO users (role, full_name, phone, email, password_hash, password_changed_at)
             VALUES ('client', $name, $phone, $mail, $hash, $now)`,
          { name: fullName, phone: phoneNumber, mail, hash: hashPassword(password), now: nowIso() });
        id = get('SELECT id FROM users WHERE phone = $phone', { phone: phoneNumber }).id;
      }

      run(`INSERT INTO notification_prefs (user_id) VALUES ($id)
           ON CONFLICT (user_id) DO NOTHING`, { id });
      run(`INSERT INTO consents (user_id, kind, is_granted, document_version, source)
           VALUES ($id, 'personal_data', 1, 'v1', 'site')`, { id });

      return get('SELECT id, role, full_name, phone, email FROM users WHERE id = $id', { id });
    });

    hitRate('signup', ip);

    const session = createSession(user.id, {
      userAgent: req.headers['user-agent'] ?? null,
      ip: clientIp(req) || null
    });
    withSession(res, req, session);

    return { status: 201, body: { user: publicUser(user), ...session } };
  });

  /* Вход по телефону (клиентка) или почте (мастер и администратор). */
  router.post('/api/auth/login', async ({ body, req, res }) => {
    const login = v.str(body.login, 'login', { max: 200 });
    const password = v.password(body.password);

    checkRate('login', login);

    const isEmail = login.includes('@');
    const user = get(
      isEmail
        ? 'SELECT * FROM users WHERE email = $login'
        : 'SELECT * FROM users WHERE phone = $login',
      { login: isEmail ? login.toLowerCase() : login.replace(/[\s()-]/g, '') }
    );

    /* Один и тот же ответ на «нет такого пользователя», «нет пароля»
       и «пароль неверный»: иначе по коду ответа можно перебрать базу телефонов. */
    if (!user || user.is_active !== 1 || !verifyPassword(password, user.password_hash)) {
      hitRate('login', login);
      throw unauthorized('Неверный логин или пароль');
    }
    clearRate('login', login);

    purgeExpiredSessions();
    purgeRates();
    const session = createSession(user.id, {
      userAgent: req.headers['user-agent'] ?? null,
      ip: clientIp(req) || null
    });
    withSession(res, req, session);

    return { body: { user: publicUser(user), ...session } };
  });

  router.post('/api/auth/logout', async ({ req, res }) => {
    requireUser(req);
    revokeSession(tokenFromRequest(req));
    res.setHeader('set-cookie', clearSessionCookie({ secure: isSecure(req) }));
    return { body: { ok: true } };
  });

  /* Вход через Яндекс.

     Почту в теле запроса сервер не принимает — и это главное в обработчике.
     Адрес, который поверил бы браузеру на слово, был бы не входом через
     Яндекс, а входом под кем угодно: достаточно прислать чужую почту.
     Поэтому почту и имя достаёт сам сервер — сейчас из заглушки, после
     публикации из ответа Яндекса на одноразовый код.

     Ограничение частоты общее с обычным входом: перебирать здесь нечего,
     но адрес всё равно заводит учётные записи, и делать это тысячами
     подряд незачем. */
  router.post('/api/auth/yandex', async ({ body, req, res }) => {
    const ip = clientIp(req);
    checkRate('login', `yandex:${ip}`);

    const profile = await yandexProfile(body.code ?? null);
    hitRate('login', `yandex:${ip}`);

    const { user, created, linked } = linkOrCreate({
      provider: profile.provider,
      providerId: profile.provider_id,
      email: profile.email,
      fullName: profile.full_name
    });

    purgeExpiredSessions();
    const session = createSession(user.id, {
      userAgent: req.headers['user-agent'] ?? null,
      ip: clientIp(req) || null
    });
    withSession(res, req, session);

    return {
      status: created ? 201 : 200,
      body: {
        user: publicUser(user),
        /* Экрану полезно знать, что именно произошло: завели кабинет,
           привязали вход к существующему или просто узнали своего. */
        created,
        linked,
        stub: profile.stub === true,
        ...session
      }
    };
  });

  /* Показывать ли кнопку. Отдельного адреса ради одного признака заводить
     не хочется, но и рисовать кнопку, которая всегда отвечает отказом,
     тоже нельзя — поэтому признак приезжает вместе с настройками студии
     (см. GET /api/studio, поле external_login). */
  router.get('/api/auth/me', async ({ req }) => ({ body: { user: publicUser(requireUser(req)) } }));
}



