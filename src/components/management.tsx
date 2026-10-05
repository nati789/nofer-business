'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search, UsersRound, Plus, ChevronLeft, Download, Check } from 'lucide-react';
import { today, money, summarize, dateLabel, type Snapshot } from '@/lib/domain';
import { Stat, Empty, EventCard, Contact, DetailLine } from './ui';
import { mutate } from './event-form';
export function Clients({ data }: { data: Snapshot }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const clients = data.clients
    .filter((c) => [c.name, c.phone, c.notes].join(' ').includes(query))
    .sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name, 'he') : b.updatedAt.localeCompare(a.updatedAt),
    );
  return (
    <>
      <div className="page-title">
        <div>
          <h1>הלקוחות שלך</h1>
          <p>מאחורי כל אירוע, יש קשר שכדאי לשמור.</p>
        </div>
        <a download className="secondary" href="/api/export?kind=clients">
          <Download size={18} />
          ייצוא לקוחות
        </a>
      </div>
      <div className="panel search-row">
        <label className="search-input">
          <Search size={19} />
          <input
            aria-label="חיפוש לקוחות"
            placeholder="חיפוש לפי שם או טלפון…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select aria-label="מיון לקוחות" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="recent">לקוחות אחרונים</option>
          <option value="name">לפי שם</option>
        </select>
      </div>
      <div className="clients-grid">
        {clients.map((c) => {
          const events = data.events.filter((e) => e.clientId === c.id);
          const active = events.filter((e) => e.status !== 'CANCELLED');
          const s = summarize(events);
          const last = active.filter((e) => e.date.slice(0, 10) <= today()).at(-1);
          const next = active.find(
            (e) => e.date.slice(0, 10) >= today() && e.status !== 'COMPLETED',
          );
          return (
            <Link href={'/clients/' + c.id} key={c.id} className="panel client-card">
              <div className="client-card-head">
                <span className="client-avatar">{c.name.slice(0, 1)}</span>
                <div>
                  <h2>{c.name}</h2>
                  <p dir="ltr">{c.phone}</p>
                </div>
                <ChevronLeft size={18} />
              </div>
              <div className="client-numbers">
                <span>
                  אירועים<strong>{s.count}</strong>
                </span>
                <span>
                  שווי עסקי<strong>{money(s.revenue)}</strong>
                </span>
                <span>
                  יתרה
                  <strong className={s.outstanding ? 'unpaid' : ''}>{money(s.outstanding)}</strong>
                </span>
              </div>
              <div className="client-dates">
                <small>אירוע אחרון: {last ? dateLabel(last.date) : '—'}</small>
                <small>האירוע הבא: {next ? dateLabel(next.date) : '—'}</small>
              </div>
            </Link>
          );
        })}
      </div>
      {!clients.length && (
        <section className="panel">
          <Empty
            title="כאן מתחילים קשרים טובים"
            text="לקוחות יתווספו אוטומטית כשתצרי אירוע חדש."
            add
          />
        </section>
      )}
    </>
  );
}
export function ClientDetails({
  data,
  id,
  onSaved,
}: {
  data: Snapshot;
  id: string;
  onSaved: () => Promise<void>;
}) {
  const client = data.clients.find((c) => c.id === id);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  if (!client) return <Empty title="הלקוח לא נמצא" />;
  const events = data.events.filter((e) => e.clientId === id);
  const s = summarize(events);
  const upcoming = events.filter(
    (e) => e.date.slice(0, 10) >= today() && e.status !== 'CANCELLED' && e.status !== 'COMPLETED',
  );
  const previous = events.filter((e) => !upcoming.includes(e)).reverse();
  return (
    <>
      <Link className="back" href="/clients">
        <ArrowRight size={17} />
        כל הלקוחות
      </Link>
      <div className="page-title">
        <div>
          <p className="eyebrow">תיק לקוח</p>
          <h1>{client.name}</h1>
          <p dir="ltr">{client.phone}</p>
        </div>
        <Contact phone={client.phone} />
      </div>
      <div className="stats-grid">
        <Stat label="אירועים" value={s.count} icon={<UsersRound size={18} />} />
        <Stat label="שווי עסקי" value={money(s.revenue)} />
        <Stat label="שולם עד היום" value={money(s.paid)} />
        <Stat accent label="יתרה לגבייה" value={money(s.outstanding)} />
      </div>
      <section className="panel">
        <h2>פרטים והערות</h2>
        <form
          className="client-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            setMessage('');
            const f = new FormData(e.currentTarget);
            try {
              await mutate('/api/clients/' + id, 'PUT', {
                name: f.get('name'),
                phone: f.get('phone'),
                notes: f.get('notes'),
              });
              await onSaved();
              setMessage('פרטי הלקוח נשמרו');
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            <label>
              שם
              <input name="name" defaultValue={client.name} required maxLength={100} />
            </label>
            <label>
              טלפון
              <input
                name="phone"
                type="tel"
                inputMode="tel"
                dir="ltr"
                defaultValue={client.phone}
                required
              />
            </label>
          </div>
          <label>
            הערות ללקוח
            <textarea name="notes" defaultValue={client.notes} rows={3} maxLength={5000} />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="inline-success" role="status">
              <Check size={16} />
              {message}
            </p>
          )}
          <button className="secondary" disabled={busy}>
            {busy ? 'שומרת…' : 'שמירת פרטי לקוח'}
          </button>
        </form>
        <DetailLine label="לקוח מאז">{dateLabel(client.createdAt)}</DetailLine>
      </section>
      <section className="panel">
        <h2>אירועים קרובים</h2>
        {upcoming.length ? (
          upcoming.map((e) => <EventCard key={e.id} event={e} />)
        ) : (
          <p className="muted footnote">אין כרגע אירועים קרובים.</p>
        )}
      </section>
      <section className="panel">
        <h2>היסטוריית אירועים</h2>
        {previous.length ? (
          previous.map((e) => <EventCard key={e.id} event={e} />)
        ) : (
          <p className="muted footnote">אין אירועים קודמים.</p>
        )}
      </section>
    </>
  );
}
export function Settings({ data, onSaved }: { data: Snapshot; onSaved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  return (
    <>
      <div className="page-title">
        <div>
          <h1>הגדרות העסק</h1>
          <p>התאמות קטנות שעושות את המערכת שלך.</p>
        </div>
      </div>
      <section className="panel">
        <h2>סוגי אירועים</h2>
        <p className="muted">
          אפשר להוסיף סוגים, לשנות שמות ולהסתיר סוגים שלא בשימוש. ההיסטוריה תמיד נשמרת.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="inline-success" role="status">
            {success}
          </p>
        )}
        <div className="type-list">
          {data.types.map((t) => (
            <form
              key={t.id}
              className="type-row"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                setSuccess('');
                const f = new FormData(e.currentTarget);
                try {
                  await mutate('/api/types', 'PATCH', {
                    id: t.id,
                    name: f.get('name'),
                    active: f.get('active') === 'on',
                  });
                  await onSaved();
                  setSuccess('סוג האירוע עודכן');
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <input
                aria-label={'שם סוג האירוע ' + t.name}
                name="name"
                defaultValue={t.name}
                required
                maxLength={80}
              />
              <label className="checkbox">
                <input type="checkbox" name="active" defaultChecked={t.active} />
                פעיל
              </label>
              <button className="secondary" disabled={busy}>
                שמירה
              </button>
            </form>
          ))}
        </div>
        <form
          className="type-row"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            setSuccess('');
            const form = e.currentTarget;
            try {
              await mutate('/api/types', 'POST', { name: new FormData(form).get('name') });
              await onSaved();
              form.reset();
              setSuccess('סוג האירוע נוסף');
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            name="name"
            aria-label="סוג אירוע חדש"
            placeholder="שם לסוג אירוע חדש"
            required
            maxLength={80}
          />
          <button className="primary" disabled={busy}>
            <Plus size={17} />
            הוספה
          </button>
        </form>
      </section>
      <section className="panel">
        <h2>איך נספרים המספרים?</h2>
        <p className="muted">
          ההכנסה משויכת לתאריך האירוע. הסכום ששולם מחושב מתוך התשלומים שנרשמו. אירועים שבוטלו נשמרים
          בהיסטוריה ואינם נכללים בסיכומי ההכנסה והגבייה.
        </p>
        <p className="muted">
          לקוח מזוהה לפי מספר הטלפון. שינוי שם של לקוח או סוג אירוע מעדכן גם את התצוגה באירועים
          קודמים.
        </p>
      </section>
    </>
  );
}
