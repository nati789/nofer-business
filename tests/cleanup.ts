import 'dotenv/config';
import { db } from '../src/lib/db';

export async function cleanTestData() {
  const url = new URL(process.env.DATABASE_URL || 'postgresql://localhost:54329/nofer');
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('Browser tests must only use the dedicated local development database.');
  }
  const where = {
    OR: [{ name: { startsWith: 'בדיקת מערכת ' } }, { name: { startsWith: 'בדיקת הגנות ' } }],
  };
  await db.$transaction(async (tx) => {
    await tx.event.deleteMany({ where: { client: where } });
    await tx.client.deleteMany({ where });
  });
}

export async function closeTestDatabase() {
  await db.$disconnect();
}
