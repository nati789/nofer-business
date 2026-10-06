import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventSchema } from '../src/lib/validation';
import {
  parseManualDate,
  manualDate,
  eventTypeNames,
  filterEvents,
  currentMonthEvents,
  type BusinessEvent,
} from '../src/lib/domain';
const body = {
  name: 'לקוח',
  date: '2026-10-18',
  eventTypeId: 'wedding',
  price: 20000,
  requestId: '7bb1355d-c95f-472a-93be-d5fa273c81f5',
  city: 'חיפה',
  venue: 'אולם הכרמל',
};
test('phone is optional while provided phones are validated and normalized', () => {
  for (const phone of [undefined, null, '', '  '])
    assert.equal(eventSchema.parse({ ...body, phone }).phone, null);
  assert.equal(eventSchema.parse({ ...body, phone: '+972 50 1234567' }).phone, '0501234567');
  assert.equal(eventSchema.safeParse({ ...body, phone: 'abc' }).success, false);
});
test('event dates are mandatory and manual dates reject rollover', () => {
  for (const date of [undefined, '', '2026-02-30'])
    assert.equal(eventSchema.safeParse({ ...body, date }).success, false);
  assert.equal(parseManualDate('18/10/2026'), '2026-10-18');
  assert.equal(manualDate('2026-10-18'), '18/10/2026');
  for (const date of ['31/04/2026', '29/02/2026', '18/13/2026', ''])
    assert.equal(parseManualDate(date), '');
  assert.equal(parseManualDate('29/02/2028'), '2028-02-29');
});
test('exact event types and location searching support clients without phones', () => {
  assert.deepEqual(eventTypeNames, [
    'חתונה חצי יום',
    'חתונה יום שלם',
    'חינה',
    'הפרשת חלה',
    'ברית',
    'בר מצווה',
    'צילומים',
  ]);
  const event = {
    ...body,
    client: { name: body.name, phone: null },
    eventType: { name: 'חתונה' },
    location: 'מיקום מקורי',
    preparationPlace: 'מלון התארגנות',
    notes: '',
    payments: [],
  } as unknown as BusinessEvent;
  for (const query of ['חיפה', 'הכרמל', 'מקורי', 'התארגנות'])
    assert.equal(filterEvents([event], { query }).length, 1);
  assert.equal(filterEvents([event], { query: '12345' }).length, 0);
});

test('preparation place is optional, trims whitespace and validates length', () => {
  for (const preparationPlace of [undefined, null, '', '   ']) {
    assert.equal(eventSchema.safeParse({ ...body, preparationPlace }).success, true);
  }
  assert.equal(eventSchema.parse({ ...body, preparationPlace: ' מלון ' }).preparationPlace, 'מלון');
  assert.equal(eventSchema.parse({ ...body, preparationPlace: ' ' }).preparationPlace, null);
  assert.equal(
    eventSchema.safeParse({ ...body, preparationPlace: 'א'.repeat(301) }).success,
    false,
  );
  assert.equal(eventSchema.parse(body).status, undefined);
  assert.equal(eventSchema.parse({ ...body, status: 'COMPLETED' }).status, 'COMPLETED');
});

test('dashboard month includes every current-month event and sorts dates and times without mutating input', () => {
  const input = [
    { id: 'late', date: '2026-10-31', time: '18:00', status: 'NEW' },
    { id: 'next', date: '2026-11-01', time: '09:00', status: 'NEW' },
    { id: 'afternoon', date: '2026-10-12', time: '15:00', status: 'NEW' },
    { id: 'morning', date: '2026-10-12', time: '08:00', status: 'NEW' },
    { id: 'completed', date: '2026-10-02', time: '', status: 'COMPLETED' },
    { id: 'cancelled', date: '2026-10-03', time: '', status: 'CANCELLED' },
    { id: 'first', date: '2026-10-01', time: '', status: 'NEW' },
    { id: 'previous', date: '2026-09-30', time: '', status: 'NEW' },
  ] as BusinessEvent[];
  const order = input.map((e) => e.id);
  assert.deepEqual(
    currentMonthEvents(input, '2026-10-20').map((e) => e.id),
    ['first', 'completed', 'cancelled', 'morning', 'afternoon', 'late'],
  );
  assert.deepEqual(
    input.map((e) => e.id),
    order,
  );
  assert.deepEqual(currentMonthEvents(input, '2026-12-01'), []);
});
