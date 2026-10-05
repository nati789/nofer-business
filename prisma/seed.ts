import 'dotenv/config';
import { db } from '../src/lib/db';
try {
  for (const [id, name] of [
    ['birthday', 'יום הולדת'],
    ['wedding', 'חתונה'],
    ['private', 'אירוע פרטי'],
    ['business', 'אירוע עסקי'],
    ['photo', 'צילומים'],
    ['other', 'אחר'],
  ])
    await db.eventType.upsert({ where: { id }, update: {}, create: { id, name } });
  console.log('Default event types are ready. No sample clients or events were added.');
} finally {
  await db.$disconnect();
}
