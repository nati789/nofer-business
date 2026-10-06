'use client';
import { useEffect, useRef, useState } from 'react';
import Link from './app-link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Plus, Pencil, Copy, Trash2, CheckCheck, X, Wallet } from 'lucide-react';
import {
  money,
  totals,
  today,
  dateLabel,
  eventLocation,
  statuses,
  methods,
  type BusinessEvent,
  type Status,
} from '@/lib/domain';
import { Contact, DetailLine, PaymentBadge, Stat } from './ui';
import { mutate } from './event-form';
export default function EventDetails({
  event,
  onSaved,
}: {
  event: BusinessEvent;
  onSaved: () => Promise<void>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [paymentOpen, setPaymentOpen] = useState(params.get('payment') === '1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const t = totals(event);
  async function changeStatus(status: Status) {
    if (
      status === 'CANCELLED' &&
      !confirm('לבטל את האירוע? הוא יישאר בהיסטוריה, אך יוסר מסיכומי ההכנסות והגבייה.')
    )
      return;
    setBusy(true);
    setError('');
    try {
      if (status === 'COMPLETED') {
        await mutate('/api/events/' + event.id + '/complete', 'POST', {
          version: event.version,
          requestId: crypto.randomUUID(),
        });
      } else
        await mutate('/api/events/' + event.id, 'PUT', {
          ...event,
          name: event.client.name,
          phone: event.client.phone,
          city: event.city,
          venue: event.venue,
          date: event.date.slice(0, 10),
          initialPaid: 0,
          requestId: crypto.randomUUID(),
          status,
          allowDuplicate: true,
        });
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back" href="/events">
        <ArrowRight size={17} />
        כל האירועים
      </Link>
      <div className="page-title">
        <div>
          <p className="eyebrow">
            {event.eventType.name} · {dateLabel(event.date)}
          </p>
          <h1>{event.client.name}</h1>
          <p>
            {event.time || 'טרם נקבעה שעה'}
            {eventLocation(event) && ' · ' + eventLocation(event)}
          </p>
        </div>
        <Link className="secondary" href={'/events/' + event.id + '/edit'}>
          <Pencil size={17} />
          עריכת האירוע
        </Link>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {event.status === 'CANCELLED' && (
        <div className="notice">
          האירוע בוטל ואינו נכלל בסיכומי ההכנסות והגבייה. תשלומים שהתקבלו נשמרים בהיסטוריה; המערכת
          אינה מבצעת החזרים כספיים.
        </div>
      )}
      <div className="stats-grid three">
        <Stat label="מחיר שסוכם" value={money(event.price)} />
        <Stat label="כבר שולם" value={money(t.paid)} />
        <Stat accent label="יתרה לתשלום" value={money(t.remaining)} />
      </div>
      <div className="detail-grid">
        <section className="panel">
          <div className="section-head">
            <h2>פרטי האירוע</h2>
            <span className={'badge ' + event.status.toLowerCase()}>{statuses[event.status]}</span>
          </div>
          <DetailLine label="לקוח">
            <Link className="text-button" href={'/clients/' + event.clientId}>
              {event.client.name}
            </Link>
          </DetailLine>
          <DetailLine label="טלפון">
            <a href={'tel:' + event.client.phone} dir="ltr">
              {event.client.phone}
            </a>
          </DetailLine>
          <DetailLine label="תאריך">{dateLabel(event.date)}</DetailLine>
          <DetailLine label="שעה">{event.time || '—'}</DetailLine>
          <DetailLine label="סוג">{event.eventType.name}</DetailLine>
          <DetailLine label="עיר">{event.city || '—'}</DetailLine>
          <DetailLine label="שם האולם">{event.venue || '—'}</DetailLine>
          <DetailLine label="מקום התארגנות">{event.preparationPlace || '—'}</DetailLine>
          {event.location && <DetailLine label="מיקום מקורי">{event.location}</DetailLine>}
          <DetailLine label="מצב תשלום">
            <PaymentBadge event={event} />
          </DetailLine>
          <Contact phone={event.client.phone} />
        </section>
        <section className="panel">
          <div className="section-head">
            <h2>היסטוריית תשלומים</h2>
            {t.remaining > 0 && event.status !== 'CANCELLED' && (
              <button className="text-button" onClick={() => setPaymentOpen(true)}>
                <Plus size={17} />
                הוספת תשלום
              </button>
            )}
          </div>
          {event.payments.length ? (
            event.payments.map((p) => (
              <div className="payment-row" key={p.id}>
                <span className="payment-icon">
                  <Wallet size={18} />
                </span>
                <div>
                  <strong>{methods[p.method]}</strong>
                  <small>{dateLabel(p.date)}</small>
                  {p.note && <p>{p.note}</p>}
                </div>
                <strong>{money(p.amount)}</strong>
              </div>
            ))
          ) : (
            <div className="empty">
              <Wallet size={28} />
              <h3>עדיין לא נרשמו תשלומים</h3>
              <p>מקדמה או תשלום מלא? אפשר לרשום כאן.</p>
            </div>
          )}
          <div className="payment-total">
            <span>סך הכל התקבל</span>
            <strong>{money(t.paid)}</strong>
          </div>
        </section>
      </div>
      <section className="panel">
        <h2>הערות לאירוע</h2>
        <p className="notes">{event.notes || 'אין הערות לאירוע הזה.'}</p>
      </section>
      <div className="detail-actions">
        {(event.status !== 'COMPLETED' || t.remaining > 0) && event.status !== 'CANCELLED' && (
          <button
            className="primary"
            disabled={busy}
            onClick={() => void changeStatus('COMPLETED')}
          >
            <CheckCheck size={18} />
            סימון כהושלם
          </button>
        )}
        <Link className="secondary" href={'/events/' + event.id + '/copy'}>
          <Copy size={17} />
          העתקת אירוע
        </Link>
        {event.status !== 'CANCELLED' && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void changeStatus('CANCELLED')}
          >
            <X size={17} />
            ביטול האירוע
          </button>
        )}
        <button
          className="danger text-button"
          disabled={busy}
          onClick={async () => {
            if (!confirm('למחוק את האירוע ואת כל התשלומים שלו לצמיתות? לא ניתן לבטל פעולה זו.'))
              return;
            setBusy(true);
            setError('');
            try {
              await mutate('/api/events/' + event.id, 'DELETE', {
                confirm: true,
                version: event.version,
              });
              await onSaved();
              router.push('/events');
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        >
          <Trash2 size={17} />
          מחיקת האירוע
        </button>
      </div>
      {event.status !== 'CANCELLED' && (event.status !== 'COMPLETED' || t.remaining > 0) && (
        <p className="muted">סימון כהושלם רושם את היתרה כתשלום ומסמן את האירוע כשולם במלואו.</p>
      )}
      <p className="muted footnote">
        נוצר ב־{dateLabel(event.createdAt)} · עודכן ב־{dateLabel(event.updatedAt)}
      </p>
      {paymentOpen && (
        <PaymentDialog event={event} close={() => setPaymentOpen(false)} onSaved={onSaved} />
      )}
    </>
  );
}
function PaymentDialog({
  event,
  close,
  onSaved,
}: {
  event: BusinessEvent;
  close: () => void;
  onSaved: () => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useRef('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="payment-dialog"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else close();
      }}
    >
      <div className="section-head">
        <h2>רישום תשלום</h2>
        <button aria-label="סגירה" disabled={busy} onClick={close}>
          <X size={22} />
        </button>
      </div>
      <p className="muted">
        {event.client.name} · יתרה: {money(totals(event).remaining)}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError('');
          id.current ||= crypto.randomUUID();
          const f = new FormData(e.currentTarget);
          try {
            await mutate('/api/events/' + event.id + '/payments', 'POST', {
              amount: Math.round(Number(f.get('amount')) * 100),
              date: f.get('date'),
              method: f.get('method'),
              note: f.get('note'),
              requestId: id.current,
            });
            await onSaved();
            close();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          סכום התשלום (₪)
          <input
            name="amount"
            autoFocus
            type="number"
            inputMode="decimal"
            min="0.01"
            max={totals(event).remaining / 100}
            step="0.01"
            required
            placeholder="0"
          />
        </label>
        <div className="form-grid">
          <label>
            תאריך
            <input
              name="date"
              type="date"
              defaultValue={today()}
              min="2000-01-01"
              max="2100-12-31"
              required
            />
          </label>
          <label>
            אמצעי תשלום
            <select name="method" defaultValue="TRANSFER">
              {Object.entries(methods).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          הערה
          <input name="note" maxLength={1000} placeholder="למשל, מקדמה לאירוע" />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? 'שומרת…' : 'שמירת התשלום'}
        </button>
      </form>
    </dialog>
  );
}
