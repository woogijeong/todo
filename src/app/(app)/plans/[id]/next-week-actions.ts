'use server';

import { createPlan, getPlan, listPlans } from '../actions';
import { createTask, listTasksByPlan } from '@/app/(app)/tasks/actions';
import { NotFoundError, DuplicateWeeklyPlanError } from '@/lib/mongo-helpers';
import { requireUser } from '@/lib/auth';
import { addDays } from '@/lib/date';

const PLAN_ENTITY = '주간 계획';

export async function createNextWeekPlan(
  currentPlanId: string
): Promise<{ newPlanId: string }> {
  await requireUser();
  const currentPlan = await getPlan(currentPlanId);
  if (!currentPlan) throw new NotFoundError(PLAN_ENTITY);

  const nextWeekStart = addDays(currentPlan.weekStart, 7);

  // Explicit pre-check, not just a catch on DuplicateWeeklyPlanError: createPlan's
  // duplicate-key catch is a race-only fallback behind an app-level pre-check
  // of its own (see ../actions.ts) — checking here too, up front, avoids a
  // wasted createTask loop when the next week's plan (there can only be one,
  // per the app's "one plan per week, globally" rule) already exists.
  const findExisting = async (): Promise<string | null> => {
    const existing = (await listPlans()).find((plan) => plan.weekStart === nextWeekStart);
    return existing?._id ?? null;
  };

  let newPlanId: string | null = await findExisting();
  let isNewPlan = newPlanId === null;

  if (isNewPlan) {
    try {
      const newPlan = await createPlan({
        monthlyPlanId: currentPlan.monthlyPlanId,
        title: currentPlan.title,
        weekStart: nextWeekStart,
      });
      newPlanId = newPlan._id;
    } catch (error) {
      if (!(error instanceof DuplicateWeeklyPlanError)) throw error;

      // Race: another request created a plan for this week between our
      // pre-check and this insert. Look it up again rather than fail.
      const existing = await findExisting();
      if (!existing) throw error;

      newPlanId = existing;
      isNewPlan = false;
    }
  }

  if (!newPlanId) {
    // Unreachable: every branch above either finds an existing id or sets
    // one after a successful createPlan (re-throwing on any other failure).
    throw new Error('다음 주 계획 생성에 실패했습니다.');
  }
  const resolvedPlanId: string = newPlanId;

  if (isNewPlan) {
    const tasks = await listTasksByPlan(currentPlanId);
    for (const task of tasks) {
      await createTask({
        weeklyPlanId: resolvedPlanId,
        title: task.title,
        description: task.description,
        status: 'todo',
        dueDate: task.dueDate ? addDays(task.dueDate, 7) : undefined,
      });
    }
  }

  return { newPlanId: resolvedPlanId };
}
