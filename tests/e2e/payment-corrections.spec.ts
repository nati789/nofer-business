import { test, expect, type APIRequestContext } from '@playwright/test';
import { cleanTestData, closeTestDatabase } from '../cleanup';
import { db } from '../../src/lib/db';
import {
  today,
  totals,
  summarize,
  money,
  type Snapshot,
  type BusinessEvent,
} from '../../src/lib/domain';

test.beforeEach(cleanTestData);
test.afterEach(cleanTestData);
test.afterAll(closeTestDatabase);
const snapshot = async (request: APIRequestContext): Promise<Snapshot> =>
  (await request.get('/api/data')).json();
const current = async (request: APIRequestContext, id: string) =>
  (await snapshot(request)).events.find((e) => e.id === id)!;
const body = (name: string, initialPaid = 0) => ({
  name: 'בדיקת מערכת ' + name + ' ' + Date.now(),
  date: today(),
  eventTypeId: 'nofer-wedding-half-day',
  price: 300000,
  initialPaid,
  requestId: crypto.randomUUID(),
});
const editBody = (event: BusinessEvent) => ({
  name: event.client.name,
  phone: event.client.phone,
  date: event.date.slice(0, 10),
  eventTypeId: event.eventTypeId,
  price: event.price,
  version: event.version,
  requestId: crypto.randomUUID(),
});

test('edit payment rows and price atomically; projections reflect corrections and invalid edits roll back', async ({
  page,
  request,
}) => {
  const created = await request.post('/api/events', { data: body('תיקון', 100000) });
  expect(created.status()).toBe(201);
  const id = (await created.json()).id;
  expect(
    (
      await request.post(`/api/events/${id}/payments`, {
        data: { amount: 50000, date: today(), method: 'BIT', requestId: crypto.randomUUID() },
      })
    ).status(),
  ).toBe(201);
  let event = await current(request, id);
  const original = event.payments;
  await page.goto(`/events/${id}/edit`);
  await page.getByLabel('סכום תשלום 1').fill('400');
  await page.getByLabel('תאריך תשלום 1').fill('2026-10-01');
  await page.getByLabel('אמצעי תשלום 1').selectOption('CASH');
  await page.getByLabel('הערה לתשלום 1').fill('תיקון רישום');
  await page.getByLabel('מחיר שסוכם').fill('1450');
  await expect(page.getByLabel('כבר שולם')).toHaveValue('1400.00');
  await expect(page.locator('[aria-live="polite"]')).toContainText(money(5000));
  await page.getByRole('button', { name: 'שמירת שינויים' }).click();
  await expect(page).toHaveURL(`/events/${id}`);
  event = await current(request, id);
  expect(totals(event)).toEqual({ paid: 140000, remaining: 5000, state: 'PARTIAL' });
  expect(event.payments.map((p) => p.id).sort()).toEqual(original.map((p) => p.id).sort());
  const changed = event.payments.find((p) => p.id === original[0].id)!;
  expect(changed).toMatchObject({
    amount: 40000,
    method: 'CASH',
    note: 'תיקון רישום',
    createdAt: original[0].createdAt,
  });
  expect(changed.date.slice(0, 10)).toBe('2026-10-01');
  expect(event.payments.find((p) => p.id === original[1].id)).toEqual(original[1]);
  for (const amount of [-1, 170001]) {
    const invalid = await request.put(`/api/events/${id}`, {
      data: {
        ...editBody(event),
        paymentChanges: [{ id: changed.id, amount, date: today(), method: 'CASH' }],
      },
    });
    expect(invalid.status()).toBe(400);
    expect(await current(request, id)).toEqual(event);
  }
  const foreign = await request.put(`/api/events/${id}`, {
    data: { ...editBody(event), paymentChanges: [{ id: 'other-event-payment', remove: true }] },
  });
  expect(foreign.status()).toBe(400);
  await page.goto('/');
  const s = summarize((await snapshot(request)).events, today().slice(0, 7));
  await expect(page.locator('.stat').filter({ hasText: 'כבר שולם' })).toContainText(money(s.paid));
  await expect(page.locator('.stat').filter({ hasText: 'נותר לגבייה' })).toContainText(
    money(s.outstanding),
  );
  await page.goto('/outstanding');
  await expect(page.getByText(event.client.name, { exact: true })).toBeVisible();
  await page.goto('/summary');
  await expect(page.locator('.stat').filter({ hasText: 'כבר נגבה' })).toContainText(money(s.paid));
  const csv = await (
    await request.get('/api/export?query=' + encodeURIComponent(event.client.name))
  ).text();
  expect(csv).toContain('"1450","1400","50","שולם חלקית"');
  await page.goto(`/events/${id}/edit`);
  // The corrected payment moved after the other row because its date changed.
  await page.getByRole('button', { name: 'מחיקת תשלום', exact: true }).last().click();
  await page.getByRole('button', { name: 'הוספת תשלום', exact: true }).click();
  await page.getByLabel('סכום תשלום 3').fill('100');
  await page.getByRole('button', { name: 'שמירת שינויים' }).click();
  await expect(page).toHaveURL(`/events/${id}`);
  event = await current(request, id);
  expect(event.payments).toHaveLength(2);
  expect(event.payments.some((p) => p.id === changed.id)).toBe(false);
  expect(totals(event)).toEqual({ paid: 110000, remaining: 35000, state: 'PARTIAL' });
  await page.goto(`/events/${id}/edit`);
  await page.getByLabel('סכום תשלום 1').fill('-1');
  await page.getByRole('button', { name: 'שמירת שינויים' }).click();
  await expect(page).toHaveURL(`/events/${id}/edit`);
  expect(
    await page
      .getByLabel('סכום תשלום 1')
      .evaluate((i: HTMLInputElement) => i.validity.rangeUnderflow),
  ).toBe(true);
  expect(await current(request, id)).toEqual(event);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.reload();
  for (let i = 0; i < 2; i++)
    await page.getByRole('button', { name: 'מחיקת תשלום', exact: true }).first().click();
  await expect(page.getByLabel('כבר שולם')).toHaveValue('0.00');
  await page.getByRole('button', { name: 'שמירת שינויים' }).click();
  await expect(page).toHaveURL(`/events/${id}`);
  event = await current(request, id);
  expect(event.payments).toHaveLength(0);
  expect(totals(event)).toEqual({ paid: 0, remaining: 145000, state: 'UNPAID' });
});

