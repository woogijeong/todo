import { getDb } from './mongodb';
import { requireUserId } from './auth';

/**
 * Pure computation, separated from the DB read so it can be unit-tested
 * without a live MongoDB connection. `total === 0` returns `null` (not 0) so
 * an empty Weekly Plan reads as "할 일 없음" instead of tanking the parent
 * Yearly Goal's average the moment an empty next-week shell is created.
 */
export function computeProgress(statuses: Array<'todo' | 'doing' | 'done'>): number | null {
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

// Every rollup below is scoped to the calling user: a plan/goal id alone is
// not a capability, so each aggregation filters on `userId` too and no
// document owned by another user can leak into a progress bar. The public
// functions resolve `userId` once via `requireUserId()` and pass it down to
// the `*For` helpers so a single deep rollup doesn't repeat the session
// lookup at every level.

async function weeklyPlanProgressFor(
  userId: string,
  weeklyPlanId: string
): Promise<number | null> {
  const db = await getDb();
  const tasks = await db
    .collection<{ status: 'todo' | 'doing' | 'done' }>('tasks')
    .find({ weeklyPlanId, userId }, { projection: { status: 1 } })
    .toArray();
  return computeProgress(tasks.map((t) => t.status));
}

async function monthlyPlanProgressFor(
  userId: string,
  monthlyPlanId: string
): Promise<number | null> {
  const db = await getDb();
  const plans = await db
    .collection<{ _id: unknown }>('weeklyPlans')
    .find({ monthlyPlanId, userId }, { projection: { _id: 1 } })
    .toArray();

  const progresses = await Promise.all(
    plans.map((p) => weeklyPlanProgressFor(userId, String(p._id)))
  );
  return computeYearlyAverage(progresses);
}

/** Weekly Plan progress, derived on read from the `tasks` collection — never stored,
 *  so it can never drift after a delete, re-parent, or manual DB edit. */
export async function getWeeklyPlanProgress(weeklyPlanId: string): Promise<number | null> {
  return weeklyPlanProgressFor(await requireUserId(), weeklyPlanId);
}

/** Monthly Plan progress: unweighted average of its child Weekly Plans' derived progress. */
export async function getMonthlyPlanProgress(monthlyPlanId: string): Promise<number | null> {
  return monthlyPlanProgressFor(await requireUserId(), monthlyPlanId);
}

/** Yearly Goal progress: unweighted average of its child Monthly Plans' derived
 *  progress (which are themselves an average of their Weekly Plans' progress —
 *  Weekly Plans no longer link to a Yearly Goal directly, only via a Monthly Plan). */
export async function getYearlyGoalProgress(yearlyGoalId: string): Promise<number | null> {
  const userId = await requireUserId();
  const db = await getDb();
  const monthlyPlans = await db
    .collection<{ _id: unknown }>('monthlyPlans')
    .find({ yearlyGoalId, userId }, { projection: { _id: 1 } })
    .toArray();

  const progresses = await Promise.all(
    monthlyPlans.map((p) => monthlyPlanProgressFor(userId, String(p._id)))
  );
  return computeYearlyAverage(progresses);
}
