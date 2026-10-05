export const statuses = {
  NEW: 'חדש',
  CONFIRMED: 'מאושר',
  UPCOMING: 'קרוב',
  COMPLETED: 'הושלם',
  CANCELLED: 'בוטל',
};
export const methods = {
  CASH: 'מזומן',
  TRANSFER: 'העברה בנקאית',
  BIT: 'ביט',
  PAYBOX: 'פייבוקס',
  CARD: 'כרטיס אשראי',
  OTHER: 'אחר',
};
export const paymentLabels = { UNPAID: 'לא שולם', PARTIAL: 'שולם חלקית', PAID: 'שולם במלואו' };
export type Status = keyof typeof statuses;
export type Method = keyof typeof methods;
export type PaymentState = keyof typeof paymentLabels;
export type Client = {
  id: string;
  name: string;
  phone: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};
export type EventType = { id: string; name: string; active: boolean };
export type Payment = {
  id: string;
  amount: number;
  date: string;
  method: Method;
  note: string;
  createdAt: string;
};
export type BusinessEvent = {
  id: string;
  clientId: string;
  eventTypeId: string;
  client: Client;
  eventType: EventType;
  date: string;
  time: string;
  location: string;
  price: number;
  status: Status;
  notes: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  payments: Payment[];
};
export type Snapshot = { events: BusinessEvent[]; clients: Client[]; types: EventType[] };
export const money = (amount: number) =>
  new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: amount % 100 ? 2 : 0,
  }).format(amount / 100);
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(date));
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export const monthLabel = (month: string) =>
  new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(month + '-01T00:00:00Z'),
  );
export function shiftMonth(month: string, offset: number) {
  const d = new Date(month + '-01T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 7);
}
export function totals(event: Pick<BusinessEvent, 'price' | 'payments'>) {
  const paid = event.payments.reduce((s, p) => s + p.amount, 0);
  const remaining = event.price - paid;
  return {
    paid,
    remaining,
    state: (remaining <= 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID') as PaymentState,
  };
}
export function normalizePhone(value: string) {
  let phone = value.replace(/[\s()+.-]/g, '');
  if (phone.startsWith('00972')) phone = '0' + phone.slice(5);
  else if (phone.startsWith('972')) phone = '0' + phone.slice(3);
  return phone;
}
export const whatsapp = (phone: string) =>
  'https://wa.me/' + (phone.startsWith('0') ? '972' + phone.slice(1) : phone);
export type Filters = {
  query?: string;
  month?: string;
  from?: string;
  to?: string;
  type?: string;
  status?: string;
  payment?: string;
  upcoming?: boolean;
};
export function filterEvents(events: BusinessEvent[], f: Filters, day = today()) {
  const q = f.query?.trim().toLocaleLowerCase();
  const digits = q?.replace(/\D/g, '');
  return events.filter((e) => {
    const d = e.date.slice(0, 10);
    const haystack = [e.client.name, e.client.phone, e.eventType.name, e.location, e.notes]
      .join(' ')
      .toLocaleLowerCase();
    return (
      (!q ||
        haystack.includes(q) ||
        (!!digits && digits.length >= 3 && e.client.phone.includes(normalizePhone(q)))) &&
      (!f.month || d.startsWith(f.month)) &&
      (!f.from || d >= f.from) &&
      (!f.to || d <= f.to) &&
      (!f.type || e.eventTypeId === f.type) &&
      (!f.status || e.status === f.status) &&
      (!f.payment ||
        (f.payment === 'OUTSTANDING' ? totals(e).remaining > 0 : totals(e).state === f.payment)) &&
      (!f.upcoming || (d >= day && e.status !== 'CANCELLED' && e.status !== 'COMPLETED'))
    );
  });
}
export function summarize(events: BusinessEvent[], month?: string) {
  const items = events.filter(
    (e) => e.status !== 'CANCELLED' && (!month || e.date.startsWith(month)),
  );
  const revenue = items.reduce((s, e) => s + e.price, 0);
  const paid = items.reduce((s, e) => s + totals(e).paid, 0);
  return {
    count: items.length,
    revenue,
    paid,
    outstanding: revenue - paid,
    average: items.length ? Math.round(revenue / items.length) : 0,
    clients: new Set(items.map((e) => e.clientId)).size,
    completed: items.filter((e) => e.status === 'COMPLETED').length,
  };
}
export function csv(rows: (string | number)[][]) {
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((value) => {
            let s = String(value);
            if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
            return '"' + s.replaceAll('"', '""') + '"';
          })
          .join(','),
      )
      .join('\r\n')
  );
}
