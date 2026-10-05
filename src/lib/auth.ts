import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
export function authConfigured() {
  return !!process.env.APP_PASSWORD && !!process.env.SESSION_SECRET;
}
export function localAccess() {
  return process.env.NODE_ENV !== 'production' && !process.env.APP_PASSWORD;
}
function sign(value: string) {
  return createHmac('sha256', process.env.SESSION_SECRET || '')
    .update(value)
    .digest('hex');
}
export function validPassword(value: string) {
  const a = Buffer.from(sign(value)),
    b = Buffer.from(sign(process.env.APP_PASSWORD || ''));
  return authConfigured() && timingSafeEqual(a, b);
}
export function newSession() {
  const exp = String(Date.now() + 7 * 86400000);
  return exp + '.' + sign(exp);
}
export async function authenticated() {
  if (localAccess()) return true;
  if (!authConfigured()) return false;
  const token = (await cookies()).get('nofer-session')?.value || '';
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const a = Buffer.from(sig),
    b = Buffer.from(sign(exp));
  return a.length === b.length && timingSafeEqual(a, b);
}
