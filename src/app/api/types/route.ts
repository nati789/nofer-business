import { db } from '@/lib/db';
import { guard, fail } from '@/lib/api';
import { z } from 'zod';
export async function POST(request: Request) {
  try {
    await guard(request);
    const data = z
      .object({ name: z.string().trim().min(1, 'יש להזין שם').max(80) })
      .parse(await request.json());
    return Response.json(await db.eventType.create({ data }), { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
export async function PATCH(request: Request) {
  try {
    await guard(request);
    const { id, ...data } = z
      .object({ id: z.string(), name: z.string().trim().min(1).max(80), active: z.boolean() })
      .parse(await request.json());
    return Response.json(await db.eventType.update({ where: { id }, data }));
  } catch (e) {
    return fail(e);
  }
}
