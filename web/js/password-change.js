/* Смена пароля вошедшей клиенткой.

   Сервер закрывает все прежние сеансы и тут же выдаёт новый — куку он
   подменяет сам, поэтому человека не выбрасывает со страницы. */
import { api, guard, showOk, showError, clearFieldErrors } from './api.js';
import { renderHeader } from './header.js';

const user = await renderHeader();
if (!user) location.href = '/login?next=/password-change';

const form = document.getElementById('form');

form.addEventListener('submit', guard(async () => {
  clearFieldErrors(form);

  const current = form.current_password.value;
  const next = form.new_password.value;
  const repeat = form.repeat.value;

  if (next.length < 8) {
    showError({ status: 400, message: 'Поле «new_password»: минимум 8 символов' }, 'msg', form);
    return;
  }
  /* Совпадение повтора — единственная проверка, которой на сервере нет и
     быть не может: он второго поля не видит. */
  if (next !== repeat) {
    showError({ status: 400, message: 'Пароли не совпадают' }, 'msg', form);
    form.repeat.classList.add('field--bad');
    form.repeat.focus();
    return;
  }

  const result = await api('POST', '/api/profile/password', {
    current_password: current,
    new_password: next
  });

  form.reset();
  showOk(`Пароль изменён. Закрыто прежних входов: ${result.sessions_closed}. `
    + 'На этом устройстве вы остались в кабинете.');
}, 'msg', form));
