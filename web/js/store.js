/* Черновик записи: что клиентка выбрала, пока идёт по шагам.

   Это не данные сервиса и не пропуск — это незаконченный выбор, который
   нужен только между четырьмя экранами оформления. Поэтому sessionStorage:
   он живёт до закрытия вкладки и не переезжает в другие окна. Всё остальное
   по-прежнему хранится на сервере.

   Правило то же, что и раньше: ничего лишнего здесь не держим. Услуги и
   мастер — идентификаторами, названия и цены каждый экран берёт из API. */

const KEY = 'varvara.booking';

const empty = () => ({
  serviceIds: [],
  masterId: null,
  anyMaster: false,
  date: null,
  startsAt: null,
  holdToken: null,
  holdExpiresAt: null,
  /* Перенос существующей записи: услуги и мастер зафиксированы. */
  rescheduleId: null
});

export function read() {
  try {
    return { ...empty(), ...JSON.parse(sessionStorage.getItem(KEY) ?? '{}') };
  } catch {
    return empty();
  }
}

export function write(patch) {
  const next = { ...read(), ...patch };
  sessionStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function reset() {
  sessionStorage.removeItem(KEY);
}

/* Чего не хватает, чтобы идти дальше. Пустая строка — можно.
   Текст пишется рядом с неактивной кнопкой: человек должен видеть причину,
   а не гадать, почему кнопка не нажимается. */
export function missing(step) {
  const state = read();

  if (step === 'services' && state.serviceIds.length === 0) {
    return 'Отметьте хотя бы одну услугу';
  }
  if (step === 'master' && !state.masterId && !state.anyMaster) {
    return 'Выберите мастера или «любого свободного»';
  }
  if (step === 'time' && !state.startsAt) {
    return 'Выберите свободное окно';
  }
  return '';
}
