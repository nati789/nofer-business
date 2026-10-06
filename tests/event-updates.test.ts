import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventSchema } from '../src/lib/validation';
import {
  parseManualDate,
  manualDate,
  eventTypeNames,
  filterEvents,
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
  assert.deepEqual(eventTypeNames, ['חתונה', 'חינה', 'הפרשת חלה', 'ברית', 'צילומים']);
  const event = {
    ...body,
    client: { name: body.name, phone: null },
    eventType: { name: 'חתונה' },
    location: 'מיקום מקורי',
    notes: '',
    payments: [],
  } as unknown as BusinessEvent;
  for (const query of ['חיפה', 'הכרמל', 'מקורי'])
    assert.equal(filterEvents([event], { query }).length, 1);
  assert.equal(filterEvents([event], { query: '12345' }).length, 0);
});
