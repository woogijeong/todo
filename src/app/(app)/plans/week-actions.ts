'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getPlanByWeekStart, createPlan } from './actions';

/**
 * Opens the full board for the week starting at `weekStart`, creating the
 * Weekly Plan on the fly if it doesn't exist yet — so picking any week in the
 * explorer lands straight on its board. New plans start with no linked Yearly
 * Goal; the plan's edit form is where a goal is attached.
 */
export async function openWeekBoard(weekStart: string, fallbackTitle: string): Promise<void> {
  await requireUser();

  let plan = await getPlanByWeekStart(weekStart);
  if (!plan) {
    plan = await createPlan({ yearlyGoalId: null, title: fallbackTitle, weekStart });
  }

  redirect(`/plans/${plan._id}`);
}