test('completion settles unpaid and partial events, preserves history and never duplicates full payment', async ({
  page,
  request,
}) => {
  for (const paid of [0, 100000, 300000]) {
    const create = await request.post('/api/events', { data: body('השלמה ' + paid, paid) });
    expect(create.status()).toBe(201);
    const id = (await create.json()).id;
    let event = await current(request, id);
    const old = event.payments;
    await page.goto(`/events/${id}`);
    await page.getByRole('button', { name: 'סימון כהושלם' }).click();
    await expect(page.locator('.badge.completed')).toBeVisible();
    await expect(page.locator('.badge.paid')).toContainText('שולם במלואו');
    event = await current(request, id);
    expect(totals(event)).toEqual({ paid: 300000, remaining: 0, state: 'PAID' });
    expect(event.payments).toHaveLength(old.length + (paid < 300000 ? 1 : 0));
    for (const p of old) expect(event.payments.find((x) => x.id === p.id)).toEqual(p);
    if (paid < 300000) {
      const settlement = event.payments.find((p) => !old.some((x) => x.id === p.id))!;
      expect(settlement).toMatchObject({
        amount: 300000 - paid,
        method: 'OTHER',
        note: 'השלמת יתרה בעת סימון כהושלם',
      });
      expect(settlement.date.slice(0, 10)).toBe(today());
    }
    const retry = { version: event.version, requestId: crypto.randomUUID() };
    for (let i = 0; i < 2; i++)
      expect((await request.post(`/api/events/${id}/complete`, { data: retry })).status()).toBe(
        200,
      );
    expect(await current(request, id)).toEqual(event);
    await page.goto('/events');
    await page.getByLabel('חיפוש אירועים').fill(event.client.name);
    await expect(page.locator('.event-list .badge.paid')).toHaveText('שולם במלואו');
    expect(await (await request.get('/api/export?kind=outstanding')).text()).not.toContain(
      event.client.name,
    );
    // Raising the price must reveal the actual balance even when internal status is completed.
    expect(
      (
        await request.put(`/api/events/${id}`, { data: { ...editBody(event), price: 350000 } })
      ).status(),
    ).toBe(200);
    await page.goto(`/events/${id}`);
    await expect(page.locator('.badge.partial')).toBeVisible();
    await page.getByRole('button', { name: 'סימון כהושלם' }).click();
    await expect(page.locator('.badge.paid')).toBeVisible();
    event = await current(request, id);
    expect(totals(event).paid).toBe(350000);
    expect(event.payments).toHaveLength(old.length + (paid < 300000 ? 2 : 1));
  }
  const s = summarize((await snapshot(request)).events, today().slice(0, 7));
  await page.goto('/');
  await expect(page.locator('.stat').filter({ hasText: 'כבר שולם' })).toContainText(money(s.paid));
  await expect(page.locator('.stat').filter({ hasText: 'נותר לגבייה' })).toContainText(
    money(s.outstanding),
  );
});

