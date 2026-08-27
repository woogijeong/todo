import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGoal } from '../actions';
import { listMonthlyPlans } from '@/app/(app)/monthly-plans/actions';
import { getYearlyGoalProgress, getMonthlyPlanProgress } from '@/lib/progress';
import DeleteGoalButton from './DeleteGoalButton';
import GoalEditForm from './GoalEditForm';
import { requirePageUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function monthLabel(month: string): string {
  const [year, monthNum] = month.split('-');
  return `${year}년 ${Number(monthNum)}월`;
}

export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser();

  const { id } = await params;
  const [goal, overallProgress, allMonthlyPlans] = await Promise.all([
    getGoal(id),
    getYearlyGoalProgress(id),
    listMonthlyPlans(),
  ]);

  if (!goal) {
    notFound();
  }

  const childPlans = allMonthlyPlans.filter((plan) => plan.yearlyGoalId === id);
  const planProgresses = await Promise.all(
    childPlans.map((plan) => getMonthlyPlanProgress(plan._id))
  );

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/goals" className="mb-4 inline-block text-sm text-ink hover:underline">
        ‹ 연간 계획
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{goal.title}</h1>
          <p className="mt-1 text-sm text-muted">{goal.year}</p>
        </div>
        <DeleteGoalButton goalId={id} childPlanCount={childPlans.length} />
      </div>

      <div className="mt-4">
        <GoalEditForm goal={goal} />
      </div>

      {goal.description && (
        <p className="mt-4 whitespace-pre-wrap text-body">{goal.description}</p>
      )}

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
        <h2 className="text-lg font-semibold text-ink">하위 월간 계획</h2>
        {childPlans.length === 0 ? (
          <p className="mt-2 text-muted">하위 계획 없음</p>
        ) : (
          <ul className="mt-2 divide-y divide-hairline">
            {childPlans.map((plan, index) => {
              const progress = planProgresses[index];
              return (
                <li key={plan._id} className="py-3">
                  <Link href={`/monthly-plans/${plan._id}`} className="block hover:underline">
                    <p className="font-medium">{plan.title}</p>
                    <p className="text-sm text-muted">{monthLabel(plan.month)}</p>
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
