import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createGoal, listGoals } from './actions';
import { listPlans } from '../plans/actions';
import { getWeeklyPlanProgress, getYearlyGoalProgress } from '@/lib/progress';
import { getWeekStart } from '@/lib/date';
import GoalCelebrationWatcher from '@/components/celebration/GoalCelebrationWatcher';
import GaugeBar from '@/components/ui/GaugeBar';
import { requirePageUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  await requirePageUser();

  const { year: yearParam } = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = Number.isFinite(Number(yearParam)) && yearParam ? Number(yearParam) : currentYear;

  const [allGoals, allPlans] = await Promise.all([listGoals(), listPlans()]);
  const goals = allGoals.filter((g) => g.year === year);

  const thisWeekStart = getWeekStart(new Date());

  const [goalProgresses, planProgressById] = await Promise.all([
    Promise.all(goals.map((g) => getYearlyGoalProgress(g._id))),
    (async () => {
      const entries = await Promise.all(
        allPlans.map(async (p) => [p._id, await getWeeklyPlanProgress(p._id)] as const)
      );
      return new Map(entries);
    })(),
  ]);

  const goalless = allPlans.filter((p) => p.yearlyGoalId === null);

  async function createGoalAction(formData: FormData) {
    'use server';
    const title = formData.get('title');
    const yearRaw = formData.get('year');
    const description = formData.get('description');

    await createGoal({
      title: typeof title === 'string' ? title : '',
      year: typeof yearRaw === 'string' ? Number(yearRaw) : NaN,
      description:
        typeof description === 'string' && description.trim() ? description : undefined,
    });

    revalidatePath('/goals');
  }

  return (
    <>
      <GoalCelebrationWatcher
        goals={goals.map((g, i) => ({ id: g._id, progress: goalProgresses[i] }))}
      />
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-4">
          <h1 className="text-[26px] font-bold tracking-tight text-ink">연간 목표</h1>
          <div className="flex items-center gap-2 text-muted-soft">
            <Link
              href={`/goals?year=${year - 1}`}
              aria-label="이전 연도"
              className="flex rounded-btn p-1 hover:bg-surface-soft hover:text-ink"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 6-6 6 6 6" /></svg>
            </Link>
            <span className="text-lg font-semibold text-ink tabular-nums">{year}</span>
            <Link
              href={`/goals?year=${year + 1}`}
              aria-label="다음 연도"
              className="flex rounded-btn p-1 hover:bg-surface-soft hover:text-ink"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
            </Link>
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-sm text-muted-soft">한 해 동안 이루고 싶은 큰 목표</p>

      <form
        action={createGoalAction}
        className="mt-6 flex flex-wrap gap-2 rounded-card border border-hairline bg-canvas p-4"
      >
        <input
          name="title"
          placeholder="목표 제목"
          required
          className="min-w-40 flex-1 rounded-btn border border-hairline bg-page px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
        />
        <input
          name="year"
          type="number"
          aria-label="연도"
          required
          defaultValue={year}
          className="w-24 rounded-btn border border-hairline bg-page px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-btn bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-active"
        >
          추가
        </button>
      </form>

      {goals.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{year}년에 등록된 목표가 없습니다.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {goals.map((goal, index) => {
            const progress = goalProgresses[index];
            const childPlans = allPlans
              .filter((p) => p.yearlyGoalId === goal._id)
              .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
            return (
              <Link
                key={goal._id}
                href={`/goals/${goal._id}`}
                className="flex flex-col rounded-card border border-hairline bg-canvas p-5 transition-shadow hover:shadow-float"
              >
                <p className="font-bold text-ink">{goal.title}</p>
                {goal.description && (
                  <p className="mt-1.5 line-clamp-2 text-[13px] text-muted-soft">
                    {goal.description}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-3">
                  <GaugeBar
                    value={progress}
                    trackClassName="h-2.5 flex-1"
                    fillClassName=""
                    fillStyle={{
                      backgroundImage:
                        'repeating-linear-gradient(45deg, var(--color-primary) 0 6px, color-mix(in srgb, var(--color-primary) 62%, #fff) 6px 12px)',
                    }}
                  />
                  <span className="shrink-0 text-lg font-bold tabular-nums text-ink">
                    {progress === null ? '–' : `${progress}%`}
                  </span>
                </div>

                <p className="mt-4 text-xs text-muted-soft">
                  주간 계획 {childPlans.length}개 · 평균 진행률
                </p>
                {childPlans.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {childPlans.slice(0, 4).map((plan) => {
                      const p = planProgressById.get(plan._id) ?? null;
                      return (
                        <li key={plan._id} className="flex items-center gap-2 text-[13px]">
                          <div className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-surface-strong">
                            <div
                              className="h-full rounded-full bg-[color:var(--color-accent-sage)]"
                              style={{ width: `${p ?? 0}%` }}
                            />
                          </div>
                          <span className="min-w-0 flex-1 truncate text-body">
                            {plan.title}
                            {plan.weekStart === thisWeekStart && (
                              <span className="text-muted-soft"> · 이번 주</span>
                            )}
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-soft">
                            {p === null ? '–' : `${p}%`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {goalless.length > 0 && (
        <Link
          href="/plans"
          className="mt-4 flex items-center justify-between gap-3 rounded-card border border-dashed border-border-strong bg-surface-soft p-4 transition-shadow hover:shadow-float"
        >
          <div>
            <p className="text-sm font-bold text-body">상위 목표 없는 주간 계획</p>
            <p className="mt-0.5 text-[13px] text-muted-soft">
              목표에 연결되지 않은 주간 계획이 {goalless.length}개 있어요. 이 계획의 진행률은 어느
              목표 평균에도 포함되지 않습니다.
            </p>
          </div>
          <span className="shrink-0 text-sm text-primary">연결하기 →</span>
        </Link>
      )}
    </>
  );
}
