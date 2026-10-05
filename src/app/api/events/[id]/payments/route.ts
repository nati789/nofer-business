import { guard, fail } from '@/lib/api';
import { addPayment } from '@/lib/events-service';
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await guard(request);
    return Response.json(await addPayment((await ctx.params).id, await request.json()), {
      status: 201,
    });
  } catch (e) {
    return fail(e);
  }
}
