/* Регистрация клиентки.

   Роль в запросе не передаём: сервер её всё равно не читает — регистрация
   всегда создаёт клиентку. Мастеров и администратора заводит студия.

   Занятый телефон видит только сервер, поэтому его ответ (409) показывается
   на форме как есть. */
import { api, guard, showError, clearFieldErrors } from './api.js';
import { renderHeader } from './header.js';

renderHeader();

const form = document.getElementById('form');

form.addEventListener('submit', guard(async () => {
  clearFieldErrors(form);

  const fullName = form.full_name.value.trim();
  const phone = form.phone.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;
  const consent = form.consent_personal_data.checked;

  /* Быстрые проверки — те же, что сделает сервер, но без похода к нему. */
  if (fullName.length < 2) {
    showError({ status: 400, message: 'Поле «full_name»: минимум 2 символов' }, 'msg', form);
    return;
  }
  if (!/^\+?\d[\d\s()-]{9,}$/.test(phone)) {
    showError({ status: 400, message: 'Поле «phone»: телефон в формате +79210000000' }, 'msg', form);
    return;
  }
  if (email && !email.includes('@')) {
    showError({ status: 400, message: 'Поле «email»: некорректный адрес почты' }, 'msg', form);
    return;
  }
  if (password.length < 8) {
    showError({ status: 400, message: 'Поле «password»: минимум 8 символов' }, 'msg', form);
    return;
  }
  if (!consent) {
    showError({ status: 400, message: 'Нужно согласие на обработку персональных данных' }, 'msg', form);
    form.consent_personal_data.focus();
    return;
  }

  await api('POST', '/api/auth/register', {
    full_name: fullName,
    phone,
    email: email || undefined,
    password,
    consent_personal_data: true
  });

  /* Кабинет у новой клиентки пустой — так и задумано: он сразу показывает,
     что записей нет, и предлагает записаться. */
  location.href = '/account?new=1';
}, 'msg', form));
