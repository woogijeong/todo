import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createPlan, listPlans } from './plans/actions';
import { findOrCreateMonthlyPlanForMonth } from './monthly-plans/actions';
import { listGoals } from './goals/actions';
import { listTasksByPlan } from './tasks/actions';
import { getMonthWeekStarts, getTodayString, getWeekStart } from '@/lib/date';
import { getYearlyGoalProgress } from '@/lib/progress';
import { getStatsHierarchy } from '@/lib/stats';
import WeekChecklist from '@/components/dashboard/WeekChecklist';
import { requirePageUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Cycled by week index in the monthly bar chart below, so each week reads as
// a distinct bar rather than one undifferentiated blue block. Written out as
// literal class strings (not built from a template) so Tailwind's content
// scanner can find them.
const WEEK_BAR_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-rose-500',
  'bg-cyan-500',
];

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

  const thisMonth = getTodayString().slice(0, 7);
  const thisMonthStat = months.find((m) => m.month === thisMonth) ?? null;
  const thisMonthWeekStats = getMonthWeekStarts(thisMonth).map((weekStart) => ({
    weekStart,
    progress: thisMonthStat?.weeks.find((w) => w.weekStart === weekStart)?.progress ?? null,
  }));

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold">대시보드</h1>

      <div className="mt-6 flex flex-col gap-4">
        <section className="rounded border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-500">이번 주 계획</h2>
          {currentPlan ? (
            <div className="mt-3">
              <Link href={`/plans/${currentPlan._id}`} className="font-medium hover:underline">
                {currentPlan.title}
              </Link>
              <p className="text-sm text-gray-500">
                {currentPlan.weekStart} ~ {currentPlan.weekEnd}
              </p>
              <WeekChecklist initialTasks={currentPlanTasks} />
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-sm text-gray-500">
                {thisWeekStart} 주에 대한 계획이 아직 없습니다.
              </p>
              <form action={createThisWeekPlanAction} className="mt-3">
                <button
                  type="submit"
                  className="rounded bg-black px-3 py-1.5 text-sm text-white"
                >
                  이번 주 계획 만들기
                </button>
              </form>
            </div>
          )}
        </section>

        <section className="rounded border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-500">연간 계획</h2>
            <Link href="/goals" className="text-xs text-blue-600 hover:underline">
              전체 보기
            </Link>
          </div>
          {goals.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">
              등록된 연간 계획가 없습니다.{' '}
              <Link href="/goals" className="text-blue-600 hover:underline">
                새로 만들기
              </Link>
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-200">
              {goals.map((goal, index) => (
                <li key={goal._id} className="py-3">
                  <Link
                    href={`/goals/${goal._id}`}
                    className="flex items-center justify-between gap-4 hover:underline"
                  >
                    <span>
                      <span className="font-medium">{goal.title}</span>
                      <span className="ml-2 text-sm text-gray-500">{goal.year}</span>
                    </span>
                    <span className="w-28 shrink-0 text-right text-sm text-gray-600">
                      {goalProgresses[index] === null ? '하위 계획 없음' : `${goalProgresses[index]}%`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-500">이번 달 통계</h2>
          <div className="mt-4 flex h-20 items-end gap-3">
            {thisMonthWeekStats.map((week, index) => (
              <div
                key={week.weekStart}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              >
                <div className="flex h-full w-full items-end">
                  <div
                    className={`w-full rounded-t ${WEEK_BAR_COLORS[index % WEEK_BAR_COLORS.length]}`}
                    style={{ height: `${week.progress ?? 0}%` }}
                    title={`${index + 1}째 주 · ${
                      week.progress === null ? '할 일 없음' : `${week.progress}%`
                    }`}
                  />
                </div>
                <span className="text-[10px] text-gray-500">{index + 1}주</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded border border-gray-200 p-4">
          <Link href="/stats" className="text-sm font-semibold text-gray-500 hover:underline">
            통계 보기 →
          </Link>
        </section>
      </div>
    </main>
  );
}
