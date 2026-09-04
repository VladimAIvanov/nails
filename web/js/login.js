/* Вход.

   Проверка на форме — для удобства: об ошибке видно сразу, без похода на
   сервер. Настоящая проверка всё равно на сервере, и её ответ показывается
   на форме текстом: сервер знает то, чего браузер знать не может — есть ли
   такой человек и верен ли пароль.

   Пропуск сервер ставит кукой сам. Здесь его не читают и не хранят. */
import { api, guard, showError, clearFieldErrors } from './api.js';
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
