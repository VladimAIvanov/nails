/* Сайт студии «Варвара»: секции лендинга + модалка онлайн-записи. Адаптировано из ui_kits/website (site.jsx + booking-modal.jsx) design-system проекта. */

function Header({ onBook }) {
  const D = window.DesignSystem_f8f42b;
  return (
    <header className="hdr">
      <div className="wrap hdr__in">
        <div className="mark">Варвара<small>ногтевая студия</small></div>
        <nav className="nav">
          <a href="#services">Услуги</a><a href="#masters">Мастера</a><a href="#works">Работы</a><a href="#contacts">Контакты</a>
        </nav>
        <D.Button variant="ghost" as="a" href="./Вход.dc.html">Войти</D.Button>
        <D.Button onClick={onBook}>Записаться</D.Button>
      </div>
    </header>
  );
}

function Hero({ onBook }) {
  const D = window.DesignSystem_f8f42b;
  return (
    <div className="wrap hero">
      <div>
        <div className="hero__eyebrow">Санкт-Петербург · Рубинштейна, 24</div>
        <h1>Аккуратные ногти<br />без спешки</h1>
        <p>Маникюр, педикюр и наращивание в маленькой студии на четыре кресла. Одна мастер — одна клиентка, стерильные инструменты, честное время в записи.</p>
        <div className="hero__cta">
          <D.Button size="lg" onClick={onBook}>Записаться онлайн</D.Button>
          <D.Button size="lg" variant="secondary" as="a" href="#works">Смотреть работы</D.Button>
        </div>
      </div>
      <div className="hero__art">
        <D.ImageFrame ratio="4 / 5" radius="40px" label="Фото студии или работы мастера" />
        <div className="hero__badge">
          <D.Rating value={4.9} count={265} />
          <span className="v-caption">Средняя оценка за год</span>
        </div>
      </div>
    </div>
  );
}

function Strip() {
  const D = window.DesignSystem_f8f42b;
  const items = [
    ['shield-check', 'Стерильность', 'Автоклав, одноразовые файлы, всё вскрываем при вас'],
    ['clock', 'Честное время', 'В записи стоит реальная длительность, без «подождите ещё час»'],
    ['send', 'Запись в Telegram', 'Бот подтверждает окно и напоминает за два часа'],
    ['sparkles', 'Свои материалы', 'Гель-лаки и базы, с которыми носится 4 недели']
  ];
  return (
    <div className="wrap"><div className="strip">
      {items.map((i) => (
        <div className="strip__i" key={i[1]}>
          <D.Icon name={i[0]} size={20} color="var(--clay-600)" />
          <div><div className="strip__t">{i[1]}</div><div className="strip__d">{i[2]}</div></div>
        </div>
      ))}
    </div></div>
  );
}

function Services({ onBook }) {
  const D = window.DesignSystem_f8f42b;
  const data = window.VARVARA_DATA;
  const [cat, setCat] = React.useState('Все');
  const cats = ['Все', 'Маникюр', 'Педикюр', 'Наращивание', 'Дизайн'];
  const list = cat === 'Все' ? data.services : data.services.filter((s) => s.cat === cat);
  return (
    <section className="sec" id="services"><div className="wrap">
      <D.SectionHeader eyebrow="Услуги" title="Что мы делаем" subtitle="Цена за работу целиком: снятие, уход и покрытие уже внутри."
        action={<D.Button variant="ghost" onClick={onBook}>Записаться</D.Button>} />
      <div style={{ display: 'flex', gap: 8, margin: '8px 0 24px' }}>
        {cats.map((c) => <D.Chip key={c} selected={c === cat} onClick={() => setCat(c)}>{c}</D.Chip>)}
      </div>
      <div className="grid2">
        {list.map((s) => <D.ServiceCard key={s.id} title={s.title} description={s.description} duration={s.duration} price={s.price} from={s.from} badge={s.badge} onClick={onBook} />)}
      </div>
    </div></section>
  );
}

function Masters({ onBook }) {
  const D = window.DesignSystem_f8f42b;
  const data = window.VARVARA_DATA;
  return (
    <section className="sec sec--alt" id="masters"><div className="wrap">
      <D.SectionHeader eyebrow="Команда" title="Мастера" subtitle="У каждой — своя специализация и своё расписание. Можно записаться к конкретной." />
      <div className="grid3">
        {data.masters.map((m) => (
          <D.MasterCard key={m.id} layout="stacked" name={m.name} role={m.role} rating={m.rating} reviews={m.reviews}
            action={<D.Button variant="secondary" size="sm" onClick={onBook}>Записаться</D.Button>} />
        ))}
      </div>
    </div></section>
  );
}

function Works() {
  const D = window.DesignSystem_f8f42b;
  const labels = ['Нюд с втиркой', 'Френч', 'Матовое покрытие', 'Наращивание, форма миндаль', 'Дизайн с фольгой', 'Педикюр'];
  return (
    <section className="sec" id="works"><div className="wrap">
      <D.SectionHeader eyebrow="Портфолио" title="Работы" subtitle="Снимаем без фильтров, при дневном свете." />
      <div className="gallery">
        {labels.map((l, i) => <D.ImageFrame key={l} ratio="1 / 1" tone={i % 3 === 2 ? 'cream' : 'nude'} label={l} />)}
      </div>
    </div></section>
  );
}

