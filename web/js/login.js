/* Вход.

   Проверка на форме — для удобства: об ошибке видно сразу, без похода на
   сервер. Настоящая проверка всё равно на сервере, и её ответ показывается
   на форме текстом: сервер знает то, чего браузер знать не может — есть ли
   такой человек и верен ли пароль.

   Пропуск сервер ставит кукой сам. Здесь его не читают и не хранят. */
import { api, guard, showError, clearFieldErrors, el } from './api.js';
import { renderHeader } from './header.js';
import { renderExternalLogin } from './external-login.js';

renderHeader();

const form = document.getElementById('form');

/* Куда возвращаться после входа: либо туда, откуда попросили войти,
   либо в кабинет — а администратора в панель.

   Адрес возврата берётся из строки запроса, поэтому его нельзя принимать
   на веру: «//чужой-сайт» начинается со слеша и выглядит как свой путь,
   а браузер уводит по нему на чужой домен. Пропускаем только один слеш. */
const asked = new URLSearchParams(location.search).get('next');
const next = asked && asked.startsWith('/') && !asked.startsWith('//') ? asked : null;

/* Форма входа одна на всех. Отдельного адреса для сотрудников нет и не будет:
   вторая форма не добавила бы защиты, а восстановление и смену пароля
   пришлось бы поддерживать в двух местах. Кто перед нами, решает сервер —
   по ролям из базы, а не по адресу, с которого открыли форму. */
const home = (user) => (user.roles?.includes('admin') ? '/admin' : '/account');

renderExternalLogin('external', next);

/* Возврат от Яндекса, который не дошёл до конца. Сервер называет только
   повод — формулировка живёт здесь, в одном месте, рядом с остальными
   сообщениями экрана.

   Без этого человек, нажавший «Отмена» на экране согласия, возвращался бы
   на страницу входа без единого слова о том, что произошло, — и решил бы,
   что сломался сервис, а не что он сам отказался. */
const YANDEX_REASONS = {
  denied: 'Вход через Яндекс не завершён: вы отказались на его странице. '
    + 'Можно попробовать снова или войти по паролю.',
  error: 'Вход через Яндекс не завершён — он не ответил или ответил отказом. '
    + 'Попробуйте ещё раз или войдите по паролю.',
  state: 'Вход через Яндекс не завершён: страница слишком долго ждала. '
    + 'Начните заново.',
  off: 'Вход через Яндекс сейчас не настроен. Войдите по паролю.'
};

const yandexReason = new URLSearchParams(location.search).get('yandex');
if (yandexReason && YANDEX_REASONS[yandexReason]) {
  /* Не через showError: тот подписывает сообщение словами «Проверьте поля»,
     а поля здесь ни при чём — человек отказался на чужой странице. */
  document.getElementById('msg').replaceChildren(
    el('div', { className: 'note note--info', textContent: YANDEX_REASONS[yandexReason] })
  );
}

form.addEventListener('submit', guard(async () => {
  clearFieldErrors(form);

  const login = form.login.value.trim();
  const password = form.password.value;

  if (!login) {
    showError({ status: 400, message: 'Поле «login»: введите телефон или почту' }, 'msg', form);
    return;
  }
  if (password.length < 8) {
    showError({ status: 400, message: 'Поле «password»: минимум 8 символов' }, 'msg', form);
    return;
  }

  const { user } = await api('POST', '/api/auth/login', { login, password });
  location.href = next ?? home(user);
}, 'msg', form));
