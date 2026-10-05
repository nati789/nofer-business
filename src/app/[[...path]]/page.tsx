import { authenticated, authConfigured } from '@/lib/auth';
import BusinessApp from '@/components/business-app';
import Login from '@/components/login';
export const dynamic = 'force-dynamic';
export default async function Page() {
  if (!(await authenticated())) return <Login configured={authConfigured()} />;
  return <BusinessApp />;
}
