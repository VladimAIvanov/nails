/* Кнопка «Войти через Яндекс» на экранах входа и регистрации.

   Кнопка появляется, только если внешний вход сейчас работает: список
   доступных способов приходит в `GET /api/studio` полем `external_login`.
   Пустой список — кнопки нет. Рисовать кнопку, которая всегда отвечает
   отказом, хуже, чем не рисовать её вовсе.

   Почту страница не отправляет и отправить не может: сервер её не принимает.
   Кто пришёл, решает он сам — сейчас по заглушке из настроек, после
   публикации по одноразовому коду Яндекса. */
import { api, guard, el, studio } from './api.js';

/* Куда идти после входа — то же правило, что и у формы с паролем: адрес
   возврата, если о нём просили, иначе панель для администратора и кабинет
   для всех остальных. */
function destination(user, next) {
  if (next) return next;
  return user.roles?.includes('admin') ? '/admin' : '/account';
}

/**
 * Дорисовывает кнопку в элемент с заданным id, если внешний вход доступен.
 * @param {string} mountId куда вставить
 * @param {string|null} next адрес возврата после входа
 */
export async function renderExternalLogin(mountId, next = null) {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  let providers = [];
  try {
    providers = (await studio()).external_login ?? [];
  } catch {
    /* Настройки не приехали — экран входа с паролем всё равно работает,
       и загораживать его сообщением об ошибке из-за кнопки незачем. */
    return;
  }

  if (!providers.includes('yandex')) return;

  const button = el('button', {
    type: 'button',
    className: 'btn btn--secondary btn--wide',
    textContent: 'Войти через Яндекс'
  });

  button.addEventListener('click', guard(async () => {
    button.disabled = true;
    const answer = await api('POST', '/api/auth/yandex', {});
    location.href = destination(answer.user, next);
  }));

  mount.replaceChildren(
    el('div', { className: 'or' }, el('span', { textContent: 'или' })),
    button,
    /* Пока это заглушка, об этом говорится прямо на кнопке. Временное
       решение опасно не тем, что оно временное, а тем, что о нём забывают. */
    el('p', { className: 'field__hint' },
      'Пока это проверочный вход: сервис не обращается в Яндекс, а берёт почту '
      + 'и имя из локальных настроек. Настоящий Яндекс подключится после публикации.')
  );
}
