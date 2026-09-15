/* Админ-панель «Ноготочки»: флоу владелицы (полный доступ) и флоу мастера (только своё расписание и свои записи).
   Адаптировано из ui_kits/admin (admin.jsx) design-system проекта; ролевой переключатель — новое для объединённого прототипа. */

const ADM_START = 600; // 10:00 в минутах
const ADM_ROWS = 22;   // до 21:00, шаг 30 минут
const toMin = (t) => Number(t.split(':')[0]) * 60 + Number(t.split(':')[1]);
const rub = (s) => Number(String(s).replace(/\D/g, '')) || 0;

function RoleSwitch({ role, setRole }) {
  const D = window.DesignSystem_f8f42b;
  const A = window.NOGOTOCHKI_ADMIN;
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', rowGap: 8, justifyContent: 'flex-end' }}>
      <span className="v-caption" style={{ marginRight: 2 }}>Показать как:</span>
      <D.Chip selected={role === 'owner'} onClick={() => setRole('owner')}>Владелица</D.Chip>
      {A.masters.map((m) => <D.Chip key={m.id} selected={role === m.id} onClick={() => setRole(m.id)}>{m.name} · мастер</D.Chip>)}
    </div>
  );
}

function Sidebar({ view, setView, role }) {
  const D = window.DesignSystem_f8f42b;
  const A = window.NOGOTOCHKI_ADMIN;
  const isOwner = role === 'owner';
  const items = isOwner
    ? [['day', 'calendar-days', 'Расписание'], ['list', 'list', 'Записи'], ['services', 'sparkles', 'Услуги'], ['settings', 'settings', 'Настройки']]
    : [['day', 'calendar-days', 'Моё расписание'], ['list', 'list', 'Мои записи']];
  const master = A.masters.find((m) => m.id === role);
  return (
    <aside className="side">
      <div className="side__mark">Ноготочки<small>{isOwner ? 'админ-панель' : 'кабинет мастера'}</small></div>
      <nav className="side__nav">
        {items.map((i) => (
          <button key={i[0]} className={'side__i' + (view === i[0] ? ' side__i--on' : '')} onClick={() => setView(i[0])}>
            <D.Icon name={i[1]} size={18} />{i[2]}
          </button>
        ))}
      </nav>
      <div className="side__foot"><D.Avatar name={isOwner ? 'Анна' : master.name} size={32} />{isOwner ? 'Анна · владелица' : master.name + ' · мастер'}</div>
    </aside>
  );
}

