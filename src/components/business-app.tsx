'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from './app-link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  Plus,
  UsersRound,
  Wallet,
  ChartNoAxesCombined,
  Ellipsis,
  Flower2,
  ArrowUpLeft,
  ChevronLeft,
  Bell,
  Download,
  Search,
  SlidersHorizontal,
  RefreshCw,
  LogOut,
  CheckCheck,
  CalendarCheck,
  TrendingUp,
} from 'lucide-react';
import {
  dateLabel,
  eventLocation,
  monthLabel,
  today,
  money,
  totals,
  summarize,
  filterEvents,
  shiftMonth,
  statuses,
  paymentLabels,
  type Snapshot,
  type Filters,
} from '@/lib/domain';
import { MonthPicker, Stat, Empty, EventCard, Bars, SectionHead } from './ui';
import EventForm from './event-form';
import EventDetails from './event-details';
import { Clients, ClientDetails, Settings } from './management';
const navigation = [
  { href: '/', label: 'סקירה כללית', icon: LayoutDashboard },
  { href: '/events', label: 'אירועים ועבודות', icon: CalendarCheck },
  { href: '/calendar', label: 'יומן אירועים', icon: CalendarDays },
  { href: '/clients', label: 'לקוחות', icon: UsersRound },
  { href: '/outstanding', label: 'תשלומים לגבייה', icon: Wallet },
  { href: '/summary', label: 'סיכום חודשי', icon: ChartNoAxesCombined },
  { href: '/reports', label: 'נתונים ותובנות', icon: TrendingUp },
];
export default function BusinessApp() {
  const path = usePathname();
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(today().slice(0, 7));
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/data', { cache: 'no-store' });
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
      setError('');
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    // Initial hydration fetch: all state updates happen after the network response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh().catch(() => {});
    const onFocus = () => void refresh().catch(() => {});
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
    };
  }, [refresh]);
  const parts = path.split('/').filter(Boolean);
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  let content;
  if (data) {
    if (path === '/events/new') content = <EventForm key={path} data={data} onSaved={refresh} />;
    else if (parts[0] === 'events' && parts[1]) {
      const event = data.events.find((e) => e.id === parts[1]);
      content = event ? (
        parts[2] === 'edit' || parts[2] === 'copy' ? (
          <EventForm
            key={path}
            data={data}
            event={event}
            copy={parts[2] === 'copy'}
            onSaved={refresh}
          />
        ) : (
          <EventDetails key={event.id} event={event} onSaved={refresh} />
        )
      ) : (
        <Empty title="האירוע לא נמצא" text="ייתכן שהאירוע נמחק. אפשר לחזור לרשימת האירועים." />
      );
    } else if (parts[0] === 'clients' && parts[1])
      content = <ClientDetails data={data} id={parts[1]} onSaved={refresh} />;
    else if (path === '/events') content = <Events data={data} />;
    else if (path === '/calendar')
      content = <Calendar data={data} month={month} setMonth={setMonth} />;
    else if (path === '/clients') content = <Clients data={data} />;
    else if (path === '/outstanding') content = <Outstanding data={data} />;
    else if (path === '/summary' || path === '/reports')
      content = <Reports data={data} month={month} setMonth={setMonth} all={path === '/reports'} />;
    else if (path === '/more') content = <More />;
    else if (path === '/settings') content = <Settings />;
    else if (path === '/export') content = <Export />;
    else if (path === '/') content = <Dashboard data={data} month={month} setMonth={setMonth} />;
    else content = <Empty title="העמוד לא נמצא" text="בחרי עמוד מתפריט הניווט." />;
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Flower2 size={27} />
          </span>
          <span>
            <strong>נופר</strong>
            <small>העסק שלי, בסדר שלי</small>
          </span>
        </Link>
        <div className="sidebar-label">ניהול העסק</div>
        <nav>
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={active(href) ? 'active' : ''}>
              <Icon size={20} />
              {label}
              {active(href) && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/export">
            <Download size={19} />
            ייצוא נתונים
          </Link>
          <Link href="/settings">
            <SlidersHorizontal size={19} />
            הגדרות העסק
          </Link>
          <div className="owner">
            <span>נ</span>
            <div>
              <strong>העסק של נופר</strong>
              <small>מקום אחד. ראש שקט.</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            העסק שלי <ChevronLeft size={14} />
            <strong>{navigation.find((n) => active(n.href))?.label || 'ניהול העסק'}</strong>
          </div>
          <Link className="mobile-brand" href="/">
            <Flower2 size={24} />
            נופר
          </Link>
          <div className="topbar-actions">
            <span className="today-label">{dateLabel(today())}</span>
            <button
              aria-label="רענון נתונים"
              onClick={() => {
                setRefreshing(true);
                void refresh().catch(() => {});
              }}
              disabled={refreshing}
            >
              <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
            </button>
            <Link href="/outstanding" className="notification" aria-label="תשלומים לגבייה">
              <Bell size={20} />
              {data?.events.some((e) => e.status !== 'CANCELLED' && totals(e).remaining > 0) && (
                <i />
              )}
            </Link>
            <span className="avatar">נ</span>
          </div>
        </header>
        <main id="main">
          {error && (
            <div className="error" role="alert">
              {error} <button onClick={() => void refresh().catch(() => {})}>ניסיון נוסף</button>
            </div>
          )}
          {!data && !error ? (
            <div className="loading">
              <RefreshCw className="spin" />
              טוענת את העסק שלך…
            </div>
          ) : (
            content
          )}
        </main>
        <footer className="desktop-footer">נופר · כל מה שצריך כדי להתמקד במה שאת אוהבת</footer>
      </div>
      <nav className="bottom-nav" aria-label="ניווט ראשי">
        <Link className={path === '/' ? 'active' : ''} href="/">
          <LayoutDashboard size={21} />
          בית
        </Link>
        <Link
          className={parts[0] === 'events' && parts[1] !== 'new' ? 'active' : ''}
          href="/events"
        >
          <CalendarCheck size={21} />
          אירועים
        </Link>
        <Link className="add-nav" href="/events/new" aria-label="אירוע חדש">
          <span>
            <Plus size={27} />
          </span>
          הוספה
        </Link>
        <Link className={path === '/calendar' ? 'active' : ''} href="/calendar">
          <CalendarDays size={21} />
          יומן
        </Link>
        <Link
          className={
            ['more', 'clients', 'outstanding', 'summary', 'reports', 'settings', 'export'].includes(
              parts[0],
            )
              ? 'active'
              : ''
          }
          href="/more"
        >
          <Ellipsis size={23} />
          עוד
        </Link>
      </nav>
    </div>
  );
}
type MonthProps = { data: Snapshot; month: string; setMonth: (month: string) => void };
function Heading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
function Dashboard({ data, month, setMonth }: MonthProps) {
  const s = summarize(data.events, month);
  const previous = summarize(data.events, shiftMonth(month, -1));
  const upcoming = filterEvents(data.events, { upcoming: true });
  const closest = upcoming[0];
  const difference = previous.revenue
    ? Math.round(((s.revenue - previous.revenue) / previous.revenue) * 100)
    : null;
  const overdue = data.events.filter(
    (e) => e.status !== 'CANCELLED' && e.date.slice(0, 10) < today() && totals(e).remaining > 0,
  );
  const recent = [...data.events]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 4);
  return (
    <>
      <div className="welcome-line">
        <span className="eyebrow">קצת סדר, הרבה שקט</span>
        <span className="live-dot">העסק שלך במבט אחד</span>
      </div>
      <Heading
        title="היי נופר, טוב שאת כאן"
        description="כל האירועים, הלקוחות והתשלומים. הכל במקום אחד."
      >
        <Link className="primary" href="/events/new">
          <Plus size={19} />
          אירוע חדש
        </Link>
      </Heading>
      <div className="month-row">
        <h2>מה קורה בעסק שלך</h2>
        <MonthPicker month={month} onChange={setMonth} />
      </div>
      <section className="panel">
        <SectionHead title="בקרוב ביומן" href="/calendar" />
        {upcoming.length ? (
          upcoming.slice(0, 4).map((e) => <EventCard key={e.id} event={e} compact />)
        ) : (
          <Empty add />
        )}
      </section>
      <div className="stats-grid">
        <Stat
          label="הכנסה מהאירועים"
          value={money(s.revenue)}
          sub={
            difference === null
              ? 'החודש שלך מתחיל כאן'
              : `${difference >= 0 ? '+' : ''}${difference}% לעומת החודש הקודם`
          }
          accent
          icon={<TrendingUp size={19} />}
        />
        <Stat
          label="כבר שולם"
          value={money(s.paid)}
          sub="תשלומים שהתקבלו עבור אירועי החודש"
          icon={<CheckCheck size={19} />}
        />
        <Stat
          label="נותר לגבייה"
          value={money(s.outstanding)}
          sub="יתרה לתשלום עבור אירועי החודש"
          icon={<Wallet size={19} />}
        />
        <Stat
          label="אירועים החודש"
          value={s.count}
          sub={`${s.clients} לקוחות · ${s.completed} אירועים הושלמו`}
          icon={<CalendarDays size={19} />}
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel revenue-panel">
          <SectionHead title="העסק שלך צומח" href="/reports" label="לכל הנתונים" />
          <p className="muted">הכנסה מאירועים לאורך החודשים</p>
          <Bars
            items={Array.from({ length: 6 }, (_, i) => {
              const m = shiftMonth(month, i - 5);
              const x = summarize(data.events, m);
              return {
                label: new Intl.DateTimeFormat('he-IL', { month: 'short', timeZone: 'UTC' }).format(
                  new Date(m + '-01'),
                ),
                value: x.revenue,
                secondary: x.paid,
              };
            })}
          />
          <div className="chart-legend">
            <span>
              <i />
              הכנסה שסוכמה
            </span>
            <span>
              <i className="collected" />
              מתוכה שולם
            </span>
          </div>
        </section>
        <section className="panel next-panel">
          <div className="section-head">
            <h2>האירוע הבא שלך</h2>
            <CalendarDays size={20} />
          </div>
          {closest ? (
            <>
              <span className="pill">
                {dateLabel(closest.date)}
                {closest.time && ' · ' + closest.time}
              </span>
              <h2 className="next-client">{closest.client.name}</h2>
              <p>{closest.eventType.name}</p>
              <p className="muted">{eventLocation(closest) || 'המיקום עדיין לא נקבע'}</p>
              <div className="next-price">
                <span>מחיר האירוע</span>
                <strong>{money(closest.price)}</strong>
              </div>
              <Link className="secondary" href={'/events/' + closest.id}>
                לפרטי האירוע
                <ArrowUpLeft size={18} />
              </Link>
            </>
          ) : (
            <Empty title="היומן מחכה לך" text="אירועים חדשים יופיעו כאן." />
          )}
        </section>
      </div>
      <div className="mini-stats">
        <span>
          <CalendarCheck size={19} />
          <strong>{upcoming.length}</strong> אירועים בדרך
        </span>
        <span>
          <CheckCheck size={19} />
          <strong>{s.completed}</strong> הושלמו החודש
        </span>
        <span>
          <UsersRound size={19} />
          <strong>{s.clients}</strong> לקוחות החודש
        </span>
        <span>
          <Wallet size={19} />
          <strong>{money(s.average)}</strong> בממוצע לאירוע
        </span>
      </div>
      {overdue.length > 0 && (
        <Link href="/outstanding" className="alert-strip">
          <span className="alert-icon">
            <Wallet size={21} />
          </span>
          <div>
            <strong>
              יש {money(overdue.reduce((sum, e) => sum + totals(e).remaining, 0))} שמחכים לגבייה
            </strong>
            <p>{overdue.length} אירועים שכבר התקיימו עדיין לא שולמו במלואם</p>
          </div>
          <ChevronLeft size={20} />
        </Link>
      )}
      <div className="dashboard-grid lower">
        <section className="panel">
          <SectionHead title="עדכונים אחרונים" href="/events" />
          {recent.length ? (
            recent.map((e) => <EventCard key={e.id} event={e} compact />)
          ) : (
            <Empty title="מתחילים דף חדש" text="האירועים שתעדכני יופיעו כאן." />
          )}
        </section>
      </div>
    </>
  );
}
function Events({ data }: { data: Snapshot }) {
  const [f, setF] = useState<Filters>({});
  const [advanced, setAdvanced] = useState(false);
  const update = (key: keyof Filters, value: string | boolean) =>
    setF((prev) => ({ ...prev, [key]: value }));
  const events = filterEvents(data.events, f);
  return (
    <>
      <Heading title="אירועים ועבודות" description="כל הפרטים הקטנים, מסודרים במקום אחד.">
        <Link className="primary" href="/events/new">
          <Plus size={18} />
          אירוע חדש
        </Link>
      </Heading>
      <section className="panel filters">
        <div className="search-row">
          <label className="search-input">
            <Search size={19} />
            <input
              aria-label="חיפוש אירועים"
              value={f.query || ''}
              onChange={(e) => update('query', e.target.value)}
              placeholder="חיפוש לפי שם, טלפון, מיקום או הערה…"
            />
          </label>
          <button
            className={'secondary ' + (advanced ? 'selected' : '')}
            onClick={() => setAdvanced(!advanced)}
            aria-expanded={advanced}
          >
            <SlidersHorizontal size={18} />
            סינון
          </button>
        </div>
        <div className="filter-chips">
          <button
            className={!f.upcoming && !f.status && !f.payment ? 'selected' : ''}
            onClick={() => setF((prev) => ({ ...prev, upcoming: false, status: '', payment: '' }))}
          >
            כל האירועים
          </button>
          <button
            className={f.upcoming ? 'selected' : ''}
            onClick={() => update('upcoming', !f.upcoming)}
          >
            בקרוב
          </button>
          <button
            className={f.payment === 'OUTSTANDING' ? 'selected' : ''}
            onClick={() => update('payment', f.payment === 'OUTSTANDING' ? '' : 'OUTSTANDING')}
          >
            ממתינים לתשלום
          </button>
          <button
            className={f.status === 'COMPLETED' ? 'selected' : ''}
            onClick={() => update('status', f.status === 'COMPLETED' ? '' : 'COMPLETED')}
          >
            הושלמו
          </button>
        </div>
        {advanced && (
          <div className="form-grid filter-grid">
            <label>
              חודש
              <input
                type="month"
                value={f.month || ''}
                onChange={(e) => update('month', e.target.value)}
              />
            </label>
            <label>
              סוג אירוע
              <select value={f.type || ''} onChange={(e) => update('type', e.target.value)}>
                <option value="">כל הסוגים</option>
                {data.types.map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              מצב אירוע
              <select value={f.status || ''} onChange={(e) => update('status', e.target.value)}>
                <option value="">הכל</option>
                {Object.entries(statuses).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              מצב תשלום
              <select value={f.payment || ''} onChange={(e) => update('payment', e.target.value)}>
                <option value="">הכל</option>
                <option value="OUTSTANDING">נותרה יתרה</option>
                {Object.entries(paymentLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              מתאריך
              <input
                type="date"
                value={f.from || ''}
                onChange={(e) => update('from', e.target.value)}
              />
            </label>
            <label>
              עד תאריך
              <input
                type="date"
                value={f.to || ''}
                onChange={(e) => update('to', e.target.value)}
              />
            </label>
            <button className="text-button" onClick={() => setF({})}>
              ניקוי סינון
            </button>
          </div>
        )}
      </section>
      <div className="list-caption">
        <span>{events.length} אירועים</span>
        <a
          download
          className="text-button"
          href={
            '/api/export?' +
            new URLSearchParams(
              Object.fromEntries(Object.entries(f).map(([k, v]) => [k, String(v)])),
            ).toString()
          }
        >
          <Download size={16} />
          ייצוא התוצאות
        </a>
      </div>
      <section className="panel event-list">
        {events.length ? (
          events.map((e) => <EventCard key={e.id} event={e} />)
        ) : (
          <Empty text="נסי לשנות את הסינון, או להוסיף אירוע חדש." add />
        )}
      </section>
    </>
  );
}
function Calendar({ data, month, setMonth }: MonthProps) {
  const [selected, setSelected] = useState('');
  const first = new Date(month + '-01T00:00:00Z');
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const events = data.events.filter((e) => e.date.startsWith(month));
  const chosen = selected.startsWith(month) ? selected : '';
  const list = chosen
    ? events.filter((e) => e.date.startsWith(chosen))
    : filterEvents(data.events, { upcoming: true });
  return (
    <>
      <Heading title="יומן האירועים" description="מבט קטן קדימה, כדי להגיע מוכנה.">
        <MonthPicker
          month={month}
          onChange={(m) => {
            setMonth(m);
            setSelected('');
          }}
        />
      </Heading>
      <section className="panel calendar-panel">
        <div className="calendar-legend">
          <span>
            <i className="confirmed" />
            מאושר
          </span>
          <span>
            <i className="completed" />
            הושלם
          </span>
          <span>
            <i className="cancelled" />
            בוטל
          </span>
          <span>
            <i className="unpaid" />
            נותרה יתרה
          </span>
        </div>
        <div className="calendar-grid">
          {['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'].map((d) => (
            <div className="weekday" key={d}>
              {d}
            </div>
          ))}
          {Array.from({ length: first.getUTCDay() }, (_, i) => (
            <div className="calendar-blank" key={'blank' + i} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const date = month + '-' + String(i + 1).padStart(2, '0');
            const dayEvents = events.filter((e) => e.date.startsWith(date));
            return (
              <div
                key={date}
                className={
                  'calendar-cell ' +
                  (date === today() ? 'is-today ' : '') +
                  (chosen === date ? 'selected' : '')
                }
              >
                <button
                  className="day-number"
                  aria-label={dateLabel(date)}
                  onClick={() => setSelected(chosen === date ? '' : date)}
                >
                  {i + 1}
                </button>
                <div className="calendar-events">
                  {dayEvents.slice(0, 3).map((e) => (
                    <Link
                      key={e.id}
                      href={'/events/' + e.id}
                      className={'calendar-event ' + e.status.toLowerCase()}
                      title={e.client.name + ' · ' + e.eventType.name}
                    >
                      <span>{e.client.name}</span>
                      {totals(e).remaining > 0 && e.status !== 'CANCELLED' && <i />}
                    </Link>
                  ))}
                  {dayEvents.length > 3 && (
                    <button className="more-events" onClick={() => setSelected(date)}>
                      +{dayEvents.length - 3}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="panel">
        <div className="section-head">
          <h2>{chosen ? 'אירועים ליום ' + dateLabel(chosen) : 'האירועים הקרובים'}</h2>
          {chosen && <button onClick={() => setSelected('')}>הצגת הקרובים</button>}
        </div>
        {list.length ? (
          list.map((e) => <EventCard key={e.id} event={e} />)
        ) : (
          <Empty title="אין אירועים ביום הזה" add />
        )}
      </section>
    </>
  );
}
function Outstanding({ data }: { data: Snapshot }) {
  const [sort, setSort] = useState('oldest');
  const items = data.events
    .filter((e) => e.status !== 'CANCELLED' && totals(e).remaining > 0)
    .sort((a, b) =>
      sort === 'balance'
        ? totals(b).remaining - totals(a).remaining
        : sort === 'newest'
          ? b.date.localeCompare(a.date)
          : a.date.localeCompare(b.date),
    );
  return (
    <>
      <Heading title="תשלומים לגבייה" description="כל מה שעוד פתוח, כדי ששום תשלום לא יתפספס.">
        <a download href="/api/export?kind=outstanding" className="secondary">
          <Download size={18} />
          ייצוא
        </a>
      </Heading>
      <div className="stats-grid three">
        <Stat
          accent
          label="סך הכל לגבייה"
          value={money(items.reduce((s, e) => s + totals(e).remaining, 0))}
        />
        <Stat label="אירועים עם יתרה" value={items.length} />
        <Stat
          label="מתוכם כבר התקיימו"
          value={items.filter((e) => e.date.slice(0, 10) < today()).length}
        />
      </div>
      <div className="list-caption">
        <span>{items.length} אירועים פתוחים</span>
        <label className="inline-label">
          מיון
          <select aria-label="מיון יתרות" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="oldest">האירוע הישן ביותר</option>
            <option value="newest">תאריך — מהחדש לישן</option>
            <option value="balance">היתרה הגבוהה ביותר</option>
          </select>
        </label>
      </div>
      <section className="panel">
        {items.length ? (
          items.map((e) => (
            <div className="outstanding-item" key={e.id}>
              <EventCard event={e} />
              <div className="outstanding-actions">
                <a href={'tel:' + e.client.phone} dir="ltr">
                  {e.client.phone}
                </a>
                <span>שולם: {money(totals(e).paid)}</span>
                <Link className="text-button" href={'/events/' + e.id + '?payment=1'}>
                  <Plus size={16} />
                  הוספת תשלום
                </Link>
              </div>
            </div>
          ))
        ) : (
          <Empty title="הכל שולם, איזה כיף" text="אין כרגע יתרות פתוחות לגבייה." />
        )}
      </section>
    </>
  );
}
function Reports({ data, month, setMonth, all = false }: MonthProps & { all?: boolean }) {
  const s = summarize(data.events, month);
  const prev = summarize(data.events, shiftMonth(month, -1));
  const selected = data.events.filter(
    (e) => e.status !== 'CANCELLED' && (all || e.date.startsWith(month)),
  );
  const total = summarize(selected);
  const grouped = data.types
    .map((t) => ({ name: t.name, events: selected.filter((e) => e.eventTypeId === t.id) }))
    .filter((t) => t.events.length)
    .sort((a, b) => b.events.length - a.events.length);
  const newClients = data.clients.filter((c) => c.createdAt.startsWith(month)).length;
  const returning = data.clients.filter(
    (c) => data.events.filter((e) => e.clientId === c.id && e.status !== 'CANCELLED').length > 1,
  ).length;
  const highest = [...selected].sort((a, b) => b.price - a.price)[0];
  const months = [
    ...new Set(data.events.filter((e) => e.status !== 'CANCELLED').map((e) => e.date.slice(0, 7))),
  ];
  const best = months.sort(
    (a, b) => summarize(data.events, b).revenue - summarize(data.events, a).revenue,
  )[0];
  const diff = s.revenue - prev.revenue;
  return (
    <>
      <Heading
        title={all ? 'נתונים ותובנות' : 'החודש שלך במספרים'}
        description={
          all ? 'תמונה פשוטה של העסק, והדרך שהוא עושה.' : 'מבט מסכם על האירועים וההכנסות של החודש.'
        }
      >
        <MonthPicker month={month} onChange={setMonth} />
      </Heading>

      <div className="stats-grid">
        <Stat accent label="הכנסה מאירועי החודש" value={money(s.revenue)} />
        <Stat label="כבר נגבה" value={money(s.paid)} />
        <Stat label="יתרה לגבייה" value={money(s.outstanding)} />
        <Stat label="אירועים החודש" value={s.count} />
      </div>
      <div className="comparison panel">
        <TrendingUp size={25} />
        <div>
          <h2>בהשוואה לחודש הקודם</h2>
          <p>
            {diff >= 0 ? 'עלייה' : 'ירידה'} של {money(Math.abs(diff))}
            {prev.revenue
              ? ` (${Math.round((Math.abs(diff) / prev.revenue) * 100)}%)`
              : ' · אין בסיס לחישוב אחוז שינוי'}{' '}
            · {s.count - prev.count >= 0 ? '+' : ''}
            {s.count - prev.count} אירועים
          </p>
        </div>
      </div>
      <div className="mini-stats">
        <span>
          ממוצע לאירוע <strong>{money(s.average)}</strong>
        </span>
        <span>
          לקוחות חדשים החודש <strong>{newClients}</strong>
        </span>
        <span>
          לקוחות החודש <strong>{s.clients}</strong>
        </span>
      </div>
      <section className="panel">
        <SectionHead title="הכנסות לפי חודש" />
        <Bars
          items={Array.from({ length: all ? 12 : 6 }, (_, i) => {
            const m = shiftMonth(month, i - (all ? 11 : 5));
            return {
              label: new Intl.DateTimeFormat('he-IL', { month: 'short', timeZone: 'UTC' }).format(
                new Date(m + '-01'),
              ),
              value: summarize(data.events, m).revenue,
            };
          })}
        />
      </section>
      {all && (
        <section className="panel">
          <SectionHead title="אירועים לפי חודש" />
          <div className="count-chart">
            {Array.from({ length: 12 }, (_, i) => {
              const m = shiftMonth(month, i - 11);
              const x = summarize(data.events, m);
              return (
                <div key={m}>
                  <span>{monthLabel(m)}</span>
                  <div>
                    <i
                      style={{
                        width:
                          Math.min(
                            100,
                            (x.count /
                              Math.max(1, ...months.map((v) => summarize(data.events, v).count))) *
                              100,
                          ) + '%',
                      }}
                    />
                  </div>
                  <strong>{x.count}</strong>
                </div>
              );
            })}
          </div>
        </section>
      )}
      <div className="dashboard-grid lower">
        <section className="panel">
          <SectionHead title={'לפי סוג אירוע' + (all ? ' · כל התקופות' : '')} />
          {grouped.length ? (
            grouped.map((g) => (
              <div className="breakdown" key={g.name}>
                <div>
                  <strong>{g.name}</strong>
                  <span>{g.events.length} אירועים</span>
                </div>
                <strong>{money(summarize(g.events).revenue)}</strong>
              </div>
            ))
          ) : (
            <Empty title="עוד מעט יהיו כאן תובנות" text="הנתונים יתעדכנו כשתוסיפי אירועים." />
          )}
        </section>
        <section className="panel">
          <SectionHead title={'מצב התשלומים' + (all ? ' · כל התקופות' : '')} />
          {Object.entries(paymentLabels).map(([key, label]) => {
            const items = selected.filter((e) => totals(e).state === key);
            return (
              <div className="breakdown" key={key}>
                <div>
                  <strong>{label}</strong>
                  <span>{items.length} אירועים</span>
                </div>
                <strong>{money(summarize(items).revenue)}</strong>
              </div>
            );
          })}
          <p className="muted footnote">הסכומים מציגים את שווי האירועים בכל מצב תשלום.</p>
        </section>
      </div>
      {all && (
        <div className="stats-grid three">
          <Stat label="לקוחות חוזרים" value={returning} />
          <Stat label="ממוצע לכל אירוע" value={money(total.average)} />
          <Stat label="סוג האירוע הנפוץ" value={grouped[0]?.name || '—'} />
          <Stat label="החודש החזק ביותר" value={best ? monthLabel(best) : '—'} />
          <Stat
            label="האירוע עם השווי הגבוה ביותר"
            value={highest ? money(highest.price) : '—'}
            sub={highest?.client.name}
          />
          <Stat label="כל הלקוחות" value={data.clients.length} />
        </div>
      )}
      <p className="muted footnote">
        הכנסה משויכת לחודש האירוע, לא לחודש התשלום. אירועים שבוטלו אינם נכללים בסיכומים. לקוח חדש
        נספר לפי תאריך יצירתו.
      </p>
    </>
  );
}
function More() {
  return (
    <>
      <Heading title="עוד בעסק שלך" description="לקוחות, סיכומים וכל הדברים שמסביב." />
      <div className="more-grid">
        {[
          ...navigation.slice(3),
          { href: '/export', label: 'ייצוא נתונים', icon: Download },
          { href: '/settings', label: 'הגדרות העסק', icon: SlidersHorizontal },
        ].map(({ href, label, icon: Icon }) => (
          <Link className="panel more-link" key={href} href={href}>
            <Icon size={23} />
            <strong>{label}</strong>
            <ChevronLeft size={19} />
          </Link>
        ))}
      </div>
      <div className="panel">
        <h2>העסק תמיד איתך</h2>
        <p className="muted">
          באייפון: פתחי את האתר בספארי, לחצי על שיתוף ואז על ״הוסף למסך הבית״.
        </p>
      </div>
      <button
        className="secondary"
        onClick={async () => {
          await fetch('/api/auth', { method: 'DELETE' });
          window.location.reload();
        }}
      >
        <LogOut size={18} />
        יציאה מהמערכת
      </button>
    </>
  );
}
function Export() {
  const [kind, setKind] = useState('events');
  const [range, setRange] = useState('all');
  const [month, setMonth] = useState(today().slice(0, 7));
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  return (
    <>
      <Heading
        title="הנתונים שלך, גם מחוץ לעסק"
        description="הורדת קובץ מסודר שנפתח באקסל ובגיליונות אלקטרוניים."
      />
      <form
        className="form-card"
        onSubmit={(e) => {
          e.preventDefault();
          const p = new URLSearchParams({ kind });
          if (kind !== 'clients') {
            if (range === 'month') p.set('month', month);
            if (range === 'dates') {
              p.set('from', from);
              p.set('to', to);
            }
          }
          window.location.assign(new URL('/api/export?' + p, window.location.origin).href);
        }}
      >
        <label>
          מה לייצא?
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="events">אירועים</option>
            <option value="clients">לקוחות</option>
            <option value="payments">תשלומים</option>
            <option value="outstanding">יתרות לגבייה</option>
          </select>
        </label>
        {kind !== 'clients' && (
          <>
            <label>
              תקופה
              <select value={range} onChange={(e) => setRange(e.target.value)}>
                <option value="all">כל התקופות</option>
                <option value="month">חודש נבחר</option>
                <option value="dates">טווח תאריכים</option>
              </select>
            </label>
            {range === 'month' && (
              <label>
                חודש
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  required
                />
              </label>
            )}
            {range === 'dates' && (
              <div className="form-grid">
                <label>
                  מתאריך
                  <input
                    type="date"
                    required
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </label>
                <label>
                  עד תאריך
                  <input
                    type="date"
                    required
                    min={from}
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </label>
              </div>
            )}
            <p className="muted">התקופה מתייחסת לתאריך האירוע, גם בייצוא תשלומים.</p>
          </>
        )}
        <button className="primary">
          <Download size={18} />
          הורדת קובץ לאקסל
        </button>
      </form>
    </>
  );
}
