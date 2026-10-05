import { db } from '@/lib/db';
import { guard, fail, AppError } from '@/lib/api';
import {
  csv,
  filterEvents,
  totals,
  statuses,
  methods,
  paymentLabels,
  type BusinessEvent,
  summarize,
  today,
} from '@/lib/domain';
export async function GET(request: Request) {
  try {
    await guard(request);
    const p = new URL(request.url).searchParams;
    const kind = p.get('kind') || 'events';
    if (!['events', 'clients', 'payments', 'outstanding'].includes(kind))
      throw new AppError('סוג ייצוא לא תקין');
    const raw = await db.event.findMany({
      include: { client: true, eventType: true, payments: true },
      orderBy: { date: 'asc' },
    });
    const all = JSON.parse(JSON.stringify(raw)) as BusinessEvent[];
    const items = filterEvents(all, {
      month: p.get('month') || '',
      from: p.get('from') || '',
      to: p.get('to') || '',
      query: p.get('query') || '',
      type: p.get('type') || '',
      status: p.get('status') || '',
      payment: p.get('payment') || '',
      upcoming: p.get('upcoming') === 'true',
    });
    let rows: (string | number)[][];
    if (kind === 'clients') {
      const clients = await db.client.findMany({ orderBy: { name: 'asc' } });
      rows = [
        [
          'שם',
          'טלפון',
          'מספר אירועים',
          'שווי עסקי',
          'שולם',
          'יתרה',
          'אירוע אחרון',
          'אירוע הבא',
          'הערות',
          'תאריך יצירה',
        ],
        ...clients.map((c) => {
          const s = summarize(all.filter((e) => e.clientId === c.id));
          const events = all.filter((e) => e.clientId === c.id && e.status !== 'CANCELLED');
          return [
            c.name,
            c.phone,
            s.count,
            s.revenue / 100,
            s.paid / 100,
            s.outstanding / 100,
            events
              .filter((e) => e.date.slice(0, 10) <= today())
              .at(-1)
              ?.date.slice(0, 10) || '',
            events
              .find((e) => e.date.slice(0, 10) >= today() && e.status !== 'COMPLETED')
              ?.date.slice(0, 10) || '',
            c.notes,
            c.createdAt.toISOString(),
          ];
        }),
      ];
    } else if (kind === 'payments') {
      rows = [
        [
          'מזהה תשלום',
          'לקוח',
          'טלפון',
          'תאריך אירוע',
          'תאריך תשלום',
          'סכום',
          'אמצעי תשלום',
          'הערה',
          'תאריך רישום',
        ],
        ...items.flatMap((e) =>
          e.payments.map((x) => [
            x.id,
            e.client.name,
            e.client.phone,
            e.date.slice(0, 10),
            x.date.slice(0, 10),
            x.amount / 100,
            methods[x.method],
            x.note,
            x.createdAt,
          ]),
        ),
      ];
    } else {
      rows = [
        [
          'מזהה אירוע',
          'לקוח',
          'טלפון',
          'תאריך',
          'שעה',
          'סוג אירוע',
          'מיקום',
          'מחיר',
          'שולם',
          'יתרה',
          'מצב תשלום',
          'מצב אירוע',
          'הערות',
          'תאריך יצירה',
          'עדכון אחרון',
        ],
        ...items
          .filter(
            (e) => kind !== 'outstanding' || (e.status !== 'CANCELLED' && totals(e).remaining > 0),
          )
          .map((e) => {
            const t = totals(e);
            return [
              e.id,
              e.client.name,
              e.client.phone,
              e.date.slice(0, 10),
              e.time,
              e.eventType.name,
              e.location,
              e.price / 100,
              t.paid / 100,
              t.remaining / 100,
              paymentLabels[t.state],
              statuses[e.status],
              e.notes,
              e.createdAt,
              e.updatedAt,
            ];
          }),
      ];
    }
    return new Response(csv(rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="nofer-${kind}.csv"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    return fail(e);
  }
}
