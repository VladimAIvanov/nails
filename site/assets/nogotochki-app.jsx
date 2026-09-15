/* Telegram mini-app «Ноготочки»: флоу клиента — запись в три шага + мои записи + профиль.
   Адаптировано из ui_kits/telegram_mini_app (booking-flow.jsx + account.jsx + app.jsx) design-system проекта. */

function ServicesScreen({ cat, setCat, service, onPick, onNext }) {
  const D = window.DesignSystem_f8f42b;
  const data = window.NOGOTOCHKI_DATA;
  const cats = ['Все', 'Маникюр', 'Педикюр', 'Наращивание', 'Дизайн'];
  const list = cat === 'Все' ? data.services : data.services.filter((s) => s.cat === cat);
  return (
    <div className="scr">
      <div className="hello">
        <div className="hello__hi">Добрый день, Марина</div>
        <div className="hello__title">Что делаем сегодня?</div>
      </div>
      <div className="filters">
        {cats.map((c) => <D.Chip key={c} selected={c === cat} onClick={() => setCat(c)}>{c}</D.Chip>)}
      </div>
      <div className="scr__body">
        <div className="list">
          {list.map((s) => (
            <D.ServiceCard key={s.id} title={s.title} description={s.description} duration={s.duration} price={s.price} from={s.from} badge={s.badge} selected={service && service.id === s.id} onClick={() => onPick(s)} />
          ))}
        </div>
        <D.Notice tone="info">Отмена и перенос бесплатны за 4 часа до визита.</D.Notice>
      </div>
      {service ? (
        <div className="scr__cta">
          <div className="scr__cta-meta"><span>{service.title}</span><span className="scr__cta-price">{service.from ? 'от ' : ''}{service.price.toLocaleString('ru-RU')} ₽</span></div>
          <D.Button block size="lg" onClick={onNext}>Выбрать мастера</D.Button>
        </div>
      ) : null}
    </div>
  );
}

