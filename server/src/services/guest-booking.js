/* Запись без регистрации.

   Паспорт продукта, функция 1 и сценарий использования 1: клиентка выбирает
   услугу, мастера и время, оставляет имя, телефон и согласие — и получает
   карточку визита. Аккаунт при этом не заводится: пароля она не придумывает
   и войти под этой строкой нельзя.

   Строка в users всё равно появляется, и это не противоречие. У визита
   должен быть владелец: без него не собрать расписание студии, не позвонить
   человеку и не показать историю, когда он всё-таки заведёт кабинет.
   Такие «гостьи, которых записала студия» в схеме были с самого начала —
   у них пустой password_hash, и регистрация по тому же телефону не создаёт
   второго человека, а дописывает пароль к существующему (см. routes/auth.js).

   Чего здесь сознательно нет: сеанса. Гость записался — и остался гостем.
   Выдать пропуск по одному номеру телефона значило бы пускать в чужой
   кабинет всякого, кто этот номер знает. */
import { get, run, transaction } from '../db.js';
import { badRequest } from '../http.js';
import * as v from '../validate.js';
import { nowIso } from '../time.js';

/**
 * Находит или заводит человека по телефону из формы записи.
 * Возвращает актора в том же виде, в каком его отдаёт currentUser, —
 * дальше он идёт в createAppointment наравне с вошедшей клиенткой.
 */
export function guestActor(body) {
  const fullName = v.str(body.full_name, 'full_name', { min: 2, max: 120 });
  const phone = v.phone(body.phone);

  if (body.consent_personal_data !== true) {
    throw badRequest('Нужно согласие на обработку персональных данных');
  }

  const existing = get('SELECT id, full_name, phone, role FROM users WHERE phone = $phone', { phone });

  /* Телефон уже знаком — записываем к этому же человеку.

     Да, так посторонний может оформить визит на чужой номер. Это свойство
     любой записи без регистрации, и защищает от него не сервис, а студия:
     она перезванивает. Настоящая защита — подтверждение кода в Telegram
     или SMS, канала для этого пока нет. Ограничение частоты по адресу
     стоит в обработчике: перебирать номера пачками не выйдет.

     Имя существующего человека не переписываем: в форме мог оказаться
     кто угодно, а в базе — то, как студия его знает. */
  const id = existing
    ? existing.id
    : transaction(() => {
      run(
        `INSERT INTO users (role, full_name, phone, password_hash)
         VALUES ('client', $name, $phone, NULL)`,
        { name: fullName, phone }
      );
      const created = get('SELECT last_insert_rowid() AS id').id;

      run('INSERT INTO notification_prefs (user_id) VALUES ($id) ON CONFLICT (user_id) DO NOTHING',
        { id: created });

      /* Согласие фиксируется так же, как при регистрации: 152-ФЗ требует,
         чтобы было видно, на что человек согласился и когда. */
      run(
        `INSERT INTO consents (user_id, kind, is_granted, document_version, source)
         VALUES ($id, 'personal_data', 1, 'v1', 'site')`,
        { id: created }
      );

      return created;
    });

  const row = get('SELECT id, role, full_name, phone FROM users WHERE id = $id', { id });

  /* Роль здесь всегда клиентская, что бы ни лежало в базе у этого телефона.

     Если номер окажется мастерским или административным, взять роль из базы
     значило бы выдать права по форме без пароля: оформление задним числом,
     запись поверх занятого времени, чужой клиент в поле client_id. Гость,
     заполнивший форму, — это гость, и никаких прав у него нет. */
  return {
    actor: {
      id: row.id,
      role: 'client',
      roles: ['client'],
      fullName: row.full_name,
      phone: row.phone
    },
    createdAccount: !existing,
    at: nowIso()
  };
}
