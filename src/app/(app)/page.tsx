import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createPlan, listPlans } from './plans/actions';
import { listGoals } from './goals/actions';
import { listTasksByPlan } from './tasks/actions';
import { getTodayString, getWeekStart, getWeekdayLabel } from '@/lib/date';
import { getYearlyGoalProgress } from '@/lib/progress';
import DashboardPlanPanels from '@/components/dashboard/DashboardPlanPanels';
import GoalCelebrationWatcher from '@/components/celebration/GoalCelebrationWatcher';
import GaugeBar from '@/components/ui/GaugeBar';
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
  const plan = await createPlan({ yearlyGoalId: null, title: '이번 주', weekStart });
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

  const [plans, goals] = await Promise.all([listPlans(), listGoals()]);

  const currentPlan = plans.find((plan) => plan.weekStart === thisWeekStart) ?? null;
  const [currentPlanTasks, goalProgresses] = await Promise.all([
    currentPlan ? listTasksByPlan(currentPlan._id) : Promise.resolve([]),
    Promise.all(goals.map((goal) => getYearlyGoalProgress(goal._id))),
  ]);

  const planGoal = currentPlan?.yearlyGoalId
    ? goals.find((g) => g._id === currentPlan.yearlyGoalId) ?? null
    : null;

  const todayString = getTodayString();
  const weekProgress = computeProgress(currentPlanTasks.map((t) => t.status));
  const todayDueCount = currentPlanTasks.filter(
    (t) => t.dueDate === todayString && t.status !== 'done'
  ).length;
  const goalAvg = (() => {
    const vals = goalProgresses.filter((p): p is number => p !== null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  })();

  const [, month, day] = todayString.split('-').map(Number);

  const goalsCard = (
    <section className="rounded-card border border-dashed border-border-strong bg-surface-soft p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-bold text-body">연간 목표</p>
        <Link href="/goals" className="text-xs text-muted hover:text-primary">
          전체 보기
        </Link>
      </div>
      {goals.length === 0 ? (
        <p className="mt-3 text-xs text-muted">
          <Link href="/goals" className="text-primary hover:underline">
            목표 만들기
          </Link>
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {goals.slice(0, 4).map((goal, index) => {
            const p = goalProgresses[index];
            return (
              <li key={goal._id}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate text-body">{goal.title}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-ink">
                    {p === null ? '–' : `${p}%`}
                  </span>
                </div>
                <GaugeBar value={p} trackClassName="mt-1 h-1" />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  return (
    <>
      <GoalCelebrationWatcher
        goals={goals.map((g, i) => ({ id: g._id, progress: goalProgresses[i] }))}
      />
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

      <div className="mt-6">
        {currentPlan ? (
          <DashboardPlanPanels
            planHref={`/plans/${currentPlan._id}`}
            planTitle={currentPlan.title}
            weekRange={`${currentPlan.weekStart} ~ ${currentPlan.weekEnd}`}
            initialTasks={currentPlanTasks}
            todayString={todayString}
            goalTitle={planGoal?.title ?? null}
          >
            {goalsCard}
          </DashboardPlanPanels>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
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
            {goalsCard}
          </div>
        )}
      </div>
    </>
  );
}
