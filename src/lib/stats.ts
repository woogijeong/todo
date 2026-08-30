import { getDb } from './mongodb';
import { requireUserId } from './auth';
import { computeProgress } from './progress';
import { getWeekStart, getTodayString, addDays, toDateString } from './date';
import type { TaskStatus } from './schemas';

/** One bar in the "최근 12주 주간 완료율" chart. */
export type WeeklyCompletionPoint = {
  planId: string;
  weekStart: string;
  label: string;
  progress: number | null;
  isCurrent: boolean;
};

/** One bar in the "최근 30일 완료 개수" chart. */
export type DailyCompletionPoint = {
  date: string;
  label: string;
  count: number;
};

/** One row in the "목표별 누적 완료" chart. `goalId: null` is the "목표 없음" bucket. */
export type GoalCumulativePoint = {
  goalId: string | null;
  title: string;
  count: number;
};

export type StatsSnapshot = {
  weekly: WeeklyCompletionPoint[];
  daily: DailyCompletionPoint[];
  goals: GoalCumulativePoint[];
  dailyAvg: number;
  totalDone: number;
};

const DAILY_WINDOW = 30;
const WEEKLY_WINDOW = 12;

function shortLabel(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number);
  return `${month}/${day}`;
}

// ---------------------------------------------------------------------------
// Pure helpers — DB-independent, unit-tested without a live MongoDB.
// ---------------------------------------------------------------------------

/**
 * Turns weekly plans + their task statuses into the last-12-weeks completion
 * series (oldest first). Week progress is the plan's overall done/total
 * (`computeProgress`), matching every other progress bar in the app.
 */
export function buildWeeklyCompletionSeries(
  plans: Array<{ planId: string; weekStart: string; statuses: TaskStatus[] }>,
  currentWeekStart: string
): WeeklyCompletionPoint[] {
  return [...plans]
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .slice(-WEEKLY_WINDOW)
    .map((p) => ({
      planId: p.planId,
      weekStart: p.weekStart,
      label: shortLabel(p.weekStart),
      progress: computeProgress(p.statuses),
      isCurrent: p.weekStart === currentWeekStart,
    }));
}

/**
 * Buckets completion dates ('YYYY-MM-DD', Seoul-time) into the 30 days ending
 * on `todayStr` (inclusive). Dates outside the window are ignored.
 */
export function bucketDailyCompletions(
  completedDates: string[],
  todayStr: string
): DailyCompletionPoint[] {
  const counts = new Map<string, number>();
  for (const d of completedDates) {
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }

  const start = addDays(todayStr, -(DAILY_WINDOW - 1));
  return Array.from({ length: DAILY_WINDOW }, (_, i) => {
    const date = addDays(start, i);
    return { date, label: shortLabel(date), count: counts.get(date) ?? 0 };
  });
}

/**
 * Groups completed-task rows by their weekly plan's yearly goal. Rows whose
 * goal id is null or unknown collapse into a single "목표 없음" bucket, which
 * is always sorted last; the rest are sorted by count, descending.
 */
