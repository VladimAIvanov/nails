/* Общая шапка клиента: собирается один раз, страницы её вызывают.

   Состав — из прототипа и листа глобальной навигации карты связей: логотип,
   меню, справа либо имя вошедшего с аватаром и выходом, либо кнопки входа и
   регистрации. Имя берётся из API, а не из разметки.

   Шапка липкая — остаётся выше содержимого при прокрутке (класс .header). */
import { api, me, logout, el, actsAsClient } from './api.js';

/* Пункт «Админ-панель» показывается только по роли из базы — и это
   удобство, а не защита. Спрятанная ссылка никого не останавливает: адрес
   /admin вводится руками. Не пускает туда сервер (server/src/static.js),
   а данные закрыты проверкой на весь /api/admin (server/src/index.js). */
const LINKS = [
  { href: '/admin', text: 'Админ-панель', forAdmins: true },
  { href: '/account', text: 'Мои записи', forGuests: false, forClients: true },
  { href: '/notifications', text: 'Уведомления', forGuests: false, forClients: true },
  { href: '/profile', text: 'Профиль', forGuests: false },
  { href: '/#services', text: 'Услуги', forGuests: true },
  { href: '/#masters', text: 'Мастера', forGuests: true },
  { href: '/#contacts', text: 'Контакты', forGuests: true }
];

/* Роли приходят списком, и проверяется наличие нужной, а не равенство
   единственному значению: у владелицы студии их две — admin и master. */
const isAdmin = (user) => Boolean(user?.roles?.includes('admin'));

const initials = (name) => (name ?? '')
  .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '·';

/**
 * Рисует шапку в элемент с id="header".
 * Возвращает вошедшего пользователя или null — страницам это часто нужно,
 * чтобы не запрашивать его второй раз.
 */
export async function renderHeader() {
  const mount = document.getElementById('header');
  if (!mount) return null;

  /* Пока имя едет, показываем шапку гостя: пустое место в углу выглядит
     как поломка, а кнопка входа — нет. */
  paint(mount, null, { loading: true });

  let user = null;
  try {
    user = await me();
  } catch {
    /* Сервер недоступен — шапка всё равно должна быть. Само сообщение об
       ошибке покажет страница: у неё для этого есть место. */
  }

  paint(mount, user, { loading: false });

  /* Счётчик непрочитанного. Число приходит с сервера вместе со списком —
     отдельного адреса ради одного числа нет, и в разметке его тоже нет:
     захардкоженный счётчик врёт с первой же секунды.

     Запрашивается после отрисовки шапки, а не до: шапка не должна ждать
     уведомлений, чтобы появиться. Отказ здесь молчаливый — из-за счётчика
     страница ломаться не должна, а сообщение об ошибке покажет сам экран
     уведомлений, когда человек на него зайдёт. */
  if (actsAsClient(user)) {
    try {
      const { unread } = await api('GET', '/api/notifications?limit=1');
      if (unread > 0) {
        const link = mount.querySelector('a[href="/notifications"]');
        link?.append(el('span', { className: 'nav-count', textContent: String(unread) }));
      }
    } catch { /* счётчик — не повод ломать страницу */ }
  }

  return user;
}

function paint(mount, user, { loading }) {
  const nav = el('nav', { className: 'header__nav' },
    ...LINKS
      .filter((l) => {
        if (l.forAdmins) return isAdmin(user);
        if (!user) return l.forGuests;
        /* Кабинет предлагаем только тем, кому он откроется: сотруднику
           сервер откажет, а ссылка в шапке обещала бы обратное. */
        return l.forClients ? actsAsClient(user) : true;
      })
      .map((l) => el('a', { href: l.href, textContent: l.text }))
  );

  const side = el('div', { className: 'header__side' });

  if (loading) {
    side.append(el('div', { className: 'skeleton skeleton-line skeleton-line--who' }));
  } else if (user) {
    const exit = el('button', { type: 'button', className: 'btn btn--ghost btn--sm', textContent: 'Выйти' });
    exit.addEventListener('click', async () => {
      try { await logout(); } catch { /* сеанс мог истечь — всё равно уходим */ }
      location.href = '/';
    });

    side.append(
      el('a', { href: actsAsClient(user) ? '/account' : '/profile', className: 'who' },
        el('span', { className: 'avatar', textContent: initials(user.full_name) }),
        el('span', { className: 'who__name', textContent: user.full_name })),
      exit
    );
  } else {
    side.append(
      el('a', { href: '/login', className: 'btn btn--ghost btn--sm', textContent: 'Войти' }),
      el('a', { href: '/register', className: 'btn btn--sm', textContent: 'Регистрация' })
    );
  }

  mount.replaceChildren(
    el('div', { className: 'wrap header__in' },
      el('a', { href: '/', className: 'logo' },
        'Варвара',
        el('small', { textContent: 'ногтевая студия' })),
      nav,
      side)
  );
  mount.className = 'header';
}
