import { db } from './db';
import { AppError } from './api';
import { eventSchema, paymentSchema, completionSchema } from './validation';
import { correctedPaid } from './payment-plan';
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
      if (!old && v.paymentChanges) throw new AppError('תיקון תשלומים זמין בעריכת אירוע בלבד');
      if (old?.status === 'CANCELLED' && v.paymentChanges?.some((p) => !p.remove && !p.id))
        throw new AppError('לא ניתן להוסיף תשלום לאירוע שבוטל');
      let paid = v.initialPaid;
      if (old) {
        try {
          paid = correctedPaid(old.payments, v.paymentChanges ?? [], v.price);
        } catch (error) {
          throw new AppError((error as Error).message);
        }
      }
      const type = await tx.eventType.findUnique({ where: { id: v.eventTypeId } });
      if (!type || (!type.active && old?.eventTypeId !== type.id))
        throw new AppError('סוג האירוע אינו זמין');
      const client = v.phone
        ? await tx.client.upsert({
            where: { phone: v.phone },
            create: { name: v.name, phone: v.phone },
            update: {},
          })
        : old
          ? await tx.client.update({
              where: { id: old.clientId },
              data: { name: v.name, phone: null },
            })
          : await tx.client.create({ data: { name: v.name, phone: null } });
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
        location: v.location ?? old?.location ?? '',
        city: v.city,
        venue: v.venue ?? v.location ?? old?.venue ?? '',
        preparationPlace:
          v.preparationPlace === undefined ? (old?.preparationPlace ?? null) : v.preparationPlace,
        price: v.price,
        status: v.status ?? old?.status ?? 'NEW',
        notes: v.notes,
      };
      if (id) {
        for (const change of v.paymentChanges ?? []) {
          if (change.remove) {
            await tx.payment.delete({ where: { id: change.id } });
          } else {
            const payment = {
              amount: change.amount,
              date: new Date(change.date + 'T00:00:00Z'),
              method: change.method,
              note: change.note,
            };
            if (change.id) {
              const previous = old!.payments.find((p) => p.id === change.id)!;
              if (
                previous.amount !== payment.amount ||
                previous.date.getTime() !== payment.date.getTime() ||
                previous.method !== payment.method ||
                previous.note !== payment.note
              )
                await tx.payment.update({ where: { id: change.id }, data: payment });
            } else {
              await tx.payment.create({
                data: { ...payment, eventId: id, requestId: change.requestId! },
              });
            }
          }
        }
        if (v.status === 'COMPLETED' && old?.status !== 'COMPLETED' && v.price > paid)
          await tx.payment.create({
            data: {
              eventId: id,
              amount: v.price - paid,
              date: new Date(today() + 'T00:00:00Z'),
              method: 'OTHER',
              note: 'השלמת יתרה בעת סימון כהושלם',
              requestId: v.requestId,
            },
          });
        return tx.event.update({
          where: { id, version: v.version },
          data: { ...data, version: { increment: 1 } },
        });
      }
      return tx.event.create({
        data: {
          ...data,
          requestId: v.requestId,
          ...(v.initialPaid || (v.status === 'COMPLETED' && v.price > paid)
            ? {
                payments: {
                  create: [
                    ...(v.initialPaid
                      ? [
                          {
                            amount: v.initialPaid,
                            date: new Date(today() + 'T00:00:00Z'),
                            method: v.initialMethod,
                            note: 'תשלום ראשוני',
                            requestId: v.requestId,
                          },
                        ]
                      : []),
                    ...(v.status === 'COMPLETED' && v.price > paid
                      ? [
                          {
                            amount: v.price - paid,
                            date: new Date(today() + 'T00:00:00Z'),
                            method: 'OTHER' as const,
                            note: 'השלמת יתרה בעת סימון כהושלם',
                            requestId: crypto.randomUUID(),
                          },
                        ]
                      : []),
                  ],
                },
              }
            : {}),
        },
      });
    },
    { isolationLevel: 'Serializable' },
  );
}
export async function completeEvent(eventId: string, body: unknown) {
  const v = completionSchema.parse(body);
  return db.$transaction(
    async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: eventId },
        include: { payments: true },
      });
      if (!event) throw new AppError('האירוע לא נמצא', 404);
      const prior = await tx.payment.findUnique({ where: { requestId: v.requestId } });
      if (prior) {
        if (prior.eventId !== eventId || prior.note !== 'השלמת יתרה בעת סימון כהושלם')
          throw new AppError('מזהה הבקשה כבר בשימוש', 409);
        return event;
      }
      const paid = event.payments.reduce((sum, p) => sum + p.amount, 0);
      if (event.status === 'CANCELLED') throw new AppError('לא ניתן להשלים אירוע שבוטל');
      if (paid > event.price)
        throw new AppError('התשלומים גבוהים ממחיר האירוע. יש לתקן אותם בעריכת האירוע');
      if (event.status === 'COMPLETED' && paid === event.price) return event;
      if (event.version !== v.version)
        throw new AppError('האירוע עודכן במכשיר אחר. יש לרענן לפני השלמה.', 409);
      if (paid < event.price)
        await tx.payment.create({
          data: {
            eventId,
            amount: event.price - paid,
            date: new Date(today() + 'T00:00:00Z'),
            method: 'OTHER',
            note: 'השלמת יתרה בעת סימון כהושלם',
            requestId: v.requestId,
          },
        });
      return tx.event.update({
        where: { id: eventId, version: v.version },
        data: { status: 'COMPLETED', version: { increment: 1 } },
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
