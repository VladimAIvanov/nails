window.NOGOTOCHKI_DATA = {
  services: [
    { id: 'man-gel', title: 'Маникюр с покрытием гель-лаком', description: 'Покрытие гель-лаком', duration: '1 ч 30 мин', price: 1800, cat: 'Маникюр' },
    { id: 'man-ped', title: 'Маникюр и педикюр', description: 'Маникюр и педикюр за один визит', duration: '2 ч 30 мин', price: 3200, cat: 'Педикюр' },
    { id: 'ext', title: 'Наращивание ногтей', description: 'Форма и длина на выбор', duration: '2 ч 30 мин', price: 2800, cat: 'Наращивание' },
    { id: 'design', title: 'Дизайн ногтей', description: '300 ₽ за два ногтя, добавляет к визиту 15–30 минут', duration: '30 мин', price: 300, cat: 'Дизайн' },
    { id: 'brow-tint', title: 'Коррекция и окрашивание бровей', duration: '40 мин', price: 1200, cat: 'Брови' },
    { id: 'brow-lam', title: 'Ламинирование бровей', duration: '1 ч', price: 1800, cat: 'Брови' }
  ],
  masters: [
    { id: 'anna', name: 'Анна Ковалева', role: 'Маникюр, педикюр, наращивание, дизайн', rating: 4.9, reviews: 128 },
    { id: 'marina', name: 'Марина Орлова', role: 'Брови', rating: 4.8, reviews: 96 },
    { id: 'elena', name: 'Елена Смирнова', role: 'Маникюр, наращивание, брови', rating: 5.0, reviews: 41 }
  ],
  /* Студия работает со вторника по субботу; воскресенье и понедельник закрыты. */
  days: [
    { id: '15', dow: 'вт', day: 15, free: 4 },
    { id: '16', dow: 'ср', day: 16, free: 7 },
    { id: '17', dow: 'чт', day: 17, free: 2 },
    { id: '18', dow: 'пт', day: 18, free: 6 },
    { id: '19', dow: 'сб', day: 19, free: 5 },
    { id: '20', dow: 'вс', day: 20, disabled: true },
    { id: '21', dow: 'пн', day: 21, disabled: true }
  ],
  /* Только свободные окна: занятое время и время, когда мастер не успеет
     закончить до конца смены, клиентке не показывается. */
  slotGroups: [
    { label: 'Утро', icon: 'sunrise', slots: [{ time: '11:30' }] },
    { label: 'День', icon: 'sun', slots: [{ time: '12:00' }, { time: '12:30' }, { time: '14:00' }, { time: '14:30' }, { time: '15:00' }, { time: '16:30' }] }
  ],
  monthNames: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  bookings: [
    { id: 1, when: 'Среда, 16 сентября · 10:00', service: 'Маникюр с покрытием гель-лаком', master: 'Анна Ковалева', price: '1 800 ₽', status: 'confirmed', address: 'Цветочная ул., 16' },
    { id: 2, when: 'Четверг, 17 сентября · 12:00', service: 'Ламинирование бровей', master: 'Марина Орлова', price: '1 800 ₽', status: 'confirmed', address: 'Цветочная ул., 16' },
    { id: 3, when: '2 сентября · 15:00', service: 'Наращивание ногтей', master: 'Елена Смирнова', price: '2 800 ₽', status: 'done' },
    { id: 4, when: '26 августа · 11:00', service: 'Коррекция и окрашивание бровей', master: 'Елена Смирнова', price: '1 200 ₽', status: 'cancelled' }
  ]
};
