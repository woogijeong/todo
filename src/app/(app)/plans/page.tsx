import { listPlans } from './actions';
import WeeklyPlanExplorer from './WeeklyPlanExplorer';
import { getWeeklyPlanProgress } from '@/lib/progress';
import { requirePageUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function PlansPage() {
  await requirePageUser();

  const plans = await listPlans();
  const progresses = await Promise.all(plans.map((plan) => getWeeklyPlanProgress(plan._id)));

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">주간 계획</h1>
      <WeeklyPlanExplorer
        plans={plans.map((plan, index) => ({
          _id: plan._id,
          weekStart: plan.weekStart,
          weekEnd: plan.weekEnd,
          title: plan.title,
          progress: progresses[index],
        }))}
      />
    </main>
  );
}