function MastersScreen({ master, onPick, onNext }) {
  const D = window.DesignSystem_f8f42b;
  const data = window.NOGOTOCHKI_DATA;
  return (
    <div className="scr">
      <div className="stepwrap"><D.Stepper steps={['Услуга', 'Мастер', 'Время', 'Готово']} current={1} /></div>
      <div className="scr__body">
        <div className="list">
          <D.Card variant="tight" interactive selected={master && master.id === 'any'} onClick={() => onPick({ id: 'any', name: 'Любой свободный' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <D.Icon name="sparkles" size={20} color="var(--clay-600)" />
              <div>
                <div className="v-h4">Любой свободный мастер</div>
                <div className="v-body-sm">Больше свободных окон</div>
              </div>
            </div>
          </D.Card>
          {data.masters.map((m) => (
            <D.MasterCard key={m.id} name={m.name} role={m.role} rating={m.rating} reviews={m.reviews} works={['', '', '', '']} selected={master && master.id === m.id} onClick={() => onPick(m)} />
          ))}
        </div>
      </div>
      {master ? (
        <div className="scr__cta">
          <D.Button block size="lg" onClick={onNext}>К выбору времени</D.Button>
        </div>
      ) : null}
    </div>
  );
}

function TimeScreen({ day, setDay, time, setTime, service, onNext }) {
  const D = window.DesignSystem_f8f42b;
  const data = window.NOGOTOCHKI_DATA;
  return (
    <div className="scr">
      <div className="stepwrap"><D.Stepper steps={['Услуга', 'Мастер', 'Время', 'Готово']} current={2} /></div>
      <div className="scr__body">
        <D.DateStrip days={data.days} value={day} onChange={(d) => { setDay(d); setTime(null); }} />
        <D.SlotPicker groups={data.slotGroups} value={time} onChange={setTime} />
      </div>
      <div className="scr__cta">
        <div className="scr__cta-meta">
          <span>{time ? `${day} августа, ${time}` : 'Выберите время'}</span>
          <span className="scr__cta-price">{service ? (service.from ? 'от ' : '') + service.price.toLocaleString('ru-RU') + ' ₽' : ''}</span>
        </div>
        <D.Button block size="lg" disabled={!time} onClick={onNext}>Продолжить</D.Button>
      </div>
    </div>
  );
}

function ConfirmSheet({ open, onClose, onSubmit, service, master, day, time }) {
  const D = window.DesignSystem_f8f42b;
  if (!service) return null;
  return (
    <D.BottomSheet open={open} title="Проверьте запись" onClose={onClose} footer={<D.Button block size="lg" onClick={onSubmit}>Записаться</D.Button>}>
      <div className="sum" style={{ marginBottom: 16 }}>
        <div className="sum__row"><span className="sum__k">Услуга</span><span className="sum__v">{service.title}</span></div>
        <div className="sum__row"><span className="sum__k">Мастер</span><span className="sum__v">{master ? master.name : 'Любой свободный'}</span></div>
        <div className="sum__row"><span className="sum__k">Когда</span><span className="sum__v">{day} августа, {time}</span></div>
        <div className="sum__row"><span className="sum__k">Длительность</span><span className="sum__v">{service.duration}</span></div>
        <div className="sum__row"><span className="sum__k">Стоимость</span><span className="sum__v v-price">{(service.from ? 'от ' : '') + service.price.toLocaleString('ru-RU')} ₽</span></div>
      </div>
      <D.Input label="Телефон" iconLeft="phone" defaultValue="+7 921 000-00-00" hint="Напомним в Telegram за 2 часа" />
      <div style={{ marginTop: 8, marginBottom: 12 }}><D.Checkbox label="Согласна на обработку данных" defaultChecked /></div>
    </D.BottomSheet>
  );
}

function DoneScreen({ service, master, day, time, onMy }) {
  const D = window.DesignSystem_f8f42b;
  return (
    <div className="scr">
      <div className="done">
        <div className="done__mark"><D.Icon name="check" size={38} color="var(--sage-600)" /></div>
        <div>
          <h2 style={{ fontSize: 26 }}>Записали вас</h2>
          <p className="v-body" style={{ marginTop: 6 }}>{day} августа в {time}. Подтверждение придёт в Telegram, напомним за два часа.</p>
        </div>
        <div style={{ width: '100%', textAlign: 'left' }}>
          <D.BookingCard when={`${day} августа · ${time}`} service={service ? service.title : ''} master={master ? master.name : 'Любой свободный'} price={service ? service.price.toLocaleString('ru-RU') + ' ₽' : ''} status="confirmed" address="ул. Рубинштейна, 24" />
        </div>
      </div>
      <div className="scr__cta">
        <D.Button block size="lg" variant="secondary" onClick={onMy}>Мои записи</D.Button>
      </div>
    </div>
  );
}

function MyBookingsScreen({ onBook }) {
  const D = window.DesignSystem_f8f42b;
  const data = window.NOGOTOCHKI_DATA;
  const upcoming = data.bookings.filter((b) => b.status === 'confirmed' || b.status === 'pending');
  const past = data.bookings.filter((b) => b.status === 'done' || b.status === 'cancelled');
  return (
    <div className="scr">
      <div className="hello"><div className="hello__title">Мои записи</div></div>
      <div className="scr__body">
        <div className="list">
          {upcoming.map((b) => (
            <D.BookingCard key={b.id} when={b.when} service={b.service} master={b.master} price={b.price} address={b.address} status={b.status}
              actions={<><D.Button variant="secondary" size="sm">Перенести</D.Button><D.Button variant="ghost" size="sm">Отменить</D.Button></>} />
          ))}
        </div>
        <div className="v-overline" style={{ marginTop: 8 }}>История</div>
        <div className="list">
          {past.map((b) => (
            <D.BookingCard key={b.id} when={b.when} service={b.service} master={b.master} price={b.price} status={b.status}
              actions={<D.Button variant="soft" size="sm" onClick={onBook}>Повторить</D.Button>} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfileScreen() {
  const D = window.DesignSystem_f8f42b;
  return (
    <div className="scr">
      <div className="hello"><div className="hello__title">Профиль</div></div>
      <div className="scr__body">
        <div className="prof__head">
          <D.Avatar name="Марина" size={64} ring />
          <div>
            <div className="prof__name">Марина</div>
            <div className="v-body-sm">+7 921 000-00-00</div>
          </div>
        </div>
        <D.Card>
          <div className="prof__row"><span>Напоминать в Telegram</span><D.Switch defaultChecked /></div>
          <div className="prof__row"><span>Новые окна у Анны</span><D.Switch /></div>
          <div className="prof__row"><span>Акции и новинки</span><D.Switch /></div>
        </D.Card>
        <D.Card variant="accent">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <D.Icon name="map-pin" size={18} color="var(--clay-600)" />
            <div>
              <div className="v-h4">Санкт-Петербург, ул. Рубинштейна, 24</div>
              <p className="v-body-sm" style={{ marginTop: 4 }}>Второй этаж, домофон 24. Ежедневно 10:00–21:00, воскресенье выходной.</p>
              <div style={{ marginTop: 12 }}><D.Button variant="secondary" size="sm" iconLeft={<D.Icon name="phone" size={16} />}>Позвонить</D.Button></div>
            </div>
          </div>
        </D.Card>
        <div className="v-overline">Любимые мастера</div>
        <div className="list">
          <D.MasterCard name="Анна" role="Маникюр, наращивание, дизайн" rating={4.9} reviews={128} action={<D.Chip interactive={false} icon="heart">в избранном</D.Chip>} />
        </div>
      </div>
    </div>
  );
}

function MiniApp() {
  const D = window.DesignSystem_f8f42b;
  const [tab, setTab] = React.useState('book');
  const [step, setStep] = React.useState(0);
  const [cat, setCat] = React.useState('Все');
  const [service, setService] = React.useState(null);
  const [master, setMaster] = React.useState(null);
  const [day, setDay] = React.useState('15');
  const [time, setTime] = React.useState(null);
  const [sheet, setSheet] = React.useState(false);

  const titles = ['', 'Выбор мастера', 'Выбор времени', 'Готово'];
  const reset = () => { setStep(0); setService(null); setMaster(null); setTime(null); };

  let screen = null;
  if (tab === 'book' && step === 0) screen = <ServicesScreen cat={cat} setCat={setCat} service={service} onPick={setService} onNext={() => setStep(1)} />;
  if (tab === 'book' && step === 1) screen = <MastersScreen master={master} onPick={setMaster} onNext={() => setStep(2)} />;
  if (tab === 'book' && step === 2) screen = <TimeScreen day={day} setDay={setDay} time={time} setTime={setTime} service={service} onNext={() => setSheet(true)} />;
  if (tab === 'book' && step === 3) screen = <DoneScreen service={service} master={master} day={day} time={time} onMy={() => { setTab('my'); reset(); }} />;
  if (tab === 'my') screen = <MyBookingsScreen onBook={() => { setTab('book'); reset(); }} />;
  if (tab === 'profile') screen = <ProfileScreen />;

  return (
    <div className="phone">
      <div className="tg-chrome">
        <span>10:24</span>
        <span className="tg-chrome__title">Ноготочки · запись</span>
        <span className="tg-chrome__dots">···  ✕</span>
      </div>
      {tab === 'book' && step > 0 && step < 3 ? (
        <D.TopBar title={titles[step]} onBack={() => setStep(step - 1)} right={<D.IconButton icon="x" label="Отменить запись" onClick={reset} />} />
      ) : null}
      {screen}
      <div className="navwrap">
        <D.BottomNav
          value={tab}
          onChange={(t) => { setTab(t); if (t === 'book') reset(); }}
          items={[
            { id: 'book', icon: 'sparkles', label: 'Записаться' },
            { id: 'my', icon: 'calendar-check', label: 'Мои записи', badge: 2 },
            { id: 'profile', icon: 'user', label: 'Профиль' }
          ]}
        />
      </div>
      <ConfirmSheet open={sheet} onClose={() => setSheet(false)} onSubmit={() => { setSheet(false); setStep(3); }} service={service} master={master} day={day} time={time} />
    </div>
  );
}

Object.assign(window, { MiniApp });
