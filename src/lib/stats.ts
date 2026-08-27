import { getDb } from './mongodb';
import { requireUserId } from './auth';
import { computeProgress, computeYearlyAverage } from './progress';
import { getWeekDates, getWeekdayLabel } from './date';
import type { TaskStatus } from './schemas';

export type DayStat = {
  date: string;
  weekday: string;
  progress: number | null;
};

export type WeekStat = {
  planId: string;
  title: string;
  weekStart: string;
  weekEnd: string;
  progress: number | null;
  days: DayStat[];
};

export type MonthStat = {
  month: string;
  label: string;
  progress: number | null;
  weeks: WeekStat[];
};

function monthLabel(month: string): string {
  const [year, monthNum] = month.split('-');
  return `${year}년 ${Number(monthNum)}월`;
}

type PlanShape = { _id: string; title: string; weekStart: string; weekEnd: string };
type TaskShape = { status: TaskStatus; dueDate?: string };

/**
 * Builds one WeekStat from a plan and its tasks — pure and DB-independent,
 * so it's unit-testable without a live MongoDB connection (mirrors the
 * pure/DB-wrapper split already established in progress.ts). Week-level
 * progress is the plan's overall done/total (not an average of the days),
 * matching how getWeeklyPlanProgress computes it. Day-level progress is
 * done/total among just the tasks due that day; a task with no `dueDate`
 * (or one outside this week) is still counted in the week total but isn't
 * attributed to any day.
 */
export function buildWeekStat(plan: PlanShape, tasks: TaskShape[]): WeekStat {
  const days: DayStat[] = getWeekDates(plan.weekStart).map((date) => {
    const dayTasks = tasks.filter((t) => t.dueDate === date);
    return {
      date,
      weekday: getWeekdayLabel(date),
      progress: computeProgress(dayTasks.map((t) => t.status)),
    };
  });

  return {
    planId: plan._id,
    title: plan.title,
    weekStart: plan.weekStart,
    weekEnd: plan.weekEnd,
    progress: computeProgress(tasks.map((t) => t.status)),
    days,
  };
}

/**
 * Groups WeekStats by the month their weekStart falls in (a week spanning
 * two months is attributed to the month of its Monday) and computes each
 * month's progress as the unweighted average of its weeks' progress — same
 * convention as the Yearly Goal average (computeYearlyAverage in
 * progress.ts): weeks with no tasks (null progress) are excluded rather
 * than counted as 0, so an empty week doesn't drag the month average down.
 */
export function buildMonthHierarchy(weekStats: WeekStat[]): MonthStat[] {
  const byMonth = new Map<string, WeekStat[]>();
  for (const week of weekStats) {
    const month = week.weekStart.slice(0, 7);
    const existing = byMonth.get(month);
    if (existing) {
      existing.push(week);
    } else {
      byMonth.set(month, [week]);
    }
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([month, weeks]) => ({
      month,
      label: monthLabel(month),
      progress: computeYearlyAverage(weeks.map((w) => w.progress)),
      weeks: [...weeks].sort((a, b) => (a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0)),
    }));
}

/**
 * DB-reading wrapper: fetches every weekly plan and its tasks, and builds
 * the full Month -> Week -> Day completion-percentage hierarchy. This is a
 * live snapshot derived from the current weeklyPlans/tasks collections —
 * the same source the rest of the app's progress bars use — not an audit
 * log, so a deleted task's past completion no longer counts here.
 */
export async function getStatsHierarchy(): Promise<MonthStat[]> {
  const userId = await requireUserId();
  const db = await getDb();
  const plans = await db
    .collection<{ _id: import('mongodb').ObjectId; title: string; weekStart: string; weekEnd: string }>(
      'weeklyPlans'
    )
    .find({ userId })
    .sort({ weekStart: 1 })
    .toArray();

  const weekStats = await Promise.all(
    plans.map(async (plan) => {
      const planId = plan._id.toString();
      const tasks = await db
        .collection<{ weeklyPlanId: string | null } & TaskShape>('tasks')
        .find({ weeklyPlanId: planId, userId }, { projection: { status: 1, dueDate: 1 } })
        .toArray();
      return buildWeekStat(
        { _id: planId, title: plan.title, weekStart: plan.weekStart, weekEnd: plan.weekEnd },
        tasks
      );
    })
  );

  return buildMonthHierarchy(weekStats);
}
