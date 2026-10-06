'use client';
import Link from './app-link';
import {
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  MapPin,
  ArrowUpLeft,
  Plus,
  Wallet,
  Phone,
  MessageCircle,
} from 'lucide-react';
import {
  dateLabel,
  eventLocation,
  monthLabel,
  shiftMonth,
  money,
  totals,
  statuses,
  paymentLabels,
  whatsapp,
  type BusinessEvent,
} from '@/lib/domain';
export function MonthPicker({ month, onChange }: { month: string; onChange: (v: string) => void }) {
  return (
    <div className="month-picker">
      <button aria-label="החודש הקודם" onClick={() => onChange(shiftMonth(month, -1))}>
        <ChevronRight size={18} />
      </button>
      <label>
        <span>{monthLabel(month)}</span>
        <input
          aria-label="בחירת חודש"
          type="month"
          value={month}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          min="2000-01"
          max="2100-12"
        />
      </label>
      <button aria-label="החודש הבא" onClick={() => onChange(shiftMonth(month, 1))}>
        <ChevronLeft size={18} />
      </button>
    </div>
  );
}
export function Empty({
  title = 'אין אירועים להצגה',
  text = 'האירוע הבא מתחיל כאן. הוסיפי אירוע ונעשה סדר בכל השאר.',
  add = false,
}: {
  title?: string;
  text?: string;
  add?: boolean;
}) {
  return (
    <div className="empty">
      <span>
        <CalendarDays size={30} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {add && (
        <Link className="primary" href="/events/new">
          <Plus size={18} />
          אירוע חדש
        </Link>
      )}
    </div>
  );
}
export function Stat({
  label,
  value,
  sub,
  accent = false,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className={'stat ' + (accent ? 'accent' : '')}>
      <div className="stat-label">
        {label}
        {icon || <Wallet size={18} />}
      </div>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}
export function EventCard({ event, compact = false }: { event: BusinessEvent; compact?: boolean }) {
  const t = totals(event);
  return (
    <Link href={'/events/' + event.id} className={'event-card ' + (compact ? 'compact' : '')}>
      <div className={'date-tile ' + event.status.toLowerCase()}>
        <strong>{new Date(event.date).getUTCDate()}</strong>
        <span>
          {new Intl.DateTimeFormat('he-IL', { month: 'short', timeZone: 'UTC' }).format(
            new Date(event.date),
          )}
        </span>
      </div>
      <div className="event-main">
        <div className="event-heading">
          <h3>{event.client.name}</h3>
          <PaymentBadge event={event} />
          {event.status === 'CANCELLED' && (
            <span className="badge cancelled">{statuses.CANCELLED}</span>
          )}
        </div>
        <p>
          {event.eventType.name} · {dateLabel(event.date)}
          {event.time && (
            <>
              {' '}
              · <bdi>{event.time}</bdi>
            </>
          )}
        </p>
        <small>
          <MapPin size={13} />
          {eventLocation(event) || 'לא צוין מיקום'}
        </small>
        {event.preparationPlace && (
          <small>
            <MapPin size={13} />
            מקום התארגנות: {event.preparationPlace}
          </small>
        )}
      </div>
      <div className="event-money">
        <strong>{money(event.price)}</strong>
        <span className={t.remaining > 0 && event.status !== 'CANCELLED' ? 'unpaid' : 'paid'}>
          {event.status === 'CANCELLED'
            ? 'בוטל'
            : t.remaining > 0
              ? `${money(t.remaining)} לגבייה`
              : 'שולם במלואו'}
        </span>
      </div>
      <ArrowUpLeft className="event-arrow" size={18} />
    </Link>
  );
}
export function Contact({ phone }: { phone: string | null }) {
  if (!phone) return null;
  return (
    <div className="contact">
      <a className="secondary" href={'tel:' + phone}>
        <Phone size={17} />
        התקשרות
      </a>
      <a className="secondary" href={whatsapp(phone)} target="_blank" rel="noopener noreferrer">
        <MessageCircle size={17} />
        וואטסאפ
      </a>
    </div>
  );
}
export function PaymentBadge({ event }: { event: BusinessEvent }) {
  const t = totals(event);
  return <span className={'badge ' + t.state.toLowerCase()}>{paymentLabels[t.state]}</span>;
}
export function Bars({
  items,
  label = 'הכנסות חודשיות',
}: {
  items: { label: string; value: number; secondary?: number }[];
  label?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div
      className="chart"
      role="img"
      aria-label={label + ': ' + items.map((x) => x.label + ' ' + money(x.value)).join(', ')}
    >
      {items.map((item, i) => (
        <div className="chart-col" key={item.label}>
          <span className="chart-value">{money(item.value)}</span>
          <div className="bar-track">
            <div
              className={'bar ' + (i === items.length - 1 ? 'current' : '')}
              style={{ height: Math.max(item.value ? 3 : 0, (item.value / max) * 100) + '%' }}
            >
              {item.secondary !== undefined && (
                <div
                  className="bar-collected"
                  style={{ height: (item.value ? (item.secondary / item.value) * 100 : 0) + '%' }}
                />
              )}
            </div>
          </div>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
export function SectionHead({
  title,
  href,
  label = 'הצגת הכל',
}: {
  title: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {href && (
        <Link href={href}>
          {label}
          <ChevronLeft size={16} />
        </Link>
      )}
    </div>
  );
}
export function DetailLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="detail-line">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}
export { dateLabel };
