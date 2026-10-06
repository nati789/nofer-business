import { guard, fail } from '@/lib/api';
import { completeEvent } from '@/lib/events-service';

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await guard(request);
    return Response.json(await completeEvent((await ctx.params).id, await request.json()));
  } catch (error) {
    return fail(error);
  }
}