function Band({ onBook }) {
  const D = window.DesignSystem_f8f42b;
  return (
    <div className="wrap" style={{ paddingBottom: 24 }}>
      <div className="band">
        <div>
          <h2>Свободные окна<br />на этой неделе</h2>
          <p>Выберите мастера и время — подтверждение придёт в Telegram за минуту.</p>
        </div>
        <D.Button size="lg" variant="inverse" onClick={onBook}>Записаться</D.Button>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="ftr" id="contacts"><div className="wrap">
      <div className="ftr__in">
        <div>
          <div className="mark">Варвара<small>ногтевая студия</small></div>
          <p className="v-body-sm" style={{ marginTop: 16, maxWidth: '32ch' }}>Санкт-Петербург, ул. Рубинштейна, 24, второй этаж.</p>
        </div>
        <div><h4>Часы</h4><ul><li>Пн–Сб 10:00–21:00</li><li>Вс выходной</li></ul></div>
        <div><h4>Связь</h4><ul><li>+7 921 000-00-00</li><li>@varvara_nails_bot</li><li>hello@varvara.studio</li></ul></div>
        <div><h4>Услуги</h4><ul><li>Маникюр</li><li>Педикюр</li><li>Наращивание</li><li>Дизайн</li></ul></div>
      </div>
      <div className="ftr__legal">
        <span>© 2026 Студия «Варвара»</span>
        <a href="./Варианты.dc.html" style={{ color: 'inherit' }}>Другие экраны и варианты интерфейса →</a>
      </div>
    </div></footer>
  );
}

/* Модалка записи: услуга и мастер → время → контакты → подтверждение. */
function BookingModal({ open, onClose }) {
  const D = window.DesignSystem_f8f42b;
  const data = window.VARVARA_DATA;
  const [step, setStep] = React.useState(0);
  const [service, setService] = React.useState(data.services[0]);
  const [master, setMaster] = React.useState(data.masters[0]);
  const [day, setDay] = React.useState('15');
  const [time, setTime] = React.useState(null);
  if (!open) return null;

  const titles = ['Услуга и мастер', 'Дата и время', 'Ваши контакты', 'Запись подтверждена'];
  const close = () => { setStep(0); setTime(null); onClose(); };

  return (
    <div className="modal" onClick={close}>
      <div className="modal__box" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Онлайн-запись">
        <div className="modal__head">
          <div>
            <div className="v-overline" style={{ marginBottom: 8 }}>Онлайн-запись</div>
            <h3 style={{ fontSize: 30 }}>{titles[step]}</h3>
          </div>
          <D.IconButton icon="x" label="Закрыть" onClick={close} />
        </div>

        {step < 3 ? <div style={{ marginBottom: 24 }}><D.Stepper steps={['Услуга', 'Время', 'Контакты']} current={step} /></div> : null}

        {step === 0 ? (
          <div className="stack">
            <div className="grid2">
              {data.services.slice(0, 4).map((s) => (
                <D.ServiceCard key={s.id} title={s.title} duration={s.duration} price={s.price} from={s.from} selected={service.id === s.id} onClick={() => setService(s)} />
              ))}
            </div>
            <div className="v-overline">Мастер</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {data.masters.map((m) => <D.Chip key={m.id} selected={master.id === m.id} onClick={() => setMaster(m)}>{m.name}</D.Chip>)}
              <D.Chip selected={master.id === 'any'} onClick={() => setMaster({ id: 'any', name: 'Любой свободный' })}>Любой свободный</D.Chip>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="stack">
            <D.DateStrip days={data.days} value={day} onChange={(d) => { setDay(d); setTime(null); }} />
            <D.SlotPicker groups={data.slotGroups} value={time} onChange={setTime} />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="stack">
            <div className="grid2">
              <D.Input label="Имя" placeholder="Марина" required />
              <D.Input label="Телефон" iconLeft="phone" placeholder="+7 ___ ___-__-__" required />
            </div>
            <D.TextArea label="Комментарий" rows={2} placeholder="Пожелания к дизайну, аллергии, всё важное" />
            <D.Checkbox label="Согласна на обработку персональных данных" defaultChecked />
            <D.Notice tone="info">Отмена и перенос бесплатны за 4 часа до визита.</D.Notice>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="stack">
            <D.Notice tone="success" title="Ждём вас">Подтверждение отправили в Telegram и на телефон.</D.Notice>
            <D.BookingCard when={`${day} августа · ${time || '18:00'}`} service={service.title} master={master.name} price={service.price.toLocaleString('ru-RU') + ' ₽'} address="ул. Рубинштейна, 24" status="confirmed" />
          </div>
        ) : null}

        <div className="modal__foot">
          <div className="modal__sum">
            {step === 3 ? 'Запись №1042' : service.title + ' · ' + (master.id === 'any' ? 'любой мастер' : master.name)}
            <b>{step === 3 ? 'Готово' : (service.from ? 'от ' : '') + service.price.toLocaleString('ru-RU') + ' ₽ · ' + service.duration}</b>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {step > 0 && step < 3 ? <D.Button variant="secondary" size="lg" onClick={() => setStep(step - 1)}>Назад</D.Button> : null}
            {step < 2 ? <D.Button size="lg" disabled={step === 1 && !time} onClick={() => setStep(step + 1)}>Далее</D.Button> : null}
            {step === 2 ? <D.Button size="lg" onClick={() => setStep(3)}>Записаться</D.Button> : null}
            {step === 3 ? <D.Button size="lg" variant="secondary" onClick={close}>Закрыть</D.Button> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Site() {
  const [open, setOpen] = React.useState(false);
  const book = () => setOpen(true);
  return (
    <React.Fragment>
      <Header onBook={book} />
      <Hero onBook={book} />
      <Strip />
      <Services onBook={book} />
      <Masters onBook={book} />
      <Works />
      <Band onBook={book} />
      <Footer />
      <BookingModal open={open} onClose={() => setOpen(false)} />
    </React.Fragment>
  );
}

Object.assign(window, { Site });
