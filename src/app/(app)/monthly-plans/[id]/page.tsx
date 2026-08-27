import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMonthlyPlan } from '../actions';
import { listPlans } from '@/app/(app)/plans/actions';
import { listGoals } from '@/app/(app)/goals/actions';
import { getMonthlyPlanProgress, getWeeklyPlanProgress } from '@/lib/progress';
import DeleteMonthlyPlanButton from './DeleteMonthlyPlanButton';
import MonthlyPlanEditForm from './MonthlyPlanEditForm';
import { requirePageUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function monthLabel(month: string): string {
  const [year, monthNum] = month.split('-');
  return `${year}년 ${Number(monthNum)}월`;
}

export default async function MonthlyPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser();

  const { id } = await params;
  const [plan, overallProgress, allPlans, goals] = await Promise.all([
    getMonthlyPlan(id),
    getMonthlyPlanProgress(id),
    listPlans(),
    listGoals(),
  ]);

  if (!plan) {
    notFound();
  }

  const childPlans = allPlans.filter((p) => p.monthlyPlanId === id);
  const planProgresses = await Promise.all(
    childPlans.map((p) => getWeeklyPlanProgress(p._id))
  );
  const linkedGoal = plan.yearlyGoalId
    ? goals.find((g) => g._id === plan.yearlyGoalId) ?? null
    : null;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/monthly-plans" className="mb-4 inline-block text-sm text-ink hover:underline">
        ‹ 월간 계획
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{plan.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {monthLabel(plan.month)}
            {linkedGoal && (
              <>
                {' · '}
                <Link
                  href={`/goals/${linkedGoal._id}`}
                  className="text-ink hover:underline"
                >
                  {linkedGoal.title}
                </Link>
              </>
            )}
          </p>
        </div>
        <DeleteMonthlyPlanButton monthlyPlanId={id} childWeeklyPlanCount={childPlans.length} />
      </div>

      <div className="mt-4">
        <MonthlyPlanEditForm plan={plan} goals={goals} />
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-ink">전체 진행률</h2>
        {overallProgress === null ? (
          <p className="mt-2 text-muted">하위 계획 없음</p>
        ) : (
          <div className="mt-2">
            <div className="h-2 w-full rounded-full bg-surface-strong">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <p className="mt-1 text-sm text-muted">{overallProgress}%</p>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-ink">하위 주간 계획</h2>
        {childPlans.length === 0 ? (
          <p className="mt-2 text-muted">하위 계획 없음</p>
        ) : (
          <ul className="mt-2 divide-y divide-hairline">
            {childPlans.map((childPlan, index) => {
              const progress = planProgresses[index];
              return (
                <li key={childPlan._id} className="py-3">
                  <Link href={`/plans/${childPlan._id}`} className="block hover:underline">
                    <p className="font-medium">{childPlan.title}</p>
                    <p className="text-sm text-muted">
                      {childPlan.weekStart} ~ {childPlan.weekEnd}
                    </p>
                    <p className="text-sm text-muted">
                      {progress === null ? '할 일 없음' : `${progress}%`}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
