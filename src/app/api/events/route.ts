import { guard, fail } from '@/lib/api';
import { saveEvent } from '@/lib/events-service';
export async function POST(request: Request) {
  try {
    await guard(request);
    return Response.json(await saveEvent(await request.json()), { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
