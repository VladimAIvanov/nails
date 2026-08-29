/* Страница «не найдено». Показывается сервером вместо любого несуществующего
   адреса, поэтому ничего не требует и ничего не ломает, если сервис недоступен. */
import { guard, el, studio } from './api.js';
import { renderHeader } from './header.js';

renderHeader();

await guard(async () => {
  const s = await studio();
  document.getElementById('studio').replaceChildren(
    el('span', {}, 'Не нашли нужное — позвоните в студию: '),
    s.phone
      ? el('a', { href: `tel:${s.phone.replace(/[^+\d]/g, '')}`, textContent: s.phone })
      : el('span', { className: 'muted' }, 'телефон уточняется')
  );
})();
