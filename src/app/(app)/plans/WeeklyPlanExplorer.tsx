'use client';

import { addDays } from '@/lib/date';
import { openWeekBoard } from './week-actions';
import ProgressRing from '@/components/ui/ProgressRing';

type PlanSummary = {
  _id: string;
  weekStart: string;
  weekEnd: string;
  title: string;
  progress: number | null;
  total: number;
  done: number;
  goalTitle: string | null;
};

function Chevron() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="shrink-0 text-border-strong"
      aria-hidden
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function GoalChip({ title }: { title: string }) {
  return (
    <span className="inline-block rounded-full border border-hairline px-2 py-0.5 text-[11px] text-[color:var(--color-accent-sage)]">
      {title}
    </span>
  );
}

export default function WeeklyPlanExplorer({
  plans,
  thisWeekStart,
}: {
  plans: PlanSummary[];
  thisWeekStart: string;
}) {
  const current = plans.find((p) => p.weekStart === thisWeekStart) ?? null;
  const upcoming = plans
    .filter((p) => p.weekStart > thisWeekStart)
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const past = plans
    .filter((p) => p.weekStart < thisWeekStart)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  const nextWeekStart = addDays(thisWeekStart, 7);

  function boardLink(planId: string, className: string, children: React.ReactNode) {
    return (
      <a href={`/plans/${planId}`} className={className}>
        {children}
      </a>
    );
  }

  return (
    <div className="mt-7 flex flex-col gap-8">
      <div className="flex justify-end">
        <form action={openWeekBoard.bind(null, nextWeekStart, '다음 주')}>
          <button
            type="submit"
            className="rounded-btn border border-primary px-3.5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-surface-strong"
          >
            + 다음 주 계획 만들기
          </button>
        </form>
      </div>

      {/* 이번 주 */}
      <section>
        <p className="mb-3 text-xs font-medium text-muted-soft">이번 주</p>
        {current ? (
          boardLink(
            current._id,
            'flex items-center gap-4 rounded-card border border-l-4 border-hairline border-l-primary bg-canvas p-5 transition-shadow hover:shadow-float',
            <>
              <ProgressRing value={current.progress} size={56} stroke={6} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-soft">
                  {current.weekStart} ~ {current.weekEnd}
                </p>
                <p className="mt-0.5 font-bold text-ink">{current.title}</p>
                {current.goalTitle && (
                  <p className="mt-1.5">
                    <GoalChip title={current.goalTitle} />
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold tabular-nums text-ink">
                  {current.done} / {current.total}
                </p>
                <p className="text-xs text-muted-soft">완료 / 전체</p>
              </div>
              <Chevron />
            </>
          )
        ) : (
          <form
            action={openWeekBoard.bind(null, thisWeekStart, '이번 주')}
            className="block"
          >
            <button
              type="submit"
              className="flex w-full items-center gap-4 rounded-card border border-dashed border-border-strong bg-surface-soft p-5 text-left transition-shadow hover:shadow-float"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center text-border-strong">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4M12 13v4M10 15h4" /></svg>
              </span>
              <div className="flex-1">
                <p className="text-xs text-muted-soft">이번 주 · 계획 없음</p>
                <p className="mt-0.5 font-semibold text-body">이번 주 계획 만들기</p>
              </div>
            </button>
          </form>
        )}
      </section>

      {/* 예정 */}
      {upcoming.length > 0 && (
        <section>
          <p className="mb-3 text-xs font-medium text-muted-soft">예정</p>
          <div className="flex flex-col gap-2.5">
            {upcoming.map((plan) =>
              boardLink(
                plan._id,
                'flex items-center gap-4 rounded-card border border-hairline bg-canvas p-4 transition-shadow hover:shadow-float',
                <>
                  <ProgressRing value={plan.progress} size={44} stroke={5} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{plan.title}</p>
                    <p className="mt-0.5 text-sm text-muted-soft">
                      {plan.weekStart} ~ {plan.weekEnd}
                    </p>
                    {plan.goalTitle && (
                      <p className="mt-1.5">
                        <GoalChip title={plan.goalTitle} />
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm tabular-nums text-muted-soft">
                    {plan.done} / {plan.total}
                  </span>
                  <Chevron />
                </>
              )
            )}
          </div>
        </section>
      )}

      {/* 지난 주 */}
      {past.length > 0 && (
        <section>
          <p className="mb-3 text-xs font-medium text-muted-soft">지난 주</p>
          <div className="flex flex-col gap-2">
            {past.map((plan) =>
              boardLink(
                plan._id,
                'flex items-center gap-4 rounded-card border border-hairline bg-canvas px-5 py-3.5 transition-shadow hover:shadow-float',
                <>
                  <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-surface-strong">
                    <div
                      className="h-full rounded-full bg-[color:var(--color-accent-sage)]"
                      style={{ width: `${plan.progress ?? 0}%` }}
                    />
                  </div>
                  <span className="w-9 shrink-0 text-sm font-semibold tabular-nums text-body">
                    {plan.progress === null ? '–' : `${plan.progress}%`}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{plan.title}</span>
                  <span className="shrink-0 text-xs text-muted-soft">
                    {plan.weekStart.slice(5)} ~ {plan.weekEnd.slice(5)}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-soft">
                    {plan.done} / {plan.total}
                  </span>
                </>
              )
            )}
          </div>
        </section>
      )}
    </div>
  );
}
