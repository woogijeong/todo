import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createPlan, listPlans } from './plans/actions';
import { findOrCreateMonthlyPlanForMonth } from './monthly-plans/actions';
import { listGoals } from './goals/actions';
import { listTasksByPlan } from './tasks/actions';
import {
  getMonthWeekStarts,
  getTodayString,
  getWeekStart,
  getWeekdayLabel,
} from '@/lib/date';
import { getYearlyGoalProgress } from '@/lib/progress';
import { getStatsHierarchy } from '@/lib/stats';
import DashboardPlanPanels from '@/components/dashboard/DashboardPlanPanels';
import SectionHeading from '@/components/ui/SectionHeading';
import { requirePageUser } from '@/lib/auth';
import type { TaskStatus } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

function computeProgress(statuses: TaskStatus[]): number | null {
  if (statuses.length === 0) return null;
  return Math.floor(
    (statuses.filter((s) => s === 'done').length / statuses.length) * 100
  );
}

async function createThisWeekPlanAction() {
  'use server';

  const weekStart = getWeekStart(new Date());
  const monthlyPlanId = await findOrCreateMonthlyPlanForMonth(weekStart.slice(0, 7));
  const plan = await createPlan({ monthlyPlanId, title: '이번 주', weekStart });
  redirect(`/plans/${plan._id}`);
}

function StatTile({
  label,
  value,
  unit,
  note,
  bar,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  bar?: { pct: number; color: string };
}) {
  return (
    <div className="rounded-card border border-hairline bg-canvas p-5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink">
        {value}
        {unit && <span className="ml-0.5 text-sm font-medium text-muted-soft">{unit}</span>}
      </p>
      {note && <p className="mt-1 text-xs text-primary">{note}</p>}
      {bar && (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-strong">
          <div
            className="h-full rounded-full"
            style={{ width: `${bar.pct}%`, background: bar.color }}
          />
        </div>
      )}
    </div>
  );
}

export default async function Home() {
  await requirePageUser();

  const thisWeekStart = getWeekStart(new Date());

  const [plans, goals, months] = await Promise.all([
    listPlans(),
    listGoals(),
    getStatsHierarchy(),
  ]);

  const currentPlan = plans.find((plan) => plan.weekStart === thisWeekStart) ?? null;
  const [currentPlanTasks, goalProgresses] = await Promise.all([
    currentPlan ? listTasksByPlan(currentPlan._id) : Promise.resolve([]),
    Promise.all(goals.map((goal) => getYearlyGoalProgress(goal._id))),
  ]);

  const todayString = getTodayString();

  const thisMonth = todayString.slice(0, 7);
  const thisMonthStat = months.find((m) => m.month === thisMonth) ?? null;
  const thisMonthWeekStats = getMonthWeekStarts(thisMonth).map((weekStart) => ({
    weekStart,
    progress: thisMonthStat?.weeks.find((w) => w.weekStart === weekStart)?.progress ?? null,
  }));

  const weekProgress = computeProgress(currentPlanTasks.map((t) => t.status));
  const todayDueCount = currentPlanTasks.filter(
    (t) => t.dueDate === todayString && t.status !== 'done'
  ).length;
  const goalAvg = (() => {
    const vals = goalProgresses.filter((p): p is number => p !== null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  })();

  const [, month, day] = todayString.split('-').map(Number);

  return (
    <main className="mx-auto max-w-4xl p-6 sm:p-8">
      <p className="text-sm text-muted-soft">
        {month}월 {day}일 {getWeekdayLabel(todayString)}요일
      </p>
      <h1 className="mt-1 text-[28px] font-bold tracking-tight text-ink">
        {todayDueCount > 0
          ? `오늘 처리할 일이 ${todayDueCount}개 있어요`
          : '오늘도 차곡차곡'}
      </h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatTile
          label="오늘 할 일"
          value={String(todayDueCount)}
          unit="건"
          note={currentPlan ? undefined : '이번 주 계획 없음'}
        />
        <StatTile
          label="이번 주 진행률"
          value={weekProgress === null ? '–' : String(weekProgress)}
          unit={weekProgress === null ? undefined : '%'}
          bar={{ pct: weekProgress ?? 0, color: 'var(--color-accent-sage)' }}
        />
        <StatTile
          label="연간 목표 평균"
          value={goalAvg === null ? '–' : String(goalAvg)}
          unit={goalAvg === null ? undefined : '%'}
          bar={{ pct: goalAvg ?? 0, color: 'var(--color-primary)' }}
        />
      </div>

      <div className="mt-6 flex flex-col gap-5">
        {currentPlan ? (
          <DashboardPlanPanels
            planHref={`/plans/${currentPlan._id}`}
            planTitle={currentPlan.title}
            weekRange={`${currentPlan.weekStart} ~ ${currentPlan.weekEnd}`}
            initialTasks={currentPlanTasks}
            todayString={todayString}
          />
        ) : (
          <section className="rounded-card border border-hairline bg-canvas p-6">
            <SectionHeading>이번 주 계획</SectionHeading>
            <p className="mt-4 text-sm text-muted">
              {thisWeekStart} 주에 대한 계획이 아직 없습니다.
            </p>
            <form action={createThisWeekPlanAction} className="mt-3">
              <button
                type="submit"
                className="rounded-btn bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-active"
              >
                이번 주 계획 만들기
              </button>
            </form>
          </section>
        )}

        <section className="rounded-card border border-hairline bg-canvas p-6">
          <SectionHeading
            action={
              <Link href="/goals" className="text-sm text-muted hover:text-primary">
                전체 보기
              </Link>
            }
          >
            연간 계획
          </SectionHeading>
          {goals.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              등록된 연간 계획이 없습니다.{' '}
              <Link href="/goals" className="text-primary hover:underline">
                새로 만들기
              </Link>
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3.5">
              {goals.map((goal, index) => {
                const p = goalProgresses[index];
                return (
                  <li key={goal._id}>
                    <Link href={`/goals/${goal._id}`} className="group block">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm text-ink group-hover:text-primary">
                          <span className="font-medium">{goal.title}</span>
                          <span className="ml-2 text-xs text-muted-soft">{goal.year}</span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-body">
                          {p === null ? '하위 계획 없음' : `${p}%`}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-strong">
                        <div
                          className="h-full rounded-full bg-[color:var(--color-accent-sage)]"
                          style={{ width: `${p ?? 0}%` }}
                        />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-card border border-hairline bg-canvas p-6">
          <SectionHeading
            action={
              <Link href="/stats" className="text-sm text-muted hover:text-primary">
                통계 보기
              </Link>
            }
          >
            이번 달 주간 완료율
          </SectionHeading>
          <div className="mt-5 flex items-end gap-4">
            {thisMonthWeekStats.map((week, index) => (
              <div key={week.weekStart} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-[11px] font-semibold tabular-nums text-muted">
                  {week.progress === null ? '–' : `${week.progress}%`}
                </span>
                <div
                  className="flex h-24 w-full items-end overflow-hidden rounded-md bg-surface-strong"
                  title={`${index + 1}째 주 · ${
                    week.progress === null ? '할 일 없음' : `${week.progress}%`
                  }`}
                >
                  <div
                    className="w-full rounded-md bg-[color:var(--color-accent-sage)] transition-all"
                    style={{ height: `${week.progress ?? 0}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted-soft">{index + 1}주</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
