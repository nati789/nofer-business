import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  totals,
  normalizePhone,
  summarize,
  filterEvents,
  csv,
  shiftMonth,
  type BusinessEvent,
} from '../src/lib/domain';
import { eventSchema, paymentSchema, dateSchema } from '../src/lib/validation';
const event = {
  id: 'one',
  clientId: 'a',
  client: { name: 'דנה', phone: '0501234567' },
  eventTypeId: 'birthday',
  eventType: { name: 'יום הולדת' },
  price: 200000,
  payments: [],
  date: '2026-10-12T00:00:00Z',
  status: 'CONFIRMED',
  location: 'תל אביב',
  notes: 'בלונים ורודים',
} as unknown as BusinessEvent;
test('500 + 1000 + 500 exactly settles a 2,000 NIS event', () => {
  let e = { ...event, payments: [{ amount: 50000 }] } as BusinessEvent;
  assert.deepEqual(totals(e), { paid: 50000, remaining: 150000, state: 'PARTIAL' });
  e = {
    ...e,
    payments: [{ amount: 50000 }, { amount: 100000 }, { amount: 50000 }],
  } as BusinessEvent;
  assert.deepEqual(totals(e), { paid: 200000, remaining: 0, state: 'PAID' });
  assert.equal(totals(event).state, 'UNPAID');
});
test('zero price is paid and agorot stay exact', () => {
  assert.equal(totals({ ...event, price: 0 }).state, 'PAID');
  assert.equal(
    totals({ ...event, price: 30, payments: [{ amount: 10 }, { amount: 20 }] } as BusinessEvent)
      .remaining,
    0,
  );
});
test('Israeli local and international phones match', () => {
  for (const phone of ['050-123-4567', '+972 50 123 4567', '00972(50)1234567'])
    assert.equal(normalizePhone(phone), '0501234567');
});
test('month grouping excludes cancelled events and counts unique clients', () => {
  const events = [
    event,
    { ...event, id: 'b', price: 100000, payments: [{ amount: 30000 }] },
    { ...event, id: 'c', status: 'CANCELLED', price: 999999 },
    { ...event, id: 'd', date: '2026-09-30T00:00:00Z' },
  ] as BusinessEvent[];
  assert.deepEqual(summarize(events, '2026-10'), {
    count: 2,
    revenue: 300000,
    paid: 30000,
    outstanding: 270000,
    average: 150000,
    clients: 1,
    completed: 0,
  });
});
test('filters combine month, type, notes, range, status and payment state', () => {
  assert.equal(
    filterEvents([event], {
      month: '2026-10',
      type: 'birthday',
      query: 'ורודים',
      from: '2026-10-01',
      to: '2026-10-31',
      status: 'CONFIRMED',
      payment: 'OUTSTANDING',
    }).length,
    1,
  );
  assert.equal(filterEvents([event], { month: '2026-09', type: 'birthday' }).length, 0);
  assert.equal(filterEvents([event], { query: '+972 50 123 4567' }).length, 1);
  assert.equal(filterEvents([event], { upcoming: true }, '2026-11-01').length, 0);
});
test('CSV supports Hebrew, escaped quotes, newlines and formula protection', () => {
  const output = csv([
    ['לקוח', 'הערה'],
    ['=HYPERLINK("bad")', 'שלום\nעולם'],
  ]);
  assert.ok(output.startsWith('\uFEFF'));
  assert.ok(output.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(output.includes('"שלום\nעולם"'));
});
test('validation rejects impossible dates and invalid amounts', () => {
  assert.equal(dateSchema.safeParse('2026-02-30').success, false);
  assert.equal(dateSchema.safeParse('2028-02-29').success, true);
  assert.equal(
    paymentSchema.safeParse({
      amount: -1,
      date: '2026-10-05',
      method: 'CASH',
      requestId: crypto.randomUUID(),
    }).success,
    false,
  );
  assert.equal(
    eventSchema.safeParse({
      name: 'דנה',
      phone: '0501234567',
      date: '2026-10-05',
      eventTypeId: 'birthday',
      price: 100,
      initialPaid: 101,
      requestId: crypto.randomUUID(),
    }).success,
    false,
  );
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
});
