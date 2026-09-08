/* Первый администратор на новом сервере.

   Задача узкая: на чистой базе войти в панель студии некем. Сиды для этого
   не годятся — они кладут демо-услуги, мастеров и записи, а пароль у них
   один на всех и напечатан в README. На опубликованном сервисе это открытая
   дверь, а не удобство.

   Поэтому учётная запись заводится из окружения: ADMIN_EMAIL и
   ADMIN_PASSWORD задаются в панели развёртывания, где им и место, а в
   репозиторий не попадают. Пароль нигде не печатается — ни в логе запуска,
   ни в ответах сервера.

   Правило одно и жёсткое: существующего пользователя не трогаем. Иначе
   переменная в панели молча перезаписывала бы пароль живого администратора
   при каждом развёртывании, а забытая — возвращала бы старый после того,
   как его сменили. */
import { get, run, transaction } from './db.js';
import { hashPassword } from './auth.js';
import { nowIso } from './time.js';
import * as env from './env.js';

const MIN_PASSWORD = 10;

/**
 * Заводит администратора, если задано окружение и такого ещё нет.
 *
 * @returns {{ created: boolean, note: string|null }} note — что сказать в лог
 */
export function bootstrapAdmin() {
  const email = env.text('ADMIN_EMAIL');
  const password = env.text('ADMIN_PASSWORD');

  if (!email && !password) return { created: false, note: null };

  /* Половина настройки — это почти наверняка опечатка в имени переменной,
     и молчать о ней нельзя: человек будет ждать учётную запись, которой нет. */
  if (!email || !password) {
    return {
      created: false,
      note: 'ADMIN_EMAIL и ADMIN_PASSWORD задаются только вместе — '
        + `сейчас задано лишь ${email ? 'ADMIN_EMAIL' : 'ADMIN_PASSWORD'}. Учётная запись не создана.`
    };
  }

  if (password.length < MIN_PASSWORD) {
    return {
      created: false,
      note: `ADMIN_PASSWORD короче ${MIN_PASSWORD} знаков. Учётная запись не создана: `
        + 'у администратора есть доступ ко всем записям клиентов.'
    };
  }

  const existing = get('SELECT id, role FROM users WHERE email = $email', { email });
  if (existing) {
    return {
      created: false,
      note: `Администратор ${email} уже заведён — пароль не трогаем. `
        + 'Сменить его можно на странице смены пароля, войдя под ним.'
    };
  }

  const name = env.text('ADMIN_NAME', 'Администратор');

  transaction((conn) => {
    conn.prepare(
      `INSERT INTO users (role, full_name, email, password_hash, password_changed_at)
       VALUES ('admin', $name, $email, $hash, $now)`
    ).run({ name, email, hash: hashPassword(password), now: nowIso() });

    /* Роль дублируется в user_roles: с седьмой миграции список ролей живёт
       там, а столбец role остался основной ролью. requireRole смотрит список. */
    const id = conn.prepare('SELECT id FROM users WHERE email = $email').get({ email }).id;
    conn.prepare('INSERT INTO user_roles (user_id, role) VALUES ($id, \'admin\') ON CONFLICT DO NOTHING')
      .run({ id });
  });

  return { created: true, note: `Заведён администратор ${email}. Пароль — тот, что в ADMIN_PASSWORD.` };
}

export { MIN_PASSWORD };