function DayView({ role, onSelect }) {
  const D = window.DesignSystem_f8f42b;
  const A = window.NOGOTOCHKI_ADMIN;
  const isOwner = role === 'owner';
  const masters = isOwner ? A.masters : A.masters.filter((m) => m.id === role);
  const appts = isOwner ? A.appointments : A.appointments.filter((a) => a.master === role);
  const times = Array.from({ length: ADM_ROWS }, (_, i) => ADM_START + i * 30).filter((_, i) => i % 2 === 0);
  const kpis = isOwner
    ? [['8', 'записей на сегодня'], ['26 900 ₽', 'ожидаемая выручка'], ['2', 'ждут подтверждения'], ['4', 'свободных окна']]
    : [[String(appts.length), 'записей сегодня'], [appts.filter((a) => a.status === 'confirmed').reduce((s, a) => s + rub(a.price), 0).toLocaleString('ru-RU') + ' ₽', 'ожидаемая выручка'], [String(appts.filter((a) => a.status === 'pending').length), 'ждут подтверждения']];
  return (
    <React.Fragment>
      <div className="kpis" style={{ gridTemplateColumns: `repeat(${kpis.length},1fr)` }}>
        {kpis.map((k) => (
          <D.Card key={k[1]} variant="tight"><div className="kpi__v">{k[0]}</div><div className="kpi__l">{k[1]}</div></D.Card>
        ))}
      </div>
      <div className="sched" style={{ gridTemplateColumns: `64px repeat(${masters.length},1fr)` }}>
        <div className="sched__h" style={{ borderRight: '1px solid var(--border-subtle)' }}><div className="v-caption">{A.day}</div></div>
        {masters.map((m) => (
          <div className="sched__h" key={m.id}><div className="sched__name">{m.name}</div><div className="sched__role">{m.role}</div></div>
        ))}
        <div className="sched__times" style={{ gridTemplateRows: `repeat(${ADM_ROWS / 2}, 68px)` }}>
          {times.map((t) => <div className="sched__t" key={t}>{String(Math.floor(t / 60)).padStart(2, '0')}:00</div>)}
        </div>
        {masters.map((m) => (
          <div className="sched__col" key={m.id} style={{ gridTemplateRows: `repeat(${ADM_ROWS}, 34px)` }}>
            {Array.from({ length: ADM_ROWS }, (_, i) => <div className="sched__cell" key={i} style={{ gridRow: i + 1, gridColumn: 1 }}></div>)}
            {appts.filter((a) => a.master === m.id).map((a) => {
              const row = (toMin(a.start) - ADM_START) / 30 + 1;
              return (
                <div key={a.id} className={'appt appt--' + a.status} style={{ gridRow: `${row} / span ${a.min / 30}`, gridColumn: 1, zIndex: 2 }} onClick={() => onSelect(a)}>
                  <b>{a.start} · {a.client}</b>{a.service}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="v-caption">Глиняная карточка — запись подтверждена, медовая — ждёт подтверждения, зачёркнутая песочная — отменена.</div>
    </React.Fragment>
  );
}

function ListView({ role }) {
  const D = window.DesignSystem_f8f42b;
  const A = window.NOGOTOCHKI_ADMIN;
  const isOwner = role === 'owner';
  const masterName = isOwner ? null : A.masters.find((m) => m.id === role).name;
  const [f, setF] = React.useState('Все');
  const map = { 'Все': null, 'Ждут подтверждения': 'pending', 'Подтверждённые': 'confirmed', 'Отменённые': 'cancelled' };
  let rows = map[f] ? A.rows.filter((r) => r.status === map[f]) : A.rows;
  if (!isOwner) rows = rows.filter((r) => r.master === masterName);
  return (
    <React.Fragment>
      <div className="filters">
        {Object.keys(map).map((k) => <D.Chip key={k} selected={f === k} onClick={() => setF(k)}>{k}</D.Chip>)}
        <div style={{ marginLeft: 'auto', width: 260 }}><D.Input placeholder="Поиск по имени или телефону" iconLeft="search" /></div>
      </div>
      <table className="tbl">
        <thead><tr><th>Когда</th><th>Клиент</th><th>Услуга</th>{isOwner ? <th>Мастер</th> : null}<th>Сумма</th><th>Источник</th><th>Статус</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="c">{r.when}</td>
              <td><div className="c">{r.client}</div><div className="v-caption">{r.phone}</div></td>
              <td>{r.service}</td>
              {isOwner ? <td>{r.master}</td> : null}
              <td className="c v-num">{r.price}</td>
              <td>{r.source}</td>
              <td><D.StatusBadge status={r.status} short /></td>
              <td style={{ textAlign: 'right' }}>
                {r.status === 'pending'
                  ? <D.Button size="sm">Подтвердить</D.Button>
                  : <D.IconButton icon="ellipsis" label="Действия" size="sm" />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </React.Fragment>
  );
}

function ServicesView() {
  const D = window.DesignSystem_f8f42b;
  const data = window.NOGOTOCHKI_DATA;
  return (
    <div className="two">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data.services.map((s) => (
          <D.Card key={s.id} variant="tight">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div className="v-h4">{s.title}</div>
                <div className="v-body-sm">{s.duration}{s.description ? ' · ' + s.description : ''}</div>
              </div>
              <div className="v-price">{(s.from ? 'от ' : '') + s.price.toLocaleString('ru-RU')} ₽</div>
              <D.Switch defaultChecked={s.id !== 'repair'} />
              <D.IconButton icon="pencil" label="Редактировать" variant="outline" size="sm" />
            </div>
          </D.Card>
        ))}
      </div>
      <D.Card>
        <h3 style={{ marginBottom: 12 }}>Новая услуга</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <D.Input label="Название" placeholder="Маникюр с покрытием" required />
          <D.Input label="Длительность" placeholder="1 ч 30 мин" iconLeft="clock" required />
          <D.Input label="Цена, ₽" placeholder="3200" required />
          <D.Select label="Категория" options={['Маникюр', 'Педикюр', 'Наращивание', 'Дизайн']} placeholder="Выберите" />
          <D.Checkbox label="Показывать в онлайн-записи" defaultChecked />
          <D.Button block>Добавить услугу</D.Button>
        </div>
      </D.Card>
    </div>
  );
}

function SettingsView() {
  const D = window.DesignSystem_f8f42b;
  return (
    <div className="two">
      <D.Card>
        <h3 style={{ marginBottom: 8 }}>Запись и уведомления</h3>
        {[['Онлайн-запись включена', 'Клиенты видят свободные окна в боте и на сайте'],
          ['Подтверждать записи вручную', 'Новая запись приходит со статусом «ожидает»'],
          ['Напоминание за 2 часа', 'Бот пишет клиентке перед визитом'],
          ['Уведомлять о новых записях', 'Сообщение в Telegram владелице']].map((r, i) => (
          <div className="set__row" key={r[0]}>
            <div><div className="set__t">{r[0]}</div><div className="set__d">{r[1]}</div></div>
            <D.Switch defaultChecked={i !== 1} />
          </div>
        ))}
      </D.Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <D.Card>
          <h3 style={{ marginBottom: 12 }}>Часы работы</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <D.Input label="Пн–Сб" defaultValue="10:00 — 21:00" />
            <D.Input label="Воскресенье" defaultValue="Выходной" />
            <D.Button variant="secondary" block>Сохранить</D.Button>
          </div>
        </D.Card>
        <D.Card variant="accent">
          <div className="v-h4">Бот записи</div>
          <p className="v-body-sm" style={{ marginTop: 6 }}>@nogotochki_bot · подключён</p>
          <div style={{ marginTop: 12 }}><D.Button variant="secondary" size="sm">Настроить бота</D.Button></div>
        </D.Card>
      </div>
    </div>
  );
}

function initialRole() {
  const p = new URLSearchParams(window.location.search).get('role');
  const A = window.NOGOTOCHKI_ADMIN;
  if (p === 'owner') return 'owner';
  if (p && A.masters.some((m) => m.id === p)) return p;
  return 'owner';
}

function AdminApp() {
  const D = window.DesignSystem_f8f42b;
  const [role, setRole] = React.useState(initialRole);
  const [view, setView] = React.useState('day');
  const isOwner = role === 'owner';
  const effView = isOwner ? view : (view === 'services' || view === 'settings' ? 'day' : view);
  const titles = { day: isOwner ? 'Расписание' : 'Моё расписание', list: isOwner ? 'Записи' : 'Мои записи', services: 'Услуги', settings: 'Настройки' };

  const changeRole = (r) => { setRole(r); if (r !== 'owner' && (view === 'services' || view === 'settings')) setView('day'); };

  return (
    <div className="adm">
      <Sidebar view={effView} setView={setView} role={role} />
      <div className="main">
        <div className="bar" style={{ height: 'auto', minHeight: 76, flexWrap: 'wrap', rowGap: 12, paddingTop: 14, paddingBottom: 14 }}>
          <h1>{titles[effView]}</h1>
          <div className="bar__spacer" style={{ flexWrap: 'wrap', minWidth: 0 }}><RoleSwitch role={role} setRole={changeRole} /></div>
        </div>
        <div className="body">
          {effView === 'day' ? <DayView role={role} onSelect={() => {}} /> : null}
          {effView === 'list' ? <ListView role={role} /> : null}
          {effView === 'services' ? <ServicesView /> : null}
          {effView === 'settings' ? <SettingsView /> : null}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AdminApp });
