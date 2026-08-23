/* Определение адреса клиента и защищённости соединения.

   За обратным прокси прямой адрес соединения — это адрес самого прокси,
   одинаковый для всех. Ограничение частоты по нему либо накрывает всех
   разом, либо не срабатывает вовсе. Настоящий адрес приходит в заголовке
   X-Forwarded-For, но верить заголовку можно только от своего прокси:
   иначе его подставит кто угодно и обойдёт любое ограничение. */

/* Список адресов прокси, которым мы доверяем. Пусто — не доверяем никому
   и всегда берём адрес соединения. */
const TRUSTED = (process.env.TRUST_PROXY ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean);

/* ::ffff:127.0.0.1 и 127.0.0.1 — один и тот же адрес. */
const normalize = (ip) => (ip ?? '').replace(/^::ffff:/, '');

const isTrusted = (ip) => TRUSTED.includes(normalize(ip));

/**
 * Адрес клиента с учётом цепочки прокси.
 *
 * X-Forwarded-For читается справа налево: крайний справа добавлен ближайшим
 * прокси и потому достовернее всего. Пропускаем свои прокси и берём первый
 * недоверенный адрес — это и есть клиент. Всё, что левее, мог написать сам
 * клиент, и доверять этому нельзя.
 */
export function clientIp(req) {
  const direct = normalize(req.socket?.remoteAddress);
  if (!isTrusted(direct)) return direct;

  const chain = String(req.headers['x-forwarded-for'] ?? '')
    .split(',').map((s) => normalize(s.trim())).filter(Boolean);

  for (let i = chain.length - 1; i >= 0; i--) {
    if (!isTrusted(chain[i])) return chain[i];
  }

  // вся цепочка состоит из наших прокси — считаем клиентом ближайший к нам
  return chain[0] ?? direct;
}

/* Соединение защищено, если TLS у нас или его завершил доверенный прокси
   и сообщил об этом заголовком. Заголовок без доверия к отправителю
   ничего не значит. */
export function isSecure(req) {
  if (req.socket?.encrypted) return true;
  if (!isTrusted(req.socket?.remoteAddress)) return false;
  return String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https';
}

export const trustedProxies = TRUSTED;
