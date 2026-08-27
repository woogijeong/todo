import { getStatsHierarchy } from '@/lib/stats';
import StatsExplorer from '@/components/stats/StatsExplorer';
import { requirePageUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function StatsPage() {
  await requirePageUser();

  const months = await getStatsHierarchy();

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold text-ink">통계</h1>
      <StatsExplorer months={months} />
    </main>
  );
}
