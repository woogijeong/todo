import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import BackLink from '@/components/ui/BackLink';
import { getPlan } from '../actions';
import { listGoals, getGoal } from '../../goals/actions';
import { getYearlyGoalProgress } from '@/lib/progress';
import { listTasksByPlan } from '@/app/(app)/tasks/actions';
import TaskBoard from '@/components/board/TaskBoard';
import { createNextWeekPlan } from './next-week-actions';
import DeletePlanButton from './DeletePlanButton';
import PlanEditForm from './PlanEditForm';
import { requirePageUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function PlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser();

  const { id } = await params;
  const plan = await getPlan(id);

  if (!plan) notFound();

  const [tasks, goals, goal, goalProgress] = await Promise.all([
    listTasksByPlan(id),
    listGoals(),
    plan.yearlyGoalId ? getGoal(plan.yearlyGoalId) : Promise.resolve(null),
    plan.yearlyGoalId ? getYearlyGoalProgress(plan.yearlyGoalId) : Promise.resolve(null),
  ]);

  async function goToNextWeek() {
    'use server';
    const { newPlanId } = await createNextWeekPlan(id);
    redirect(`/plans/${newPlanId}`);
  }

  return (
    <>
      {goal ? (
        <div className="mb-5 flex items-center gap-2 text-sm text-muted-soft">
          <span>연간 목표</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="m9 6 6 6-6 6" />
          </svg>
          <Link href={`/goals/${goal._id}`} className="text-body hover:text-primary">
            {goal.title}
          </Link>
          {goalProgress !== null && (
            <span className="rounded-full border border-dashed border-border-strong px-2 text-xs text-[color:var(--color-accent-sage)]">
              {goalProgress}%
            </span>
          )}
        </div>
      ) : (
        <BackLink href="/plans" label="주간 계획" />
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-ink">{plan.title}</h1>
          <p className="mt-1.5 text-sm text-muted-soft">
            {plan.weekStart} &ndash; {plan.weekEnd}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <PlanEditForm plan={plan} goals={goals} />
          <form action={goToNextWeek}>
            <button
              type="submit"
              className="whitespace-nowrap rounded-btn border border-primary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-surface-strong"
            >
              다음 주 계획 만들기
            </button>
          </form>
          <DeletePlanButton planId={id} childTaskCount={tasks.length} />
        </div>
      </div>
      <TaskBoard planId={id} initialTasks={tasks} weekStart={plan.weekStart} />
    </>
  );
}