export function aggregateGoalCumulative(
  rows: Array<{ yearlyGoalId: string | null }>,
  goalTitleById: Map<string, string>
): GoalCumulativePoint[] {
  const counts = new Map<string | null, number>();
  for (const row of rows) {
    const key =
      row.yearlyGoalId && goalTitleById.has(row.yearlyGoalId) ? row.yearlyGoalId : null;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const named: GoalCumulativePoint[] = [];
  let noneCount = 0;
  for (const [key, count] of counts) {
    if (key === null) {
      noneCount = count;
    } else {
      named.push({ goalId: key, title: goalTitleById.get(key)!, count });
    }
  }
  named.sort((a, b) => b.count - a.count);

  return noneCount > 0
    ? [...named, { goalId: null, title: '목표 없음', count: noneCount }]
    : named;
}

// ---------------------------------------------------------------------------
// DB-reading entry point
// ---------------------------------------------------------------------------

type ObjectId = import('mongodb').ObjectId;

/**
 * A live snapshot for the stats page. Charts 2 and 3 read `tasks.completedAt`
 * (kept current by tasks/status-actions.ts, backfilled by the drop-monthly
 * migration) — a completed-then-reopened task counts only at its latest
 * completion date, and a completed-then-deleted task no longer counts, both
 * acceptable for a single-user live snapshot.
 */
export async function getStatsSnapshot(): Promise<StatsSnapshot> {
  const userId = await requireUserId();
  const db = await getDb();

  const todayStr = getTodayString();
  const currentWeekStart = getWeekStart(new Date());
  const year = Number(todayStr.slice(0, 4));
  const windowStart = addDays(todayStr, -(DAILY_WINDOW - 1));
  const windowStartInstant = new Date(`${windowStart}T00:00:00+09:00`);
  const yearStartInstant = new Date(`${year}-01-01T00:00:00+09:00`);

  // Chart 1: last 12 weekly plans by weekStart.
  const recentPlans = await db
    .collection<{ _id: ObjectId; weekStart: string }>('weeklyPlans')
    .find({ userId }, { projection: { weekStart: 1 } })
    .sort({ weekStart: -1 })
    .limit(WEEKLY_WINDOW)
    .toArray();

  const planSeries = await Promise.all(
    recentPlans.map(async (plan) => {
      const planId = plan._id.toString();
      const tasks = await db
        .collection<{ status: TaskStatus }>('tasks')
        .find({ weeklyPlanId: planId, userId }, { projection: { status: 1 } })
        .toArray();
      return { planId, weekStart: plan.weekStart, statuses: tasks.map((t) => t.status) };
    })
  );
  const weekly = buildWeeklyCompletionSeries(planSeries, currentWeekStart);

  // Chart 2: tasks completed in the last 30 days.
  const recentDone = await db
    .collection<{ completedAt?: Date | null }>('tasks')
    .find(
      { userId, status: 'done', completedAt: { $gte: windowStartInstant } },
      { projection: { completedAt: 1 } }
    )
    .toArray();
  const daily = bucketDailyCompletions(
    recentDone
      .map((t) => t.completedAt)
      .filter((d): d is Date => d instanceof Date)
      .map((d) => toDateString(d)),
    todayStr
  );
  const dailyTotal = daily.reduce((sum, d) => sum + d.count, 0);
  const dailyAvg = Math.round((dailyTotal / DAILY_WINDOW) * 10) / 10;

  // Chart 3: tasks completed since Jan 1, grouped by yearly goal.
  const [yearDone, allPlans, allGoals] = await Promise.all([
    db
      .collection<{ weeklyPlanId: string | null }>('tasks')
      .find(
        { userId, status: 'done', completedAt: { $gte: yearStartInstant } },
        { projection: { weeklyPlanId: 1 } }
      )
      .toArray(),
    db
      .collection<{ _id: ObjectId; yearlyGoalId: string | null }>('weeklyPlans')
      .find({ userId }, { projection: { yearlyGoalId: 1 } })
      .toArray(),
    db
      .collection<{ _id: ObjectId; title: string }>('yearlyGoals')
      .find({ userId }, { projection: { title: 1 } })
      .toArray(),
  ]);

  const goalIdByPlan = new Map(allPlans.map((p) => [p._id.toString(), p.yearlyGoalId]));
  const goalTitleById = new Map(allGoals.map((g) => [g._id.toString(), g.title]));
  const goals = aggregateGoalCumulative(
    yearDone.map((t) => ({
      yearlyGoalId: t.weeklyPlanId ? goalIdByPlan.get(t.weeklyPlanId) ?? null : null,
    })),
    goalTitleById
  );
  const totalDone = goals.reduce((sum, g) => sum + g.count, 0);

  return { weekly, daily, goals, dailyAvg, totalDone };
}
