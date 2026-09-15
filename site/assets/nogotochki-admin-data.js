window.NOGOTOCHKI_ADMIN = {
  day: '15 августа, суббота',
  masters: [
    { id: 'anna', name: 'Анна', role: 'Маникюр, наращивание' },
    { id: 'lena', name: 'Лена', role: 'Педикюр, маникюр' },
    { id: 'aya', name: 'Ая', role: 'Дизайн, наращивание' }
  ],
  appointments: [
    { id: 1, master: 'anna', start: '10:00', min: 90, client: 'Марина К.', service: 'Маникюр с покрытием', price: '3 200 ₽', status: 'confirmed' },
    { id: 2, master: 'anna', start: '12:00', min: 180, client: 'Ольга П.', service: 'Наращивание', price: '5 500 ₽', status: 'confirmed' },
    { id: 3, master: 'anna', start: '18:00', min: 90, client: 'Марина К.', service: 'Маникюр с покрытием', price: '3 200 ₽', status: 'pending' },
    { id: 4, master: 'lena', start: '11:00', min: 100, client: 'Ирина С.', service: 'Педикюр с покрытием', price: '3 800 ₽', status: 'confirmed' },
    { id: 5, master: 'lena', start: '14:00', min: 50, client: 'Женя Т.', service: 'Маникюр без покрытия', price: '1 900 ₽', status: 'cancelled' },
    { id: 6, master: 'lena', start: '16:00', min: 100, client: 'Алина В.', service: 'Педикюр с покрытием', price: '3 800 ₽', status: 'confirmed' },
    { id: 7, master: 'aya', start: '10:30', min: 180, client: 'Катя Л.', service: 'Наращивание', price: '5 500 ₽', status: 'confirmed' },
    { id: 8, master: 'aya', start: '15:00', min: 60, client: 'Настя Р.', service: 'Дизайн ногтей', price: '1 200 ₽', status: 'pending' }
  ],
  rows: [
    { id: 1042, when: '15 авг · 18:00', client: 'Марина К.', phone: '+7 921 000-00-00', service: 'Маникюр с покрытием', master: 'Анна', price: '3 200 ₽', status: 'pending', source: 'Telegram' },
    { id: 1041, when: '15 авг · 16:00', client: 'Алина В.', phone: '+7 911 111-11-11', service: 'Педикюр с покрытием', master: 'Лена', price: '3 800 ₽', status: 'confirmed', source: 'Telegram' },
    { id: 1040, when: '15 авг · 15:00', client: 'Настя Р.', phone: '+7 999 222-22-22', service: 'Дизайн ногтей', master: 'Ая', price: '1 200 ₽', status: 'pending', source: 'Сайт' },
    { id: 1039, when: '15 авг · 14:00', client: 'Женя Т.', phone: '+7 903 333-33-33', service: 'Маникюр без покрытия', master: 'Лена', price: '1 900 ₽', status: 'cancelled', source: 'Сайт' },
    { id: 1038, when: '15 авг · 12:00', client: 'Ольга П.', phone: '+7 905 444-44-44', service: 'Наращивание', master: 'Анна', price: '5 500 ₽', status: 'confirmed', source: 'Telegram' },
    { id: 1037, when: '14 авг · 19:30', client: 'Даша И.', phone: '+7 906 555-55-55', service: 'Маникюр с покрытием', master: 'Анна', price: '3 200 ₽', status: 'done', source: 'Telegram' }
  ]
};
