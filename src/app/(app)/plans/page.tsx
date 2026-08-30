import { listPlans } from './actions';
import { listGoals } from '../goals/actions';
import WeeklyPlanExplorer from './WeeklyPlanExplorer';
import { getWeeklyPlanProgress, getWeeklyPlanTaskCounts } from '@/lib/progress';
import { getWeekStart } from '@/lib/date';
import { requirePageUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function PlansPage() {
  await requirePageUser();

  const [plans, goals] = await Promise.all([listPlans(), listGoals()]);
  const goalTitleById = new Map(goals.map((g) => [g._id, g.title]));

  const [progresses, counts] = await Promise.all([
    Promise.all(plans.map((plan) => getWeeklyPlanProgress(plan._id))),
    Promise.all(plans.map((plan) => getWeeklyPlanTaskCounts(plan._id))),
  ]);

  return (
    <>
      <h1 className="text-[26px] font-bold tracking-tight text-ink">주간 계획</h1>
      <p className="mt-1.5 text-sm text-muted-soft">
        할 일을 주 단위로 묶어 진행률을 추적합니다
      </p>
      <WeeklyPlanExplorer
        thisWeekStart={getWeekStart(new Date())}
        plans={plans.map((plan, index) => ({
          _id: plan._id,
          weekStart: plan.weekStart,
          weekEnd: plan.weekEnd,
          title: plan.title,
          progress: progresses[index],
          total: counts[index].total,
          done: counts[index].done,
          goalTitle: plan.yearlyGoalId ? goalTitleById.get(plan.yearlyGoalId) ?? null : null,
        }))}
      />
    </>
  );
}
