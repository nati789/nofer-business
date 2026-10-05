import { z } from 'zod';
import { normalizePhone } from './domain';
const text = (max = 500) => z.string().trim().max(max, 'הטקסט ארוך מדי');
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'תאריך לא תקין')
  .refine((s) => {
    const d = new Date(s + 'T00:00:00Z');
    return (
      !isNaN(d.getTime()) &&
      d.toISOString().slice(0, 10) === s &&
      s >= '2000-01-01' &&
      s <= '2100-12-31'
    );
  }, 'תאריך לא תקין');
export const phoneSchema = text(30)
  .transform(normalizePhone)
  .pipe(z.string().regex(/^0\d{8,9}$/, 'יש להזין מספר טלפון ישראלי תקין'));
export const amountSchema = z
  .number()
  .int('יש להזין סכום מדויק באגורות')
  .min(0, 'הסכום חייב להיות חיובי')
  .max(100_000_000, 'הסכום גבוה מדי');
export const eventSchema = z
  .object({
    name: text(100).min(1, 'יש להזין שם לקוח'),
    phone: phoneSchema,
    date: dateSchema,
    time: text(5)
      .refine((s) => !s || /^([01]\d|2[0-3]):[0-5]\d$/.test(s), 'שעה לא תקינה')
      .default(''),
    eventTypeId: text(100).min(1, 'יש לבחור סוג אירוע'),
    location: text(300).default(''),
    price: amountSchema,
    initialPaid: amountSchema.default(0),
    initialMethod: z
      .enum(['CASH', 'TRANSFER', 'BIT', 'PAYBOX', 'CARD', 'OTHER'])
      .default('TRANSFER'),
    status: z.enum(['NEW', 'CONFIRMED', 'UPCOMING', 'COMPLETED', 'CANCELLED']).default('NEW'),
    notes: text(5000).default(''),
    requestId: z.string().uuid(),
    allowDuplicate: z.boolean().default(false),
    version: z.number().int().positive().optional(),
  })
  .refine((v) => v.initialPaid <= v.price, {
    message: 'התשלום גבוה ממחיר האירוע',
    path: ['initialPaid'],
  });
export const paymentSchema = z.object({
  amount: amountSchema.refine((n) => n > 0, 'יש להזין סכום גדול מאפס'),
  date: dateSchema,
  method: z.enum(['CASH', 'TRANSFER', 'BIT', 'PAYBOX', 'CARD', 'OTHER']),
  note: text(1000).default(''),
  requestId: z.string().uuid(),
});
export const clientSchema = z.object({
  name: text(100).min(1, 'יש להזין שם'),
  phone: phoneSchema,
  notes: text(5000),
});
