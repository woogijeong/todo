'use server';

import { getWeekStart } from '@/lib/date';
import { getPlanByWeekStart, createPlan } from './actions';
import { createTask } from '@/app/(app)/tasks/actions';
import { findOrCreateMonthlyPlanForMonth } from '@/app/(app)/monthly-plans/actions';
import { requireUser } from '@/lib/auth';
import type { Task } from '@/lib/schemas';

/**
 * Creates a task due on `date`, auto-vivifying its containing Weekly Plan
 * (and, transitively, the containing Monthly Plan) if they don't exist yet.
 * Lets a user type a task straight into a day cell in the Weekly Plan tab's
 * month -> week -> day explorer without ever having to explicitly create a
 * container plan first — the same auto-vivification pattern already used by
 * the dashboard's "이번 주 계획 만들기" and "다음 주 계획 만들기", extended one
 * level further down to the day.
 */
export async function createTaskForDate(
  date: string,
  title: string
): Promise<{ task: Task; weeklyPlanId: string }> {
  await requireUser();

  const weekStart = getWeekStart(new Date(`${date}T00:00:00Z`));
  const month = weekStart.slice(0, 7);

  let plan = await getPlanByWeekStart(weekStart);
  if (!plan) {
    const monthlyPlanId = await findOrCreateMonthlyPlanForMonth(month);
    plan = await createPlan({ monthlyPlanId, title: `${weekStart} 주`, weekStart });
  }

  const task = await createTask({
    weeklyPlanId: plan._id,
    title,
    status: 'todo',
    dueDate: date,
  });

  return { task, weeklyPlanId: plan._id };
}
