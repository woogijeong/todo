import { getStatsSnapshot } from '@/lib/stats';
import StatsCharts from '@/components/stats/StatsCharts';
import { requirePageUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function StatsPage() {
  await requirePageUser();

  const snapshot = await getStatsSnapshot();

  return (
    <>
      <h1 className="text-[26px] font-bold tracking-tight text-ink">통계</h1>
      <p className="mt-1.5 text-sm text-muted-soft">완료한 할 일이 쌓여 만든 그래프</p>
      <StatsCharts snapshot={snapshot} />
    </>
  );
}
