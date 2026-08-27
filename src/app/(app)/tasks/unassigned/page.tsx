import { revalidatePath } from 'next/cache';
import { listTasksByPlan, updateTask } from '../actions';
import { listPlans } from '@/app/(app)/plans/actions';
import DeleteTaskButton from './DeleteTaskButton';
import { requirePageUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  todo: '할 일',
  doing: '진행 중',
  done: '완료',
};

async function reassignTaskAction(formData: FormData) {
  'use server';

  const taskId = String(formData.get('taskId') ?? '').trim();
  const weeklyPlanId = String(formData.get('weeklyPlanId') ?? '').trim();

  if (!taskId || !weeklyPlanId) return;

  await updateTask(taskId, { weeklyPlanId });

  revalidatePath('/tasks/unassigned');
}

export default async function UnassignedTasksPage() {
  await requirePageUser();

  const [tasks, plans] = await Promise.all([listTasksByPlan(null), listPlans()]);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold text-ink">미지정 할 일</h1>

      {tasks.length === 0 ? (
        <p className="mt-8 text-muted">미지정 할 일이 없습니다.</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {tasks.map((task) => (
            <li key={task._id} className="rounded-btn border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{task.title}</span>
                  <span className="text-sm text-muted">
                    {STATUS_LABELS[task.status] ?? task.status}
                    {task.dueDate ? ` · 마감일 ${task.dueDate}` : ''}
                  </span>
                </div>
                <DeleteTaskButton taskId={task._id} title={task.title} />
              </div>

              {plans.length === 0 ? (
                <p className="mt-3 text-sm text-muted-soft">
                  먼저 주간 계획을 만들어주세요.
                </p>
              ) : (
                <form action={reassignTaskAction} className="mt-3 flex gap-2">
                  <input type="hidden" name="taskId" value={task._id} />
                  <select
                    name="weeklyPlanId"
                    required
                    defaultValue=""
                    className="flex-1 rounded-btn border px-3 py-2"
                    aria-label="배정할 주간 계획"
                  >
                    <option value="" disabled>
                      주간 계획 선택
                    </option>
                    {plans.map((plan) => (
                      <option key={plan._id} value={plan._id}>
                        {plan.title} ({plan.weekStart} – {plan.weekEnd})
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="rounded-btn bg-primary px-5 py-3 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active">
                    배정
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
