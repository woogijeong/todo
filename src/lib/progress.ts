import { cache } from 'react';
import { getDb } from './mongodb';
import { requireUserId } from './auth';

type Status = 'todo' | 'doing' | 'done';

/**
 * Pure computation, separated from the DB read so it can be unit-tested
 * without a live MongoDB connection. `total === 0` returns `null` (not 0) so
 * an empty Weekly Plan reads as "할 일 없음" instead of tanking the parent
 * Yearly Goal's average the moment an empty next-week shell is created.
 */
export function computeProgress(statuses: Status[]): number | null {
  const total = statuses.length;
  if (total === 0) return null;
  const done = statuses.filter((s) => s === 'done').length;
  return Math.floor((done / total) * 100);
}

/**
 * Unweighted average of non-null child progresses, per PRD:51 ("평균 진행률").
 * Plans with `null` progress (no tasks) are excluded from both the sum and
 * the denominator so an empty plan doesn't drag the average down.
 */
export function computeYearlyAverage(planProgresses: Array<number | null>): number | null {
  const valid = planProgresses.filter((p): p is number => p !== null);
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, p) => acc + p, 0);
  return Math.floor(sum / valid.length);
}

export type ProgressSnapshot = {
  /** Derived progress for one Weekly Plan (`null` when it has no tasks). */
  planProgress(weeklyPlanId: string): number | null;
  /** Raw task counts for one Weekly Plan — for "M / N 완료" labels. */
  planCounts(weeklyPlanId: string): { total: number; done: number };
  /**
   * Yearly Goal progress: unweighted average of its child Weekly Plans'
   * derived progress. A plan with no linked goal is in no goal's rollup.
   */
  goalProgress(yearlyGoalId: string): number | null;
};

/**
 * Reads the caller's whole plan/task graph in exactly two queries and derives
 * every rollup in memory. Wrapped in React `cache()` so one request — layout,
 * page, and any client-island props — shares a single snapshot instead of the
 * per-goal/per-plan N+1 cascade this used to run (a goal rollup was
 * `weeklyPlans.find` + one `tasks.find` per child plan, re-issued for every
 * goal on the page, then again on every revalidation).
 *
 * Outside a request scope (unit/integration tests) `cache` is a pass-through,
 * so each call re-reads the live database.
 *
 * Every aggregation is scoped to `userId`: a plan/goal id alone is not a
 * capability, so nothing owned by another user can surface in a progress bar.
 * Plan progress is keyed off the tasks themselves (by `weeklyPlanId`), not off
 * the `weeklyPlans` list, so a task pointing at a plan id with no document
 * still counts — matching the old direct-query behaviour.
 */
export const getProgressSnapshot = cache(async (): Promise<ProgressSnapshot> => {
  const userId = await requireUserId();
  const db = await getDb();

  const [plans, tasks] = await Promise.all([
    db
      .collection<{ _id: unknown; yearlyGoalId: string | null }>('weeklyPlans')
      .find({ userId }, { projection: { yearlyGoalId: 1 } })
      .toArray(),
    db
      .collection<{ status: Status; weeklyPlanId: string | null }>('tasks')
      .find({ userId }, { projection: { status: 1, weeklyPlanId: 1 } })
      .toArray(),
  ]);

  const statusesByPlan = new Map<string, Status[]>();
  for (const t of tasks) {
    if (!t.weeklyPlanId) continue;
    let arr = statusesByPlan.get(t.weeklyPlanId);
    if (!arr) statusesByPlan.set(t.weeklyPlanId, (arr = []));
    arr.push(t.status);
  }

  const planIdsByGoal = new Map<string, string[]>();
  for (const p of plans) {
    if (!p.yearlyGoalId) continue;
    let arr = planIdsByGoal.get(p.yearlyGoalId);
    if (!arr) planIdsByGoal.set(p.yearlyGoalId, (arr = []));
    arr.push(String(p._id));
  }

  return {
    planProgress: (id) => computeProgress(statusesByPlan.get(id) ?? []),
    planCounts: (id) => {
      const s = statusesByPlan.get(id) ?? [];
      return { total: s.length, done: s.filter((x) => x === 'done').length };
    },
    goalProgress: (goalId) => {
      const ids = planIdsByGoal.get(goalId);
      if (!ids || ids.length === 0) return null;
      return computeYearlyAverage(
        ids.map((id) => computeProgress(statusesByPlan.get(id) ?? []))
      );
    },
  };
});

/** Weekly Plan progress, derived on read from the `tasks` collection — never stored,
 *  so it can never drift after a delete, re-parent, or manual DB edit. */
export async function getWeeklyPlanProgress(weeklyPlanId: string): Promise<number | null> {
  return (await getProgressSnapshot()).planProgress(weeklyPlanId);
}

/** Raw task counts for one Weekly Plan — for "M / N 완료" labels that need the
 *  actual numbers, not just the derived percentage. */
export async function getWeeklyPlanTaskCounts(
  weeklyPlanId: string
): Promise<{ total: number; done: number }> {
  return (await getProgressSnapshot()).planCounts(weeklyPlanId);
}

/** Yearly Goal progress: unweighted average of its child Weekly Plans' derived
 *  progress. Weekly Plans link directly to a Yearly Goal; a plan with no linked
 *  goal (`yearlyGoalId: null`) is in no goal's rollup. */
export async function getYearlyGoalProgress(yearlyGoalId: string): Promise<number | null> {
  return (await getProgressSnapshot()).goalProgress(yearlyGoalId);
}
