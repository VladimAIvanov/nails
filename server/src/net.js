/* Определение адреса клиента и защищённости соединения.

   За обратным прокси прямой адрес соединения — это адрес самого прокси,
   одинаковый для всех. Ограничение частоты по нему либо накрывает всех
   разом, либо не срабатывает вовсе. Настоящий адрес приходит в заголовке
   X-Forwarded-For, но верить заголовку можно только от своего прокси:
   иначе его подставит кто угодно и обойдёт любое ограничение. */

/* Список адресов прокси, которым мы доверяем. Пусто — не доверяем никому
   и всегда берём адрес соединения.

   Запись бывает двух видов: точный адрес (127.0.0.1) и подсеть
   (172.16.0.0/12). Подсеть нужна из-за контейнеров: обратный прокси
   приходит с адреса docker-сети, и этот адрес меняется при её пересоздании.
   Со списком точных адресов конфигурация жила бы до первой пересборки,
   а потом сервис либо не поднялся бы, либо молча перестал узнавать прокси —
   и тогда кука сеанса теряет Secure, а ограничение частоты считает всех
   клиентов одним адресом. */
const TRUSTED = (process.env.TRUST_PROXY ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean);

/* ::ffff:127.0.0.1 и 127.0.0.1 — один и тот же адрес. */
const normalize = (ip) => (ip ?? '').replace(/^::ffff:/, '');

/* Адрес IPv4 числом. null — это не IPv4: подсети поддерживаются только для
   него, у IPv6 остаётся сравнение целиком. Docker-сети адресуются IPv4,
   а полутора поддержанная запись хуже честно неподдержанной. */
function ipv4ToInt(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    result = result * 256 + value;
  }
  return result;
}

const exactAddresses = new Set();
const subnets = [];

/* Только разобранные записи. Именно их считает проверка «в рабочем режиме
   TLS кто-то завершает»: если бы она считала строки как есть, то один
   опечатанный TRUST_PROXY проходил бы её, не давая при этом доверия
   ни одному адресу. Сервер поднялся бы в рабочем режиме, считая, что за ним
   прокси, — а куки уходили бы без Secure. */
const accepted = [];

/* Непонятная запись не отбрасывается молча: молчание здесь означало бы
   «прокси не доверяем», и разбираться пришлось бы по следствиям. */
export const trustProxyNotes = [];

for (const entry of TRUSTED) {
  const slash = entry.indexOf('/');
  if (slash === -1) {
    exactAddresses.add(normalize(entry));
    accepted.push(entry);
    continue;
  }

  const base = ipv4ToInt(normalize(entry.slice(0, slash)));
  const bits = Number(entry.slice(slash + 1));

  if (base === null || !Number.isInteger(bits) || bits < 0 || bits > 32) {
    trustProxyNotes.push(
      `TRUST_PROXY: запись «${entry}» не разобрана как подсеть IPv4 и пропущена. ` +
      'Ожидается вид 172.16.0.0/12; для IPv6 укажите адрес целиком.'
    );
    continue;
  }

  /* Сдвиг в JS считается по модулю 32, поэтому -1 << 32 дало бы -1 вместо
     нуля: /0 разбирается отдельно. */
  const mask = bits === 0 ? 0 : (-1 << (32 - bits)) >>> 0;
  subnets.push({ base: (base & mask) >>> 0, mask });
  accepted.push(entry);
}

function isTrusted(ip) {
  const address = normalize(ip);
  if (!address) return false;
  if (exactAddresses.has(address)) return true;
  if (subnets.length === 0) return false;

  const value = ipv4ToInt(address);
  if (value === null) return false;
  return subnets.some(({ base, mask }) => ((value & mask) >>> 0) === base);
}

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

export const trustedProxies = accepted;
