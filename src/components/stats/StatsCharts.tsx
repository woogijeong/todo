import type { StatsSnapshot } from '@/lib/stats';

/**
 * The stats page's three charts, rendered as a server component from a single
 * live snapshot. Each chart uses one hue (sage for "how much", terracotta for
 * the current/aggregate emphasis) over a faint hairline axis — see the app's
 * dataviz conventions.
 */
export default function StatsCharts({ snapshot }: { snapshot: StatsSnapshot }) {
  const { weekly, daily, goals, dailyAvg, totalDone } = snapshot;

  if (weekly.length === 0) {
    return <p className="mt-10 text-sm text-muted">등록된 주간 계획이 없습니다.</p>;
  }

  const weeklyValues = weekly
    .map((w) => w.progress)
    .filter((p): p is number => p !== null);
  const weeklyAvg = weeklyValues.length
    ? Math.round(weeklyValues.reduce((a, b) => a + b, 0) / weeklyValues.length)
    : null;

  const dailyMax = Math.max(1, ...daily.map((d) => d.count));
  const goalMax = Math.max(1, ...goals.map((g) => g.count));

  return (
    <div className="mt-8 flex flex-col gap-5">
      {/* Chart 1 — last 12 weeks weekly completion rate */}
      <section className="rounded-card border border-hairline bg-canvas p-5 sm:p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-bold tracking-tight text-ink">최근 12주 주간 완료율</h2>
          {weeklyAvg !== null && (
            <span className="text-xs text-muted-soft">
              평균 <strong className="font-semibold text-body">{weeklyAvg}%</strong> · 마지막 막대는 진행 중
            </span>
          )}
        </div>

        <div className="relative mt-6 flex h-36 items-end gap-2 border-b border-hairline">
          {weeklyAvg !== null && (
            <div
              className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border-strong"
              style={{ bottom: `${weeklyAvg}%` }}
              aria-hidden
            />
          )}
          {weekly.map((w) => (
            <div key={w.planId} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] font-semibold tabular-nums text-muted-soft">
                {w.progress === null ? '' : `${w.progress}%`}
              </span>
              <div
                className={`w-full rounded-t-[3px] ${
                  w.isCurrent
                    ? 'bg-[color:var(--color-primary)]'
                    : 'bg-[color:var(--color-accent-sage)]'
                }`}
                style={{ height: `${Math.max(w.progress ?? 0, 2)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          {weekly.map((w, i) => (
            <span
              key={w.planId}
              className="flex-1 text-center text-[10px] text-muted-soft"
            >
              {w.isCurrent ? '이번 주' : i % 2 === 0 ? w.label : ''}
            </span>
          ))}
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-[1.3fr_1fr]">
        {/* Chart 2 — last 30 days completed count */}
        <section className="rounded-card border border-hairline bg-canvas p-5 sm:p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-bold tracking-tight text-ink">최근 30일 완료 개수</h2>
            <span className="text-xs text-muted-soft">
              하루 평균 <strong className="font-semibold text-body">{dailyAvg}개</strong>
            </span>
          </div>

          <div className="mt-6 flex h-28 items-end gap-[3px] border-b border-hairline">
            {daily.map((d) => (
              <div
                key={d.date}
                className="flex-1 rounded-t-[2px] bg-[color:var(--color-accent-sage)]"
                style={{ height: `${d.count === 0 ? 3 : (d.count / dailyMax) * 100}%` }}
                title={`${d.label} · ${d.count}개`}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-soft">
            <span>{daily[0]?.label}</span>
            <span>{daily[Math.floor(daily.length / 2)]?.label}</span>
            <span>오늘</span>
          </div>
        </section>

        {/* Chart 3 — cumulative completed per goal */}
        <section className="rounded-card border border-hairline bg-canvas p-5 sm:p-6">
          <h2 className="text-base font-bold tracking-tight text-ink">목표별 누적 완료</h2>
          {goals.length === 0 ? (
            <p className="mt-4 text-sm text-muted">올해 완료한 할 일이 없습니다.</p>
          ) : (
            <ul className="mt-5 flex flex-col gap-4">
              {goals.map((g) => (
                <li key={g.goalId ?? 'none'}>
                  <div className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className={g.goalId === null ? 'text-muted-soft' : 'text-body'}>
                      {g.title}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-ink">{g.count}</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-strong">
                    <div
                      className={`h-full rounded-full ${
                        g.goalId === null
                          ? 'bg-border-strong'
                          : 'bg-[color:var(--color-primary)]'
                      }`}
                      style={{ width: `${(g.count / goalMax) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-5 text-xs text-muted-soft">올해 총 {totalDone}개 완료</p>
        </section>
      </div>
    </div>
  );
}
