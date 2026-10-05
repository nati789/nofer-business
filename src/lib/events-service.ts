import { db } from './db';
import { AppError } from './api';
import { eventSchema, paymentSchema } from './validation';
import { today } from './domain';
export async function saveEvent(body: unknown, id?: string) {
  const v = eventSchema.parse(body);
  return db.$transaction(
    async (tx) => {
      if (!id) {
        const existing = await tx.event.findUnique({ where: { requestId: v.requestId } });
        if (existing) return existing;
      }
      const old = id
        ? await tx.event.findUnique({ where: { id }, include: { payments: true } })
        : null;
      if (id && !old) throw new AppError('האירוע לא נמצא', 404);
      if (old && old.version !== v.version)
        throw new AppError('האירוע עודכן במכשיר אחר. יש לרענן לפני שמירה.', 409);
      if (old && old.payments.reduce((s, p) => s + p.amount, 0) > v.price)
        throw new AppError('המחיר נמוך מהסכום שכבר שולם');
      const type = await tx.eventType.findUnique({ where: { id: v.eventTypeId } });
      if (!type || (!type.active && old?.eventTypeId !== type.id))
        throw new AppError('סוג האירוע אינו זמין');
      const client = await tx.client.upsert({
        where: { phone: v.phone },
        create: { name: v.name, phone: v.phone },
        update: {},
      });
      const date = new Date(v.date + 'T00:00:00Z');
      if (
        !v.allowDuplicate &&
        (await tx.event.findFirst({
          where: {
            clientId: client.id,
            date,
            eventTypeId: v.eventTypeId,
            status: { not: 'CANCELLED' },
            ...(id ? { id: { not: id } } : {}),
          },
        }))
      )
        throw new AppError(
          'קיים אירוע דומה לאותו לקוח באותו יום. סמנו אישור לאירוע נוסף כדי להמשיך.',
          409,
        );
      const data = {
        clientId: client.id,
        eventTypeId: v.eventTypeId,
        date,
        time: v.time,
        location: v.location,
        price: v.price,
        status: v.status,
        notes: v.notes,
      };
      if (id)
        return tx.event.update({
          where: { id, version: v.version },
          data: { ...data, version: { increment: 1 } },
        });
      return tx.event.create({
        data: {
          ...data,
          requestId: v.requestId,
          ...(v.initialPaid
            ? {
                payments: {
                  create: {
                    amount: v.initialPaid,
                    date: new Date(today() + 'T00:00:00Z'),
                    method: v.initialMethod,
                    note: 'תשלום ראשוני',
                    requestId: v.requestId,
                  },
                },
              }
            : {}),
        },
      });
    },
    { isolationLevel: 'Serializable' },
  );
}
export async function addPayment(eventId: string, body: unknown) {
  const v = paymentSchema.parse(body);
  return db.$transaction(
    async (tx) => {
      const existing = await tx.payment.findUnique({ where: { requestId: v.requestId } });
      if (existing) {
        if (existing.eventId !== eventId) throw new AppError('מזהה תשלום כבר בשימוש', 409);
        return existing;
      }
      const event = await tx.event.findUnique({
        where: { id: eventId },
        include: { payments: true },
      });
      if (!event) throw new AppError('האירוע לא נמצא', 404);
      if (event.status === 'CANCELLED') throw new AppError('לא ניתן להוסיף תשלום לאירוע שבוטל');
      const paid = event.payments.reduce((s, p) => s + p.amount, 0);
      if (paid + v.amount > event.price) throw new AppError('התשלום גבוה מהיתרה לתשלום');
      await tx.event.update({ where: { id: eventId }, data: { version: { increment: 1 } } });
      return tx.payment.create({ data: { ...v, eventId, date: new Date(v.date + 'T00:00:00Z') } });
    },
    { isolationLevel: 'Serializable' },
  );
}
