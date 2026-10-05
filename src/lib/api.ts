import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { authenticated } from './auth';
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function guard(request: Request) {
  if (!(await authenticated())) throw new AppError('נדרשת כניסה למערכת', 401);
  if (!['GET', 'HEAD'].includes(request.method)) {
    if (!sameOrigin(request)) throw new AppError('הבקשה לא אושרה', 403);
  }
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    // Next.js can normalize request.url to localhost behind its server/proxy.
    // Host is the actual browser-facing authority, including its port.
    return (
      ['http:', 'https:'].includes(parsed.protocol) &&
      parsed.host === (request.headers.get('host') || new URL(request.url).host)
    );
  } catch {
    return false;
  }
}
export function fail(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: error.issues[0]?.message || 'נתונים לא תקינים' },
      { status: 400 },
    );
  if (error instanceof AppError)
    return NextResponse.json({ error: error.message }, { status: error.status });
  const code = (error as { code?: string })?.code;
  if (code === 'P2002')
    return NextResponse.json({ error: 'הרשומה כבר קיימת. יש לרענן ולנסות שוב.' }, { status: 409 });
  if (code === 'P2025') return NextResponse.json({ error: 'הרשומה לא נמצאה' }, { status: 404 });
  if (code === 'P2034')
    return NextResponse.json({ error: 'בוצע עדכון מקביל. יש לנסות שוב.' }, { status: 409 });
  console.error(
    'Database operation failed',
    code || (error instanceof Error ? error.name : 'unknown'),
  );
  return NextResponse.json(
    { error: 'לא ניתן להשלים את הפעולה. בדקו את החיבור ונסו שוב.' },
    { status: 500 },
  );
}
