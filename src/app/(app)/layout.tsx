import { redirect } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import SeasonalBackground from '@/components/background/SeasonalBackground';
import CelebrationOverlay from '@/components/celebration/CelebrationOverlay';
import PageTransition from '@/components/layout/PageTransition';
import { getSessionUser } from '@/lib/auth';
import { listGoals } from './goals/actions';
import { getYearlyGoalProgress } from '@/lib/progress';

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

  // The sidebar's "N년 목표" mini progress block. listGoals() is sorted
  // year-desc, so [0] is the most current top-level goal.
  const goals = await listGoals();
  const topGoal = goals[0]
    ? {
        title: goals[0].title,
        year: goals[0].year,
        progress: await getYearlyGoalProgress(goals[0]._id),
      }
    : null;

  return (
    <div className="flex min-h-full">
      <SeasonalBackground />
      <CelebrationOverlay />
      <Sidebar login={user.login} avatarUrl={user.avatarUrl} topGoal={topGoal} />
      <div className="min-w-0 flex-1">
        {/* One shared width for every screen so the content column never jumps
            between menus. */}
        <main className="mx-auto max-w-5xl p-6 sm:p-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
