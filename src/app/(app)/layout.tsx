import { redirect } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Auth boundary for the whole app. `/login` and `/auth/*` sit outside this
 * route group, so every page under it is guaranteed a logged-in user.
 * src/proxy.ts already redirects when the session cookie is absent; this
 * also covers the case where the cookie is present but the session is no
 * longer valid server-side (expired, logged out elsewhere) — which Proxy
 * can't detect without a DB lookup.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-full">
      <Sidebar login={user.login} avatarUrl={user.avatarUrl} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
