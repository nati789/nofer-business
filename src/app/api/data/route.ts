import { db } from '@/lib/db';
import { guard, fail } from '@/lib/api';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    await guard(request);
    const { events, clients, types } = await db.$transaction(
      async (tx) => {
        const events = await tx.event.findMany({
          include: {
            client: true,
            eventType: true,
            payments: { orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] },
          },
          orderBy: [{ date: 'asc' }, { time: 'asc' }],
        });
        const clients = await tx.client.findMany({ orderBy: { updatedAt: 'desc' } });
        const types = await tx.eventType.findMany({ orderBy: { name: 'asc' } });
        return { events, clients, types };
      },
      { isolationLevel: 'RepeatableRead' },
    );
    return Response.json(
      { events, clients, types },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    return fail(e);
  }
}
