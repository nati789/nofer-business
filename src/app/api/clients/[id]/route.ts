import { db } from '@/lib/db';
import { guard, fail } from '@/lib/api';
import { clientSchema } from '@/lib/validation';
export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await guard(request);
    return Response.json(
      await db.client.update({
        where: { id: (await ctx.params).id },
        data: clientSchema.parse(await request.json()),
      }),
    );
  } catch (e) {
    return fail(e);
  }
}
