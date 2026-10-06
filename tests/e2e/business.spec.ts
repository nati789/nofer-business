import { test, expect } from '@playwright/test';
import { today, shiftMonth, money, type BusinessEvent, type Snapshot } from '../../src/lib/domain';
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
  await page.getByLabel('תאריך האירוע').fill('18/10/2026');
  await page.getByLabel('סוג אירוע').selectOption('nofer-wedding-half-day');
  await page.getByLabel('מחיר שסוכם').fill('2000');
  await page.getByLabel('כבר שולם').fill('500');
  await page.getByLabel('עיר', { exact: true }).fill('תל אביב');
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
    await page.getByLabel('תאריך האירוע').fill('18/11/2026');
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
    await page
      .getByRole('combobox', { name: 'סוג אירוע', exact: true })
      .selectOption('nofer-wedding-half-day');
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
    eventTypeId: 'nofer-wedding-half-day',
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
  test.setTimeout(120000);
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
      // Let route prefetches finish before the next full navigation in WebKit.
      await page.waitForLoadState('networkidle');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        `${path} at ${width}`,
      ).toBe(true);
      if (width < 700) await expect(page.locator('.bottom-nav')).toBeVisible();
    }
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `artifacts/dashboard-${width}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});

test('optional phone, both date inputs, locations, dashboard and persistent themes', async ({
  page,
  request,
}) => {
  const name = 'בדיקת מערכת ללא טלפון ' + Date.now();
  await page.goto('/events/new');
  await page.getByLabel('שם הלקוח').fill(name);
  await page.getByLabel('מחיר שסוכם').fill('1000');
  await page.getByLabel('סוג אירוע').selectOption({ label: 'חינה' });
  expect(
    await page.locator('select[name="eventTypeId"] option:not([disabled])').allTextContents(),
  ).toEqual(['חתונה חצי יום', 'חתונה יום שלם', 'חינה', 'הפרשת חלה', 'ברית', 'בר מצווה', 'צילומים']);
  await page.getByLabel('עיר', { exact: true }).fill('חיפה');
  await page.getByLabel('שם האולם', { exact: true }).fill('אולם הכרמל');
  await page.getByLabel('תאריך האירוע').fill('');
  await page.getByRole('button', { name: 'שמירת האירוע', exact: true }).click();
  await expect(page).toHaveURL('/events/new');
  expect(
    await page
      .getByLabel('תאריך האירוע')
      .evaluate((input: HTMLInputElement) => input.validity.valueMissing),
  ).toBe(true);
  await page.getByLabel('תאריך האירוע').fill('31/02/2027');
  await page.getByRole('button', { name: 'שמירת האירוע', exact: true }).click();
  await expect(page.locator('.form-card [role="alert"]')).toContainText('תאריך תקין');
  await page.getByLabel('בחירת תאריך ביומן').fill('2027-02-20');
  await expect(page.getByLabel('תאריך האירוע')).toHaveValue('20/02/2027');
  await page.getByLabel('תאריך האירוע').fill('');
  await page.getByLabel('תאריך האירוע').pressSequentially('21022027');
  await expect(page.getByLabel('תאריך האירוע')).toHaveValue('21/02/2027');
  await expect(page.getByLabel('בחירת תאריך ביומן')).toHaveValue('2027-02-21');
  await page.getByRole('button', { name: 'שמירת האירוע', exact: true }).click();
  await expect(page).toHaveURL(/\/events\/c[a-z0-9]+$/);
  const id = page.url().split('/').pop()!;
  const snapshot = (await (await request.get('/api/data')).json()) as Snapshot;
  const event = snapshot.events.find((e) => e.id === id)!;
  expect(event.client.phone).toBeNull();
  expect(event.city).toBe('חיפה');
  expect(event.venue).toBe('אולם הכרמל');
  expect(
    (
      await request.post('/api/events', {
        data: { name, eventTypeId: event.eventTypeId, price: 0, requestId: crypto.randomUUID() },
      })
    ).status(),
  ).toBe(400);
  await page.getByRole('link', { name: 'עריכת האירוע' }).click();
  await page.getByLabel('שם האולם', { exact: true }).fill('אולם מעודכן');
  await page.getByRole('button', { name: 'שמירת שינויים' }).click();
  await expect(page).toHaveURL('/events/' + id);
  await expect(page.locator('.detail-grid')).toContainText('אולם מעודכן');
  await page.goto('/');
  const upcoming = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'בקרוב ביומן' }) });
  await expect(upcoming.locator('.event-card[href="/events/' + id + '"]')).toHaveCount(
    event.date.startsWith(today().slice(0, 7)) ? 1 : 0,
  );
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--soft').trim(),
    ),
  ).toBe('#f9e7ef');
  await page.goto('/settings');
  await page.getByRole('button', { name: 'סגול', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'סגול', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'ורוד בהיר', exact: true }).click();
});

test('event forms hide status, retain internal status, place name on right, and save preparation place', async ({
  page,
  request,
}) => {
  await page.goto('/events/new');
  await expect(page.locator('[name="status"]')).toHaveCount(0);
  await expect(page.getByLabel('מצב האירוע')).toHaveCount(0);
  const clientName = page.getByLabel('שם הלקוח');
  const phone = page.getByLabel('מספר טלפון');
  expect(await phone.evaluate((input: HTMLInputElement) => input.required)).toBe(false);
  const nameBox = (await clientName.boundingBox())!;
  const phoneBox = (await phone.boundingBox())!;
  if (page.viewportSize()!.width > 700) {
    expect(nameBox.x).toBeGreaterThan(phoneBox.x);
    expect(Math.abs(nameBox.y - phoneBox.y)).toBeLessThan(2);
  } else {
    expect(nameBox.y).toBeLessThan(phoneBox.y);
  }
  await clientName.fill('בדיקת מערכת התארגנות ' + Date.now());
  await page.getByLabel('סוג אירוע').selectOption({ label: 'בר מצווה' });
  await page.getByLabel('מקום התארגנות').fill('מלון להתארגנות');
  await page.getByLabel('מחיר שסוכם').fill('1000');
  await page.getByRole('button', { name: 'שמירת האירוע', exact: true }).click();
  await expect(page).toHaveURL(/\/events\/c[a-z0-9]+$/);
  const id = page.url().split('/').pop()!;
  let snapshot = (await (await request.get('/api/data')).json()) as Snapshot;
  let event = snapshot.events.find((e) => e.id === id)!;
  const originalClientId = event.clientId;
  expect(event.status).toBe('NEW');
  expect(event.client.phone).toBeNull();
  expect(event.preparationPlace).toBe('מלון להתארגנות');
  await expect(page.locator('.detail-grid')).toContainText('מלון להתארגנות');
  await page.getByRole('button', { name: 'סימון כהושלם' }).click();
  await expect(page.locator('.badge.completed')).toBeVisible();
  await page.getByRole('link', { name: 'עריכת האירוע' }).click();
  await expect(page.locator('[name="status"]')).toHaveCount(0);
  await expect(page.getByLabel('מקום התארגנות')).toHaveValue('מלון להתארגנות');
  await page.getByLabel('מקום התארגנות').fill('בית להתארגנות');
  await page.getByRole('button', { name: 'שמירת שינויים' }).click();
  await expect(page).toHaveURL('/events/' + id);
  snapshot = (await (await request.get('/api/data')).json()) as Snapshot;
  event = snapshot.events.find((e) => e.id === id)!;
  expect(event.status).toBe('COMPLETED');
  expect(event.preparationPlace).toBe('בית להתארגנות');
  expect(event.clientId).toBe(originalClientId);
  await page.goto('/events');
  await page.getByLabel('חיפוש אירועים').fill('בית להתארגנות');
  await expect(page.locator('.event-list .event-card')).toHaveCount(1);
  await expect(page.locator('.event-list')).toContainText('בר מצווה');
  await expect(page.locator('.event-list')).toContainText('בית להתארגנות');
  await page.getByRole('button', { name: 'סינון', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'סוג אירוע', exact: true })
    .selectOption({ label: 'בר מצווה' });
  await expect(page.locator('.event-list .event-card')).toHaveCount(1);
  const exported = await request.get('/api/export?query=' + encodeURIComponent('בית להתארגנות'));
  expect(exported.status()).toBe(200);
  expect(await exported.text()).toContain('מקום התארגנות');
  expect(await exported.text()).toContain('בית להתארגנות');
  await page.goto('/reports');
  await expect(page.getByText('בר מצווה', { exact: true }).first()).toBeVisible();
  // Omitted new fields in older API callers must preserve the existing value/status.
  const edit = {
    name: event.client.name,
    phone: null,
    date: event.date.slice(0, 10),
    eventTypeId: event.eventTypeId,
    price: event.price,
    version: event.version,
    requestId: crypto.randomUUID(),
  };
  expect((await request.put('/api/events/' + id, { data: edit })).status()).toBe(200);
  event = ((await (await request.get('/api/data')).json()) as Snapshot).events.find(
    (e) => e.id === id,
  )!;
  expect(event.preparationPlace).toBe('בית להתארגנות');
  expect(event.status).toBe('COMPLETED');
  expect(
    (
      await request.put('/api/events/' + id, {
        data: { ...edit, version: event.version, preparationPlace: '' },
      })
    ).status(),
  ).toBe(200);
  event = ((await (await request.get('/api/data')).json()) as Snapshot).events.find(
    (e) => e.id === id,
  )!;
  expect(event.preparationPlace).toBeNull();
});

test('dashboard displays all current-month events sorted by date/time and no recent section', async ({
  browser,
  page,
  request,
}) => {
  const month = today().slice(0, 7);
  const snapshot = (await (await request.get('/api/data')).json()) as Snapshot;
  const type = snapshot.types.find((t) => t.name === 'בר מצווה')!;
  const prefix = 'בדיקת מערכת חודש ' + Date.now();
  const fixtures = [
    { day: '28', time: '18:00', suffix: 'אחרון', status: 'NEW' },
    { day: '02', time: '10:00', suffix: 'הושלם', status: 'COMPLETED' },
    { day: '12', time: '16:00', suffix: 'אחר הצהריים', status: 'NEW' },
    { day: '12', time: '08:00', suffix: 'בוקר', status: 'NEW' },
    { day: '01', time: '', suffix: 'ראשון', status: 'NEW' },
    { day: '20', time: '12:00', suffix: 'בוטל', status: 'CANCELLED' },
  ];
  for (const fixture of fixtures) {
    const response = await request.post('/api/events', {
      data: {
        name: prefix + ' ' + fixture.suffix,
        date: month + '-' + fixture.day,
        time: fixture.time,
        status: fixture.status,
        eventTypeId: type.id,
        price: 10000,
        city: 'חיפה',
        venue: 'אולם החודש',
        preparationPlace: 'מלון החודש',
        requestId: crypto.randomUUID(),
      },
    });
    expect(response.status()).toBe(201);
  }
  for (const offset of [-1, 1]) {
    expect(
      (
        await request.post('/api/events', {
          data: {
            name: prefix + ' מחוץ לחודש ' + offset,
            date: shiftMonth(month, offset) + '-01',
            eventTypeId: type.id,
            price: 10000,
            requestId: crypto.randomUUID(),
          },
        })
      ).status(),
    ).toBe(201);
  }
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'עדכונים אחרונים' })).toHaveCount(0);
  const section = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'בקרוב ביומן' }) });
  const current = ((await (await request.get('/api/data')).json()) as Snapshot).events.filter((e) =>
    e.date.startsWith(month),
  );
  await expect(section.locator('.event-card')).toHaveCount(current.length);
  await expect(page.locator('.stat').filter({ hasText: 'הכנסה מהאירועים' })).toContainText(
    money(current.filter((e) => e.status !== 'CANCELLED').reduce((sum, e) => sum + e.price, 0)),
  );
  expect(
    await section
      .locator('.event-card')
      .filter({ hasText: prefix })
      .locator('h3')
      .allTextContents(),
  ).toEqual(
    ['ראשון', 'הושלם', 'בוקר', 'אחר הצהריים', 'בוטל', 'אחרון'].map(
      (suffix) => prefix + ' ' + suffix,
    ),
  );
  await expect(section).toContainText('מלון החודש');
  await expect(section).toContainText('אולם החודש');
  await expect(section).toContainText('חיפה');
  await expect(section).not.toContainText('מחוץ לחודש');
  const title = (await page.getByRole('heading', { name: 'מה קורה בעסק שלך' }).boundingBox())!;
  expect((await section.boundingBox())!.y).toBeGreaterThan(title.y);
  await page.getByLabel('בחירת חודש').fill(shiftMonth(month, 1));
  await expect(section.locator('.event-card')).toHaveCount(current.length);
  // WebKit service workers bypass Playwright routing. Isolate only the mocked
  // empty-state check; the real-data checks above keep service workers enabled.
  const emptyContext = await browser.newContext({
    storageState: await page.context().storageState(),
    viewport: page.viewportSize()!,
    serviceWorkers: 'block',
  });
  try {
    const emptyPage = await emptyContext.newPage();
    await emptyPage.route('**/api/data', (route) =>
      route.fulfill({ json: { ...snapshot, events: [] } }),
    );
    await emptyPage.goto('/');
    const emptySection = emptyPage
      .locator('section')
      .filter({ has: emptyPage.getByRole('heading', { name: 'בקרוב ביומן' }) });
    await expect(emptySection.getByRole('heading', { name: 'אין אירועים החודש' })).toBeVisible();
    await expect(emptySection.locator('.event-card')).toHaveCount(0);
  } finally {
    await emptyContext.close();
  }
});
