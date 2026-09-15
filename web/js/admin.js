/* Общий каркас админ-панели: боковое меню и полоса сверху.

   Один файл на все административные страницы — как header.js на клиентские.
   Пункт меню, соответствующий открытой странице, подсвечивается; какая
   страница открыта, определяется по адресу, а не разметкой на каждой из них.

   Права здесь не проверяются и проверяться не могут. До этого кода доходит
   только тот, кого пустил сервер: страницы раздела закрыты в
   server/src/static.js, адреса данных — router.guard('/api/admin/') в
   server/src/index.js. Всё, что делает этот файл, — рисует то, что и так
   разрешено показать. */
import { me, logout, el } from './api.js';

const ITEMS = [
  { href: '/admin', text: 'Записи' },
  { href: '/admin/services', text: 'Услуги' },
  { href: '/admin/masters', text: 'Мастера' }
];

const initials = (name) => (name ?? '')
  .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '·';

/* /admin/services.html, /admin/services/ и /admin/services — один и тот же
   раздел. Приводим адрес к виду из ITEMS, чтобы подсветка не зависела
   от того, как человек набрал ссылку. */
function currentSection(pathname) {
  const clean = pathname.replace(/\.html$/, '').replace(/\/+$/, '');
  return clean === '' ? '/admin' : clean;
}

export async function renderAdmin() {
  const side = document.getElementById('side');
  const bar = document.getElementById('bar-side');
  const here = currentSection(location.pathname);

  if (side) {
    side.append(
      el('div', { className: 'side__mark' }, 'Ноготочки', el('small', { textContent: 'админ-панель' })),
      el('nav', { className: 'side__nav' },
        ...ITEMS.map((i) => el('a', {
          href: i.href,
          className: 'side__i' + (i.href === here ? ' side__i--on' : ''),
          textContent: i.text,
          ...(i.href === here ? { ariaCurrent: 'page' } : {})
        }))),
      el('div', { className: 'side__foot', id: 'side-foot' })
    );
  }

  /* Сеанс мог истечь, пока страница была открыта: сервер пустил на неё
     минуту назад, а сейчас уже не пустит. Уводим на вход и запоминаем,
     куда человек шёл, — тем же способом, что и серверная проверка. */
  let user = null;
  try {
    user = await me();
  } catch {
    /* Сервер недоступен — каркас всё равно нарисован. Текст ошибки покажет
       страница: место под него есть на каждой. */
  }

  if (!user) {
    location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
    return null;
  }

  const foot = document.getElementById('side-foot');
  if (foot) {
    foot.append(
      el('span', { className: 'avatar', textContent: initials(user.full_name) }),
      el('span', { textContent: `${user.full_name} · администратор` })
    );
  }

  if (bar) {
    const exit = el('button', {
      type: 'button', className: 'btn btn--ghost btn--sm', textContent: 'Выйти'
    });
    exit.addEventListener('click', async () => {
      try { await logout(); } catch { /* сеанс мог истечь — всё равно уходим */ }
      location.href = '/';
    });

    /* Ссылка ведёт на лендинг, а не в кабинет. Кабинет — экран клиентки:
       GET /api/appointments/my требует роль client и администратору отвечает
       403. Выводить человека по ссылке на страницу с ошибкой нельзя. */
    bar.append(
      el('a', { href: '/', className: 'bar__who', textContent: 'На сайт' }),
      exit
    );
  }

  return user;
}

renderAdmin();
