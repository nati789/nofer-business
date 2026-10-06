import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('migration preserves historical locations, types, clients and payments', async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile('prisma/migrations/202610050001_init/migration.sql', 'utf8'));
    await db.exec(`
      INSERT INTO "Client" (id,name,phone,"updatedAt") VALUES ('client','לקוח','0501234567',now());
      INSERT INTO "Event" (id,"clientId","eventTypeId",date,location,price,"updatedAt","requestId")
      VALUES ('event','client','birthday','2026-10-18','תל אביב, אולם ישן',200000,now(),'request');
      INSERT INTO "Payment" (id,"eventId",amount,date,method,"requestId")
      VALUES ('payment','event',50000,'2026-10-18','BIT','payment-request');
    `);
    await db.exec(
      await readFile('prisma/migrations/202610060001_event_details_theme/migration.sql', 'utf8'),
    );
    const event = await db.query<{
      location: string;
      venue: string;
      city: string;
      eventTypeId: string;
      price: number;
    }>('SELECT location,venue,city,"eventTypeId",price FROM "Event"');
    assert.deepEqual(event.rows, [
      {
        location: 'תל אביב, אולם ישן',
        venue: 'תל אביב, אולם ישן',
        city: '',
        eventTypeId: 'birthday',
        price: 200000,
      },
    ]);
    assert.deepEqual((await db.query('SELECT amount FROM "Payment"')).rows, [{ amount: 50000 }]);
    assert.deepEqual((await db.query('SELECT phone FROM "Client"')).rows, [
      { phone: '0501234567' },
    ]);
    assert.deepEqual(
      (await db.query('SELECT active FROM "EventType" WHERE id=\'birthday\'')).rows,
      [{ active: false }],
    );
    assert.deepEqual((await db.query('SELECT id FROM "EventType" WHERE name=\'חתונה\'')).rows, [
      { id: 'wedding' },
    ]);
    await db.exec(
      await readFile(
        'prisma/migrations/202610060002_preparation_place_bar_mitzvah/migration.sql',
        'utf8',
      ),
    );
    assert.deepEqual(
      (await db.query('SELECT "preparationPlace",status,price,"eventTypeId" FROM "Event"')).rows,
      [{ preparationPlace: null, status: 'NEW', price: 200000, eventTypeId: 'birthday' }],
    );
    assert.deepEqual((await db.query('SELECT amount FROM "Payment"')).rows, [{ amount: 50000 }]);
    assert.deepEqual(
      (await db.query('SELECT name,active FROM "EventType" WHERE name=\'בר מצווה\'')).rows,
      [{ name: 'בר מצווה', active: true }],
    );
    await db.exec(
      `INSERT INTO "Client" (id,name,phone,"updatedAt") VALUES ('blank-one','א',NULL,now()),('blank-two','ב',NULL,now());`,
    );
    assert.equal((await db.query('SELECT id FROM "Client" WHERE phone IS NULL')).rows.length, 2);
    await db.exec(
      `INSERT INTO "Event" (id,"clientId","eventTypeId",date,price,"updatedAt","requestId") VALUES ('legacy-wedding','client','wedding','2026-10-21',10000,now(),'legacy-wedding');`,
    );
    await db.exec(
      await readFile('prisma/migrations/202610060003_wedding_types/migration.sql', 'utf8'),
    );
    assert.deepEqual(
      (await db.query('SELECT id,name,active FROM "EventType" WHERE id=\'wedding\'')).rows,
      [{ id: 'wedding', name: 'חתונה', active: false }],
    );
    assert.deepEqual(
      (await db.query('SELECT "eventTypeId",price FROM "Event" WHERE id=\'legacy-wedding\'')).rows,
      [{ eventTypeId: 'wedding', price: 10000 }],
    );
    assert.deepEqual((await db.query('SELECT amount FROM "Payment"')).rows, [{ amount: 50000 }]);
    assert.deepEqual(
      (
        await db.query<{ name: string }>(
          'SELECT name FROM "EventType" WHERE active=true ORDER BY name',
        )
      ).rows
        .map((r) => r.name)
        .sort(),
      ['חתונה חצי יום', 'חתונה יום שלם', 'חינה', 'הפרשת חלה', 'ברית', 'בר מצווה', 'צילומים'].sort(),
    );
    await assert.rejects(
      db.exec(
        `INSERT INTO "Event" (id,"clientId","eventTypeId",date,price,"updatedAt","requestId") VALUES ('no-date','client','wedding',NULL,0,now(),'no-date');`,
      ),
    );
  } finally {
    await db.close();
  }
});
