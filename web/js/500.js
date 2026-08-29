/* Страница «сервис не отвечает».

   Она не притворяется, что всё хорошо: сама проверяет связь и говорит,
   что увидела. Если сервер ожил — предлагает вернуться, а не оставляет
   человека гадать. */
import { api, el } from './api.js';
import { renderHeader } from './header.js';

renderHeader();

const state = document.getElementById('state');
const retry = document.getElementById('retry');

async function check() {
  state.className = 'note note--info';
  state.textContent = 'Проверяем связь…';
  retry.disabled = true;

  try {
    const health = await api('GET', '/api/health');
    state.className = 'note note--ok';
    state.replaceChildren(
      el('span', {}, `Сервис отвечает, время сервера ${new Date(health.time).toLocaleTimeString('ru-RU')}. `),
      el('a', { href: '/', textContent: 'Вернуться на главную' })
    );
  } catch (err) {
    state.className = 'note note--error';
    state.textContent = `Связи по-прежнему нет: ${err.message}`;
  } finally {
    retry.disabled = false;
  }
}

retry.addEventListener('click', check);

/* Телефон студии — из настроек, если сервис всё-таки доступен. */
try {
  const s = await api('GET', '/api/studio');
  if (s.phone) {
    document.getElementById('studio').replaceChildren(
      el('span', {}, 'Если нужно записаться прямо сейчас — позвоните: '),
      el('a', { href: `tel:${s.phone.replace(/[^+\d]/g, '')}`, textContent: s.phone })
    );
  }
} catch {
  /* Телефона не будет — это ровно тот случай, ради которого страница есть. */
}

await check();
