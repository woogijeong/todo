'use server';

import { requireUser } from '@/lib/auth';
import { getYearlyGoalProgress } from '@/lib/progress';
import { getPlan } from '../actions';

/**
 * After a task on this plan's board changes, the client asks whether the
 * plan's parent Yearly Goal has just reached 100%. Returns the goal id and
 * its freshly-derived progress, or null when the plan has no linked goal.
 * The client dedupes the celebration with a per-goal localStorage marker.
 */
export async function checkGoalMilestone(
  planId: string
): Promise<{ goalId: string; progress: number | null } | null> {
  await requireUser();
  const plan = await getPlan(planId);
  if (!plan || !plan.yearlyGoalId) return null;
  return {
    goalId: plan.yearlyGoalId,
    progress: await getYearlyGoalProgress(plan.yearlyGoalId),
  };
}
