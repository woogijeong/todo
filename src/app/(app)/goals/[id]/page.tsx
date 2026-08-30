import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGoal } from '../actions';
import { listPlans } from '@/app/(app)/plans/actions';
import { getYearlyGoalProgress, getWeeklyPlanProgress } from '@/lib/progress';
import { getWeekStart } from '@/lib/date';
import DeleteGoalButton from './DeleteGoalButton';
import GoalEditForm from './GoalEditForm';
import GoalCelebrationWatcher from '@/components/celebration/GoalCelebrationWatcher';
import BackLink from '@/components/ui/BackLink';
import ProgressRing from '@/components/ui/ProgressRing';
import AnimatedProgressRing from '@/components/ui/AnimatedProgressRing';
import SectionHeading from '@/components/ui/SectionHeading';
import { requirePageUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser();

  const { id } = await params;
  const [goal, overallProgress, allPlans] = await Promise.all([
    getGoal(id),
    getYearlyGoalProgress(id),
    listPlans(),
  ]);

  if (!goal) {
    notFound();
  }

  const thisWeekStart = getWeekStart(new Date());
  const childPlans = allPlans.filter((plan) => plan.yearlyGoalId === id);
  const planProgresses = await Promise.all(
    childPlans.map((plan) => getWeeklyPlanProgress(plan._id))
  );

  return (
    <>
      <GoalCelebrationWatcher goals={[{ id, progress: overallProgress }]} />
      <BackLink href="/goals" label="연간 목표" />

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
        <p className="mt-4 max-w-2xl whitespace-pre-wrap text-body">{goal.description}</p>
      )}

      <section className="mt-8 rounded-card border border-hairline bg-canvas p-6">
        <SectionHeading tone="sage">전체 진행률</SectionHeading>
        {overallProgress === null ? (
          <p className="mt-4 text-sm text-muted">하위 주간 계획 없음</p>
        ) : (
          <div className="mt-4 flex items-center gap-4">
            <AnimatedProgressRing value={overallProgress} size={64} />
            <p className="text-sm text-muted">
              하위 주간 계획 {childPlans.length}개의 평균
            </p>
          </div>
        )}
      </section>

      <section className="mt-6">
        <SectionHeading count={childPlans.length}>하위 주간 계획</SectionHeading>
        {childPlans.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            이 목표에 연결된 주간 계획이 없습니다. 주간 계획 편집에서 이 목표를 연결하세요.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2.5">
            {childPlans.map((plan, index) => {
              const progress = planProgresses[index];
              return (
                <li key={plan._id}>
                  <Link
                    href={`/plans/${plan._id}`}
                    className="flex items-center gap-4 rounded-card border border-hairline bg-canvas p-4 transition-shadow hover:shadow-float"
                  >
                    <ProgressRing value={progress} size={44} stroke={5} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">
                        {plan.title}
                        {plan.weekStart === thisWeekStart && (
                          <span className="ml-2 text-xs font-medium text-primary">· 이번 주</span>
                        )}
                      </p>
                      <p className="text-sm text-muted-soft">
                        {plan.weekStart} ~ {plan.weekEnd}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
