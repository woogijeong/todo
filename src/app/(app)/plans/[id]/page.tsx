import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
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
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/plans" className="mb-4 inline-block text-sm text-blue-600 hover:underline">
        ‹ 주간 계획
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{plan.title}</h1>
          <p className="mt-2 text-gray-600">
            {plan.weekStart} – {plan.weekEnd}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <form action={goToNextWeek}>
            <button
              type="submit"
              className="whitespace-nowrap rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
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