test('completion API retries, stale versions and cancellation are safe; legacy wedding remains editable', async ({
  page,
  request,
}) => {
  const create = await request.post('/api/events', { data: body('בקשת השלמה', 100000) });
  expect(create.status()).toBe(201);
  const id = (await create.json()).id;
  let event = await current(request, id);
  expect(
    (
      await request.post(`/api/events/${id}/complete`, {
        data: { version: event.version + 1, requestId: crypto.randomUUID() },
      })
    ).status(),
  ).toBe(409);
  const completion = { version: event.version, requestId: crypto.randomUUID() };
  for (let i = 0; i < 2; i++)
    expect((await request.post(`/api/events/${id}/complete`, { data: completion })).status()).toBe(
      200,
    );
  event = await current(request, id);
  expect(event.payments).toHaveLength(2);
  expect(
    (
      await request.put(`/api/events/${id}`, { data: { ...editBody(event), status: 'CANCELLED' } })
    ).status(),
  ).toBe(200);
  event = await current(request, id);
  expect(
    (
      await request.post(`/api/events/${id}/complete`, {
        data: { version: event.version, requestId: crypto.randomUUID() },
      })
    ).status(),
  ).toBe(400);
  // Only local guarded test data: historical type cannot be selected through the create API.
  expect(
    (
      await request.put(`/api/events/${id}`, {
        data: {
          ...editBody(event),
          price: 400000,
          paymentChanges: [
            { amount: 100, date: today(), method: 'CASH', requestId: crypto.randomUUID() },
          ],
        },
      })
    ).status(),
  ).toBe(400);
  await page.goto(`/events/${id}/edit`);
  await expect(page.getByRole('button', { name: 'הוספת תשלום', exact: true })).toBeDisabled();
  const historical = await db.event.create({
    data: {
      client: { create: { name: 'בדיקת מערכת חתונה היסטורית ' + Date.now() } },
      eventType: { connect: { id: 'wedding' } },
      date: new Date(today() + 'T00:00:00Z'),
      price: 100000,
      requestId: crypto.randomUUID(),
    },
  });
  await page.goto(`/events/${historical.id}/edit`);
  await expect(page.getByLabel('מחיר שסוכם')).toBeVisible();
  expect(await page.locator('select[name="eventTypeId"] option').allTextContents()).not.toContain(
    'חתונה',
  );
  expect(
    await page.locator('select[name="eventTypeId"] option:not([disabled])').allTextContents(),
  ).toEqual(['חתונה חצי יום', 'חתונה יום שלם', 'חינה', 'הפרשת חלה', 'ברית', 'בר מצווה', 'צילומים']);
  await page.getByLabel('מחיר שסוכם').fill('1500');
  await page.getByRole('button', { name: 'שמירת שינויים' }).click();
  await expect(page).toHaveURL(`/events/${historical.id}`);
  expect((await current(request, historical.id)).eventType.name).toBe('חתונה');
  await page.goto('/events');
  await page.getByLabel('חיפוש אירועים').fill('חתונה היסטורית');
  await expect(page.locator('.event-list .event-card')).toHaveCount(1);
  expect(
    (
      await request.post('/api/events', { data: { ...body('סוג ישן'), eventTypeId: 'wedding' } })
    ).status(),
  ).toBe(400);
});
