import { db } from '@/lib/db';
import { guard, fail, AppError } from '@/lib/api';
import { saveEvent } from '@/lib/events-service';
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, ctx: Context) {
  try {
    await guard(request);
    return Response.json(await saveEvent(await request.json(), (await ctx.params).id));
  } catch (e) {
    return fail(e);
  }
}
export async function DELETE(request: Request, ctx: Context) {
  try {
    await guard(request);
    const body = await request.json();
    if (body.confirm !== true || !Number.isInteger(body.version))
      throw new AppError('יש לאשר מחיקה');
    await db.event.delete({ where: { id: (await ctx.params).id, version: body.version } });
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
