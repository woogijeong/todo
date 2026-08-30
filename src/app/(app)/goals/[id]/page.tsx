import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGoal } from '../actions';
import { listMonthlyPlans } from '@/app/(app)/monthly-plans/actions';
import { getYearlyGoalProgress, getMonthlyPlanProgress } from '@/lib/progress';
import DeleteGoalButton from './DeleteGoalButton';
import GoalEditForm from './GoalEditForm';
import BackLink from '@/components/ui/BackLink';
import ProgressRing from '@/components/ui/ProgressRing';
import SectionHeading from '@/components/ui/SectionHeading';
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
    <main className="mx-auto max-w-2xl p-6 sm:p-8">
      <BackLink href="/goals" label="연간 계획" />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-ink">{goal.title}</h1>
          <p className="mt-1 text-sm text-muted-soft">{goal.year}</p>
        </div>
        <DeleteGoalButton goalId={id} childPlanCount={childPlans.length} />
      </div>

      <div className="mt-4">
        <GoalEditForm goal={goal} />
      </div>

      {goal.description && (
        <p className="mt-4 whitespace-pre-wrap text-body">{goal.description}</p>
      )}

      <section className="mt-8 rounded-card border border-hairline bg-canvas p-6">
        <SectionHeading tone="sage">전체 진행률</SectionHeading>
        {overallProgress === null ? (
          <p className="mt-4 text-sm text-muted">하위 계획 없음</p>
        ) : (
          <div className="mt-4 flex items-center gap-4">
            <ProgressRing value={overallProgress} size={64} />
            <p className="text-sm text-muted">
              하위 월간 계획 {childPlans.length}개의 평균
            </p>
          </div>
        )}
      </section>

      <section className="mt-6">
        <SectionHeading count={childPlans.length}>하위 월간 계획</SectionHeading>
        {childPlans.length === 0 ? (
          <p className="mt-4 text-sm text-muted">하위 계획 없음</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2.5">
            {childPlans.map((plan, index) => {
              const progress = planProgresses[index];
              return (
                <li key={plan._id}>
                  <Link
                    href={`/monthly-plans/${plan._id}`}
                    className="flex items-center gap-4 rounded-card border border-hairline bg-canvas p-4 transition-shadow hover:shadow-float"
                  >
                    <ProgressRing value={progress} size={44} stroke={5} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{plan.title}</p>
                      <p className="text-sm text-muted-soft">{monthLabel(plan.month)}</p>
                    </div>
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
