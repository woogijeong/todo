import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMonthlyPlan } from '../actions';
import { listPlans } from '@/app/(app)/plans/actions';
import { listGoals } from '@/app/(app)/goals/actions';
import { getMonthlyPlanProgress, getWeeklyPlanProgress } from '@/lib/progress';
import DeleteMonthlyPlanButton from './DeleteMonthlyPlanButton';
import MonthlyPlanEditForm from './MonthlyPlanEditForm';
import BackLink from '@/components/ui/BackLink';
import ProgressRing from '@/components/ui/ProgressRing';
import SectionHeading from '@/components/ui/SectionHeading';
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
    <main className="mx-auto max-w-2xl p-6 sm:p-8">
      <BackLink href="/monthly-plans" label="월간 계획" />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-ink">{plan.title}</h1>
          <p className="mt-1 text-sm text-muted-soft">
            {monthLabel(plan.month)}
            {linkedGoal && (
              <>
                {' · '}
                <Link
                  href={`/goals/${linkedGoal._id}`}
                  className="text-primary hover:underline"
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

      <section className="mt-8 rounded-card border border-hairline bg-canvas p-6">
        <SectionHeading tone="sage">전체 진행률</SectionHeading>
        {overallProgress === null ? (
          <p className="mt-4 text-sm text-muted">하위 계획 없음</p>
        ) : (
          <div className="mt-4 flex items-center gap-4">
            <ProgressRing value={overallProgress} size={64} />
            <p className="text-sm text-muted">
              하위 주간 계획 {childPlans.length}개의 평균
            </p>
          </div>
        )}
      </section>

      <section className="mt-6">
        <SectionHeading count={childPlans.length}>하위 주간 계획</SectionHeading>
        {childPlans.length === 0 ? (
          <p className="mt-4 text-sm text-muted">하위 계획 없음</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2.5">
            {childPlans.map((childPlan, index) => {
              const progress = planProgresses[index];
              return (
                <li key={childPlan._id}>
                  <Link
                    href={`/plans/${childPlan._id}`}
                    className="flex items-center gap-4 rounded-card border border-hairline bg-canvas p-4 transition-shadow hover:shadow-float"
                  >
                    <ProgressRing value={progress} size={44} stroke={5} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{childPlan.title}</p>
                      <p className="text-sm text-muted-soft">
                        {childPlan.weekStart} ~ {childPlan.weekEnd}
                      </p>
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
