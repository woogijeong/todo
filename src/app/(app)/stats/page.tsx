import { getStatsHierarchy } from '@/lib/stats';
import StatsExplorer from '@/components/stats/StatsExplorer';
import { requirePageUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function StatsPage() {
  await requirePageUser();

  const months = await getStatsHierarchy();

  return (
    <main className="mx-auto max-w-3xl p-6 sm:p-8">
      <h1 className="text-[26px] font-bold tracking-tight text-ink">통계</h1>
      <p className="mt-1.5 text-sm text-muted-soft">완료한 할 일이 쌓여 만든 그래프</p>
      <StatsExplorer months={months} />
    </main>
  );
}
