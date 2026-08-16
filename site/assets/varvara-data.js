window.VARVARA_DATA = {
  services: [
    { id: 'man-cover', title: 'Маникюр с покрытием', description: 'Аппаратный, гель-лак', duration: '1 ч 30 мин', price: 3200, cat: 'Маникюр' },
    { id: 'man', title: 'Маникюр без покрытия', description: 'Аппаратный, уход за кутикулой', duration: '50 мин', price: 1900, cat: 'Маникюр' },
    { id: 'ext', title: 'Наращивание', description: 'Гель, форма и длина на выбор', duration: '3 ч', price: 5500, from: true, badge: 'хит', cat: 'Наращивание' },
    { id: 'ped', title: 'Педикюр с покрытием', description: 'Медицинский аппаратный', duration: '1 ч 40 мин', price: 3800, cat: 'Педикюр' },
    { id: 'design', title: 'Дизайн ногтей', description: 'Френч, втирка, стемпинг', duration: 'от 20 мин', price: 600, from: true, cat: 'Дизайн' },
    { id: 'repair', title: 'Ремонт ногтя', duration: '15 мин', price: 400, cat: 'Маникюр' }
  ],
  masters: [
    { id: 'varvara', name: 'Варвара', role: 'Маникюр, наращивание, дизайн', rating: 4.9, reviews: 128 },
    { id: 'lena', name: 'Лена', role: 'Педикюр, маникюр', rating: 4.8, reviews: 96 },
    { id: 'aya', name: 'Ая', role: 'Дизайн, наращивание', rating: 5.0, reviews: 41 }
  ],
  days: [
    { id: '15', dow: 'сб', day: 15, free: 4 },
    { id: '16', dow: 'вс', day: 16, disabled: true },
    { id: '17', dow: 'пн', day: 17, free: 7 },
    { id: '18', dow: 'вт', day: 18, free: 2 },
    { id: '19', dow: 'ср', day: 19, free: 6 },
    { id: '20', dow: 'чт', day: 20, free: 5 },
    { id: '21', dow: 'пт', day: 21, free: 3 }
  ],
  slotGroups: [
    { label: 'Утро', icon: 'sunrise', slots: [{ time: '10:00', state: 'busy' }, { time: '10:30' }, { time: '11:00' }, { time: '11:30', state: 'busy' }] },
    { label: 'День', icon: 'sun', slots: [{ time: '12:30' }, { time: '13:00', state: 'busy' }, { time: '14:30' }, { time: '15:00', state: 'busy' }, { time: '15:30' }, { time: '16:00', state: 'busy' }] },
    { label: 'Вечер', icon: 'moon', slots: [{ time: '17:30' }, { time: '18:00' }, { time: '18:30', state: 'busy' }, { time: '19:00' }] }
  ],
  monthNames: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  bookings: [
    { id: 1, when: 'Сегодня, 15 августа · 18:00', service: 'Маникюр с покрытием', master: 'Варвара', price: '3 200 ₽', status: 'confirmed', address: 'ул. Рубинштейна, 24' },
    { id: 2, when: '17 августа · 12:30', service: 'Педикюр с покрытием', master: 'Лена', price: '3 800 ₽', status: 'pending', address: 'ул. Рубинштейна, 24' },
    { id: 3, when: '2 августа · 15:00', service: 'Наращивание', master: 'Ая', price: '5 500 ₽', status: 'done' },
    { id: 4, when: '26 июля · 11:00', service: 'Маникюр с покрытием', master: 'Варвара', price: '3 200 ₽', status: 'cancelled' }
  ]
};
