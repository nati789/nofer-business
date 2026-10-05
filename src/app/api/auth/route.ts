import { cookies } from 'next/headers';
import { newSession, validPassword } from '@/lib/auth';
import { sameOrigin } from '@/lib/api';
const attempts = new Map<string, { count: number; until: number }>();
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'הבקשה לא אושרה' }, { status: 403 });
  const key = 'business-login';
  const now = Date.now();
  const record = attempts.get(key);
  if (record && record.until > now && record.count >= 15)
    return Response.json({ error: 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.' }, { status: 429 });
  const { password } = await request.json();
  if (typeof password !== 'string' || !validPassword(password)) {
    attempts.set(key, {
      count: record && record.until > now ? record.count + 1 : 1,
      until: record && record.until > now ? record.until : now + 300000,
    });
    return Response.json({ error: 'הסיסמה שגויה או שהגישה טרם הוגדרה' }, { status: 401 });
  }
  attempts.delete(key);
  (await cookies()).set('nofer-session', newSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 86400,
  });
  return Response.json({ ok: true });
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'הבקשה לא אושרה' }, { status: 403 });
  (await cookies()).delete('nofer-session');
  return Response.json({ ok: true });
}
