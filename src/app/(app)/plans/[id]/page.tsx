import { notFound, redirect } from 'next/navigation';
import BackLink from '@/components/ui/BackLink';
import { getPlan } from '../actions';
import { listTasksByPlan } from '@/app/(app)/tasks/actions';
import TaskBoard from '@/components/board/TaskBoard';
import { createNextWeekPlan } from './next-week-actions';
import DeletePlanButton from './DeletePlanButton';
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

  const tasks = await listTasksByPlan(id);

  async function goToNextWeek() {
    'use server';
    const { newPlanId } = await createNextWeekPlan(id);
    redirect(`/plans/${newPlanId}`);
  }

  return (
    <main className="mx-auto max-w-5xl p-6 sm:p-8">
      <BackLink href="/plans" label="주간 계획" />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-ink">{plan.title}</h1>
          <p className="mt-1.5 text-sm text-muted-soft">
            {plan.weekStart} &ndash; {plan.weekEnd}
          </p>
        </div>
        <div className="flex items-start gap-2">
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
    </main>
  );
}
