/* Абонементы и баллы клиентки.

   Оба раздела только показывают: продаёт абонемент и списывает баллы
   студия — сервер отвечает клиентке отказом, если она попробует сама.
   Поэтому здесь нет ни одной кнопки, которая обещала бы то, чего экран
   сделать не может. */
import { api, guard, el, money, studio, actsAsClient } from './api.js';
import { renderHeader } from './header.js';

const user = await renderHeader();
if (!user) location.href = '/login?next=/bonuses';

let settings = null;

const date = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('.') : '');

// ── Абонементы ──────────────────────────────────────────────────────────────

function passCard(p) {
  const left = p.remaining;
  const expired = p.expires_on && p.expires_on < new Date().toISOString().slice(0, 10);
  const state = expired ? 'status--cancelled' : left > 0 ? 'status--confirmed' : 'status--done';
  const stateText = expired ? 'срок вышел' : left > 0 ? `осталось ${left}` : 'использован';

  /* Визиты показаны отметками, а не полосой в процентах: у абонемента их
     считанное число, и «три из пяти» читается лучше, чем шкала. Заодно
     обходимся без инлайновых стилей, которые запрещает политика страниц. */
  const dots = el('div', { className: 'bonus__dots' },
    ...Array.from({ length: p.total_visits }, (_, i) =>
      el('span', { className: `bonus__dot${i < p.used ? ' bonus__dot--used' : ''}` })));

  return el('article', { className: 'card stack' },
    el('div', { className: 'row account__head' },
      el('h4', { textContent: p.service_title }),
      el('span', { className: `status ${state}`, textContent: stateText })),
    dots,
    el('p', { className: 'muted', textContent: `${p.used} из ${p.total_visits} визитов · куплен ${date(p.purchased_at)}` }),
    p.expires_on ? el('p', { className: 'caption', textContent: `Действует до ${date(p.expires_on)}` }) : null,
    el('p', { className: 'caption', textContent: `Стоимость абонемента ${money(p.price_kopecks)}` }),
    left > 0 && !expired
      ? el('a', { className: 'btn btn--secondary btn--sm', href: `/booking?service_id=${p.service_id}`, textContent: 'Записаться по абонементу' })
      : null
  );
}

/* Абонементы и баллы принадлежат клиентке. Сотруднику те же адреса
   отвечают «Укажите client_id»: он смотрит чужие, а не свои. Экрана для
   этого пока нет, поэтому вместо запроса — объяснение. */
function staffNote() {
  document.getElementById('passes').replaceChildren(
    el('div', { className: 'note note--info' },
      'Абонементы и баллы клиенток студия смотрит в их карточках. Этот экран показывает свои.')
  );
  /* Второй раздел убираем целиком: пустой заголовок «Баллы» читается как
     страница, которая не догрузилась, а объяснение уже дано выше. */
  document.getElementById('balance').closest('section')?.remove();
}

async function loadPasses() {
  const { passes } = await api('GET', '/api/passes');
  const box = document.getElementById('passes');

  if (passes.length === 0) {
    box.replaceChildren(
      el('p', { className: 'muted' },
        'Абонементов нет. Их оформляет студия при визите: несколько посещений одной услуги по цене ниже разовой.'),
      el('a', { className: 'btn btn--secondary btn--sm', href: '/booking', textContent: 'Записаться' })
    );
    return;
  }

  box.replaceChildren(...passes.map(passCard));
}

// ── Баллы ───────────────────────────────────────────────────────────────────

const KINDS = { earned: 'начислено', spent: 'списано', adjusted: 'исправление' };

/* «1 балл», «22 балла», «31 балл», «15 баллов» — обычное русское согласование,
   а не «31 баллов». */
function points(n) {
  const last = n % 10;
  const two = n % 100;
  if (last === 1 && two !== 11) return 'балл';
  if (last >= 2 && last <= 4 && (two < 12 || two > 14)) return 'балла';
  return 'баллов';
}

async function loadLoyalty() {
  const { balance, history } = await api('GET', '/api/loyalty');

  document.getElementById('balance').replaceChildren(
    el('div', { className: 'bonus__balance' },
      el('span', { className: 'bonus__value', textContent: String(balance) }),
      el('span', { className: 'muted', textContent: points(balance) })),
    el('p', { className: 'muted' },
      balance > 0
        ? 'Скажите о баллах на визите — студия спишет их при оплате.'
        : `Баллы начисляются после визита: ${settings.loyalty_points_per_100_rub ?? ''} за каждые 100 ₽.`.trim())
  );

  const box = document.getElementById('history');
  if (history.length === 0) {
    box.replaceChildren(el('p', { className: 'muted' }, 'Пока пусто — баллы появятся после первого состоявшегося визита.'));
    return;
  }

  box.replaceChildren(...history.map((e) => el('div', { className: 'profile__row' },
    el('div', {},
      el('div', { className: 'sum__value', textContent: e.comment || KINDS[e.kind] || e.kind }),
      el('div', { className: 'muted', textContent: `${KINDS[e.kind] ?? e.kind} · ${date(e.created_at)}` })),
    el('span', { className: `bonus__delta ${e.points > 0 ? 'bonus__delta--plus' : 'bonus__delta--minus'}`,
      textContent: `${e.points > 0 ? '+' : ''}${e.points}` })))
  );
}

// ── Загрузка ────────────────────────────────────────────────────────────────

if (actsAsClient(user)) {
  await guard(async () => { settings = await studio(); })();
  await guard(loadPasses)();
  await guard(loadLoyalty)();
} else {
  staffNote();
}
