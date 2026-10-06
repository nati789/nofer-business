import 'dotenv/config';
import { db } from '../src/lib/db';
import { eventTypeNames } from '../src/lib/domain';
try {
  const names = eventTypeNames;
  await db.$transaction(async (tx) => {
    await tx.eventType.updateMany({ where: { name: { notIn: names } }, data: { active: false } });
    for (const name of names)
      await tx.eventType.upsert({ where: { name }, update: { active: true }, create: { name } });
  });
  console.log('Default event types are ready. No sample clients or events were added.');
} finally {
  await db.$disconnect();
}
