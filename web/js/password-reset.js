/* Восстановление доступа.

   Формы здесь нет намеренно. Адреса сброса пароля в API не существует —
   это записано в docs/ui-map.md, расхождение №1: чтобы выслать ссылку или
   код, нужен подтверждённый канал связи, а это работа бэкенда. Форма,
   которая никуда не отправляет, выглядела бы рабочей и врала бы человеку.

   Поэтому экран показывает то, что можно сделать сейчас: контакты студии
   (из API, не из разметки) и переход к смене пароля для тех, кто вошёл. */
import { studio, guard, el } from './api.js';
import { renderHeader } from './header.js';

renderHeader();

await guard(async () => {
  const s = await studio();
  const contacts = document.getElementById('contacts');

  const links = [
    s.phone && el('a', {
      className: 'btn btn--secondary btn--sm',
      href: `tel:${s.phone.replace(/[^+\d]/g, '')}`,
      textContent: s.phone
    }),
    s.telegram_bot && el('a', {
      className: 'btn btn--secondary btn--sm',
      href: `https://t.me/${s.telegram_bot.replace('@', '')}`,
      textContent: s.telegram_bot
    })
  ].filter(Boolean);

  contacts.replaceChildren(
    ...(links.length ? links : [el('span', { className: 'muted' }, 'Контакты студии уточняются')])
  );
})();
