import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createPlan, listPlans } from './plans/actions';
import { findOrCreateMonthlyPlanForMonth } from './monthly-plans/actions';
import { listGoals } from './goals/actions';
import { listTasksByPlan } from './tasks/actions';
import { getMonthWeekStarts, getTodayString, getWeekStart } from '@/lib/date';
import { getYearlyGoalProgress } from '@/lib/progress';
import { getStatsHierarchy } from '@/lib/stats';
import DashboardPlanPanels from '@/components/dashboard/DashboardPlanPanels';
import { requirePageUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function createThisWeekPlanAction() {
  'use server';

  const weekStart = getWeekStart(new Date());
  const monthlyPlanId = await findOrCreateMonthlyPlanForMonth(weekStart.slice(0, 7));
  const plan = await createPlan({ monthlyPlanId, title: '이번 주', weekStart });
  redirect(`/plans/${plan._id}`);
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

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-[28px] font-bold tracking-tight text-ink">대시보드</h1>

      <div className="mt-6 flex flex-col gap-4">
        {currentPlan ? (
          <DashboardPlanPanels
            planHref={`/plans/${currentPlan._id}`}
            planTitle={currentPlan.title}
            weekRange={`${currentPlan.weekStart} ~ ${currentPlan.weekEnd}`}
            initialTasks={currentPlanTasks}
            todayString={todayString}
          />
        ) : (
          <section className="rounded-card border border-hairline p-6">
            <h2 className="text-base font-semibold text-ink">이번 주 계획</h2>
            <p className="mt-3 text-sm text-muted">
              {thisWeekStart} 주에 대한 계획이 아직 없습니다.
            </p>
            <form action={createThisWeekPlanAction} className="mt-3">
              <button
                type="submit"
                className="rounded-btn bg-primary px-4 py-2.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active"
              >
                이번 주 계획 만들기
              </button>
            </form>
          </section>
        )}

        <section className="rounded-card border border-hairline p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">연간 계획</h2>
            <Link href="/goals" className="text-sm text-muted hover:underline">
              전체 보기
            </Link>
          </div>
          {goals.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              등록된 연간 계획가 없습니다.{' '}
              <Link href="/goals" className="text-ink hover:underline">
                새로 만들기
              </Link>
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-hairline">
              {goals.map((goal, index) => (
                <li key={goal._id} className="py-3">
                  <Link
                    href={`/goals/${goal._id}`}
                    className="flex items-center justify-between gap-4 text-ink hover:underline"
                  >
                    <span>
                      <span className="font-medium">{goal.title}</span>
                      <span className="ml-2 text-sm text-muted">{goal.year}</span>
                    </span>
                    <span className="w-28 shrink-0 text-right text-sm text-muted">
                      {goalProgresses[index] === null ? '하위 계획 없음' : `${goalProgresses[index]}%`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-card border border-hairline p-6">
          <h2 className="text-base font-semibold text-ink">이번 달 통계</h2>
          <div className="mt-5 flex items-end gap-5">
            {thisMonthWeekStats.map((week, index) => (
              <div key={week.weekStart} className="flex w-9 flex-col items-center gap-2">
                <span className="text-[11px] font-semibold tabular-nums text-muted">
                  {week.progress === null ? '–' : `${week.progress}%`}
                </span>
                <div
                  className="flex h-24 w-full items-end overflow-hidden rounded-full bg-surface-strong"
                  title={`${index + 1}째 주 · ${
                    week.progress === null ? '할 일 없음' : `${week.progress}%`
                  }`}
                >
                  <div
                    className="w-full rounded-full bg-primary transition-all"
                    style={{ height: `${week.progress ?? 0}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted">{index + 1}주</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-card border border-hairline p-6">
          <Link href="/stats" className="text-base font-semibold text-ink hover:underline">
            통계 보기 →
          </Link>
        </section>
      </div>
    </main>
  );
}
