'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getPlanByWeekStart, createPlan } from './actions';
import { findOrCreateMonthlyPlanForMonth } from '@/app/(app)/monthly-plans/actions';

/**
 * Opens the full board for the week starting at `weekStart`, creating the
 * Weekly Plan (and its containing Monthly Plan) on the fly if it doesn't
 * exist yet — so picking any week in the explorer lands straight on its
 * board rather than an intermediate day grid.
 */
export async function openWeekBoard(weekStart: string, fallbackTitle: string): Promise<void> {
  await requireUser();

  let plan = await getPlanByWeekStart(weekStart);
  if (!plan) {
    const monthlyPlanId = await findOrCreateMonthlyPlanForMonth(weekStart.slice(0, 7));
    plan = await createPlan({ monthlyPlanId, title: fallbackTitle, weekStart });
  }

  redirect(`/plans/${plan._id}`);
}
