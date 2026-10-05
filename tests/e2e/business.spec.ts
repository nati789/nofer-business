import { test, expect } from '@playwright/test';
import type { BusinessEvent, Snapshot } from '../../src/lib/domain';
import { cleanTestData, closeTestDatabase } from '../cleanup';

test.beforeEach(async () => {
  await cleanTestData();
});
test.afterEach(async () => {
  await cleanTestData();
});
test.afterAll(async () => {
  await closeTestDatabase();
});
test('events, client recognition, payments, summaries, exports and deletion', async ({
  page,
  request,
}) => {
  const name = 'בדיקת מערכת ' + Date.now();
  const phone = '059' + String(Date.now()).slice(-7);
  let id = '';
  let copyId = '';
  await page.goto('/events/new');
  await page.getByLabel('טלפון', { exact: false }).fill(phone);
  await page.getByLabel('שם הלקוח').fill(name);
  await page.getByLabel('תאריך האירוע').fill('2026-10-18');
  await page.getByLabel('סוג אירוע').selectOption('birthday');
  await page.getByLabel('מחיר שסוכם').fill('2000');
  await page.getByLabel('כבר שולם').fill('500');
  await page.getByLabel('מיקום', { exact: true }).fill('תל אביב');
  await page.getByRole('button', { name: 'שמירת האירוע', exact: true }).click();
  await expect(page).toHaveURL(/\/events\/c[a-z0-9]+$/);
  id = page.url().split('/').pop()!;
  await expect(page.locator('.stat').filter({ hasText: 'יתרה לתשלום' })).toContainText('1,500');
  try {
    for (const amount of ['1000', '500']) {
      await page.getByRole('button', { name: 'הוספת תשלום' }).click();
      await page.getByLabel('סכום התשלום').fill(amount);
      await page.getByRole('button', { name: 'שמירת התשלום', exact: true }).click();
      await expect(page.locator('dialog')).toHaveCount(0);
    }
    await expect(page.locator('.payment-row')).toHaveCount(3);
    await expect(page.locator('.badge.paid')).toBeVisible();
    await page.getByRole('link', { name: 'עריכת האירוע' }).click();
    await page.getByLabel('מחיר שסוכם').fill('2100');
    await page.getByLabel('הערות', { exact: true }).fill('בדיקת סינון מיוחדת');
    await page.getByRole('button', { name: 'שמירת שינויים' }).click();
    await expect(page.locator('.stat').filter({ hasText: 'יתרה לתשלום' })).toContainText('100');
    await page.getByRole('link', { name: 'העתקת אירוע' }).click();
    await page.getByLabel('תאריך האירוע').fill('2026-11-18');
    await page.getByRole('button', { name: 'שמירת האירוע', exact: true }).click();
    await expect(page).toHaveURL(/\/events\/c[a-z0-9]+$/);
    copyId = page.url().split('/').pop()!;
    const snapshot = (await (await request.get('/api/data')).json()) as Snapshot;
    const e = snapshot.events.find((x) => x.id === id)!;
    const copied = snapshot.events.find((x) => x.id === copyId)!;
    expect(copied.clientId).toBe(e.clientId);
    expect(copied.payments).toHaveLength(0);
    expect(e.payments.reduce((s, p) => s + p.amount, 0)).toBe(200000);
    await page.goto('/events');
    await page.getByLabel('חיפוש אירועים').fill(name);
    await page.getByRole('button', { name: 'סינון', exact: true }).click();
    await page.getByLabel('חודש', { exact: true }).fill('2026-10');
    await page.getByRole('combobox', { name: 'סוג אירוע', exact: true }).selectOption('birthday');
    await page
      .getByRole('combobox', { name: 'מצב תשלום', exact: true })
      .selectOption('OUTSTANDING');
    await expect(page.locator('.event-list .event-card')).toHaveCount(1);
    const csv = await request.get('/api/export?month=2026-10');
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toContain(name);
    expect(await csv.text()).toContain('2100');
    await page.goto('/summary');
    await page.getByLabel('בחירת חודש').fill('2026-10');
    await expect(page.locator('h1')).toHaveText('החודש שלך במספרים');
    await expect(page.locator('.comparison')).toBeVisible();
    await page.goto('/events/' + id);
    await page.getByRole('button', { name: 'סימון כהושלם' }).click();
    await expect(page.locator('.badge.completed')).toBeVisible();
    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'מחיקת האירוע' }).click();
    await expect(page).toHaveURL(/\/events$/);
    expect(
      ((await (await request.get('/api/data')).json()) as Snapshot).events.some((e) => e.id === id),
    ).toBe(false);
    id = '';
  } finally {
    const snap = (await (await request.get('/api/data')).json()) as Snapshot;
    for (const e of snap.events.filter((x) => x.client.name === name)) {
      await request.delete('/api/events/' + e.id, {
        data: { confirm: true, version: e.version },
      });
    }
  }
});
test('API validates duplicate, overpayment, stale edit, idempotency and cancellation', async ({
  request,
}) => {
  const name = 'בדיקת הגנות ' + Date.now();
  const phone = '058' + String(Date.now()).slice(-7);
  const body = {
    name,
    phone,
    date: '2026-10-20',
    eventTypeId: 'birthday',
    price: 200000,
    initialPaid: 50000,
    requestId: crypto.randomUUID(),
  };
  const create = await request.post('/api/events', { data: body });
  expect(create.status()).toBe(201);
  const event = await create.json();
  try {
    const retry = await request.post('/api/events', { data: body });
    expect((await retry.json()).id).toBe(event.id);
    const duplicate = await request.post('/api/events', {
      data: { ...body, requestId: crypto.randomUUID() },
    });
    expect(duplicate.status()).toBe(409);
    const excessive = await request.post('/api/events/' + event.id + '/payments', {
      data: { amount: 150001, date: '2026-10-20', method: 'BIT', requestId: crypto.randomUUID() },
    });
    expect(excessive.status()).toBe(400);
    const payment = {
      amount: 100000,
      date: '2026-10-20',
      method: 'BIT',
      requestId: crypto.randomUUID(),
    };
    expect(
      (await request.post('/api/events/' + event.id + '/payments', { data: payment })).status(),
    ).toBe(201);
    expect(
      (await request.post('/api/events/' + event.id + '/payments', { data: payment })).status(),
    ).toBe(201);
    const stale = await request.put('/api/events/' + event.id, {
      data: { ...body, version: 1, price: 300000 },
    });
    expect(stale.status()).toBe(409);
    const current = ((await (await request.get('/api/data')).json()) as Snapshot).events.find(
      (e) => e.id === event.id,
    )!;
    expect(current.payments).toHaveLength(2);
    expect(
      (
        await request.put('/api/events/' + event.id, {
          data: { ...body, initialPaid: 0, version: current.version, status: 'CANCELLED' },
        })
      ).status(),
    ).toBe(200);
    const exported = await (await request.get('/api/export?kind=outstanding')).text();
    expect(exported).not.toContain(name);
    expect(
      (
        await request.post('/api/events/' + event.id + '/payments', {
          data: { ...payment, requestId: crypto.randomUUID() },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await request.post('/api/events', {
          headers: { origin: 'https://other.example' },
          data: { ...body, requestId: crypto.randomUUID() },
        })
      ).status(),
    ).toBe(403);
  } finally {
    const e = ((await (await request.get('/api/data')).json()) as Snapshot).events.find(
      (e: BusinessEvent) => e.id === event.id,
    );
    if (e)
      await request.delete('/api/events/' + event.id, {
        data: { confirm: true, version: e.version },
      });
  }
});
test('mobile layouts and routes have no overflow or browser errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const width of [375, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of [
      '/',
      '/events',
      '/events/new',
      '/calendar',
      '/clients',
      '/outstanding',
      '/summary',
      '/reports',
      '/more',
      '/settings',
      '/export',
    ]) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        `${path} at ${width}`,
      ).toBe(true);
      if (width < 700) await expect(page.locator('.bottom-nav')).toBeVisible();
    }
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    await page.screenshot({ path: `artifacts/dashboard-${width}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});
