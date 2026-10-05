import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { db } from '../src/lib/db';
try {
  const [clients, types, events, payments] = await db.$transaction(
    [db.client.findMany(), db.eventType.findMany(), db.event.findMany(), db.payment.findMany()],
    { isolationLevel: 'RepeatableRead' },
  );
  await mkdir('backups', { recursive: true });
  const file = `backups/nofer-${new Date().toISOString().replaceAll(':', '-')}.json`;
  await writeFile(
    file,
    JSON.stringify(
      { format: 1, createdAt: new Date().toISOString(), clients, types, events, payments },
      null,
      2,
    ),
    { flag: 'wx' },
  );
  console.log('Backup written:', file);
} finally {
  await db.$disconnect();
}
