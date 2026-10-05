'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Check, UserRound, CalendarDays, Wallet } from 'lucide-react';
import {
  normalizePhone,
  today,
  methods,
  statuses,
  type BusinessEvent,
  type Snapshot,
} from '@/lib/domain';
export async function mutate(url: string, method: string, body: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'הפעולה לא הושלמה');
  return data;
}
export default function EventForm({
  data,
  event,
  copy = false,
  onSaved,
}: {
  data: Snapshot;
  event?: BusinessEvent;
  copy?: boolean;
  onSaved: () => Promise<void>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState(event?.client.phone || '');
  const [name, setName] = useState(event?.client.name || '');
  const requestId = useRef('');
  const existing = data.clients.find((c) => c.phone === normalizePhone(phone));
  const edit = !!event && !copy;
  return (
    <>
      <Link className="back" href={edit ? '/events/' + event.id : '/events'}>
        <ArrowRight size={17} />
        חזרה לאירועים
      </Link>
      <div className="page-title">
        <div>
          <p className="eyebrow">מכניסים קצת סדר ליומן</p>
          <h1>{edit ? 'עריכת אירוע' : copy ? 'העתקת אירוע' : 'אירוע חדש'}</h1>
          <p>כמה פרטים קטנים, והאירוע כבר ביומן.</p>
        </div>
      </div>
      <form
        className="form-card"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError('');
          const f = new FormData(e.currentTarget);
          requestId.current ||= crypto.randomUUID();
          try {
            const result = await mutate(
              edit ? '/api/events/' + event.id : '/api/events',
              edit ? 'PUT' : 'POST',
              {
                name,
                phone,
                date: f.get('date'),
                time: f.get('time'),
                eventTypeId: f.get('eventTypeId'),
                location: f.get('location'),
                price: Math.round(Number(f.get('price')) * 100),
                initialPaid: edit ? 0 : Math.round(Number(f.get('initialPaid') || 0) * 100),
                initialMethod: f.get('initialMethod') || 'TRANSFER',
                status: f.get('status'),
                notes: f.get('notes'),
                allowDuplicate: f.get('allowDuplicate') === 'on',
                requestId: requestId.current,
                version: event?.version,
              },
            );
            await onSaved();
            router.push('/events/' + result.id);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <legend>
            <UserRound size={19} />
            פרטי הלקוח
          </legend>
          <div className="form-grid">
            <label>
              טלפון <span className="required">*</span>
              <input
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  const match = data.clients.find(
                    (c) => c.phone === normalizePhone(e.target.value),
                  );
                  if (match) setName(match.name);
                }}
                required
                placeholder="050-0000000"
                dir="ltr"
                list="recent-clients"
              />
              <datalist id="recent-clients">
                {data.clients.slice(0, 12).map((c) => (
                  <option key={c.id} value={c.phone}>
                    {c.name}
                  </option>
                ))}
              </datalist>
            </label>
            <label>
              שם הלקוח <span className="required">*</span>
              <input
                name="name"
                autoComplete="name"
                value={name}
                readOnly={!!existing}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
                placeholder="שם מלא"
              />
            </label>
          </div>
          {existing && (
            <p className="inline-success">
              <Check size={16} />
              זיהינו את {existing.name}. האירוע יתווסף לתיק הלקוח.
            </p>
          )}
        </fieldset>
        <fieldset disabled={busy}>
          <legend>
            <CalendarDays size={19} />
            פרטי האירוע
          </legend>
          <div className="form-grid">
            <label>
              תאריך האירוע <span className="required">*</span>
              <input
                name="date"
                type="date"
                defaultValue={!copy && event ? event.date.slice(0, 10) : today()}
                min="2000-01-01"
                max="2100-12-31"
                required
              />
            </label>
            <label>
              שעה
              <input name="time" type="time" defaultValue={event?.time || ''} />
            </label>
            <label>
              סוג אירוע <span className="required">*</span>
              <select name="eventTypeId" defaultValue={event?.eventTypeId || ''} required>
                <option value="" disabled>
                  בחירת סוג אירוע
                </option>
                {data.types
                  .filter((t) => t.active || t.id === event?.eventTypeId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              מצב האירוע
              <select name="status" defaultValue={edit ? event.status : 'NEW'}>
                {Object.entries(statuses).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              מיקום
              <input
                name="location"
                defaultValue={event?.location || ''}
                placeholder="כתובת או שם המקום"
                maxLength={300}
              />
            </label>
          </div>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>
            <Wallet size={19} />
            מחיר ותשלום
          </legend>
          <div className="form-grid">
            <label>
              מחיר שסוכם (₪) <span className="required">*</span>
              <input
                name="price"
                type="number"
                inputMode="decimal"
                min="0"
                max="1000000"
                step="0.01"
                defaultValue={event ? event.price / 100 : ''}
                placeholder="0"
                required
              />
            </label>
            {!edit && (
              <>
                <label>
                  כבר שולם (₪)
                  <input
                    name="initialPaid"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    defaultValue="0"
                  />
                </label>
                <label>
                  אמצעי התשלום הראשוני
                  <select name="initialMethod" defaultValue="TRANSFER">
                    {Object.entries(methods).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
          {edit && <p className="muted">תשלומים נוספים נרשמים בנפרד בעמוד האירוע.</p>}
        </fieldset>
        <label>
          הערות
          <textarea
            name="notes"
            rows={3}
            maxLength={5000}
            defaultValue={event?.notes || ''}
            placeholder="כל מה שכדאי לזכור לקראת האירוע…"
          />
        </label>
        <label className="checkbox">
          <input type="checkbox" name="allowDuplicate" />
          אישור יצירת אירוע נוסף אם כבר קיים אירוע דומה
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <button type="submit" className="primary" disabled={busy}>
            <Check size={18} />
            {busy ? 'שומרת…' : edit ? 'שמירת שינויים' : 'שמירת האירוע'}
          </button>
          <Link className="secondary" href={edit ? '/events/' + event.id : '/events'}>
            ביטול
          </Link>
        </div>
      </form>
    </>
  );
}
