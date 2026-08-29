/* Вход.

   Проверка на форме — для удобства: об ошибке видно сразу, без похода на
   сервер. Настоящая проверка всё равно на сервере, и её ответ показывается
   на форме текстом: сервер знает то, чего браузер знать не может — есть ли
   такой человек и верен ли пароль.

   Пропуск сервер ставит кукой сам. Здесь его не читают и не хранят. */
import { api, guard, showError, clearFieldErrors } from './api.js';
import { renderHeader } from './header.js';

renderHeader();

const form = document.getElementById('form');

/* Куда возвращаться после входа: либо туда, откуда попросили войти,
   либо в кабинет. */
const next = new URLSearchParams(location.search).get('next');
const target = next && next.startsWith('/') ? next : '/account';

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

  await api('POST', '/api/auth/login', { login, password });
  location.href = target;
}, 'msg', form));
