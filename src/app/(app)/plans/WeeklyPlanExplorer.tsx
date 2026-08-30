'use client';

import { useState } from 'react';
import { addDays, getMonthWeekStarts, getTodayString } from '@/lib/date';
import { openWeekBoard } from './week-actions';
import ProgressRing from '@/components/ui/ProgressRing';

type PlanSummary = {
  _id: string;
  weekStart: string;
  weekEnd: string;
  title: string;
  progress: number | null;
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function shiftMonth(monthCursor: string, delta: number): string {
  const [year, month] = monthCursor.split('-').map(Number);
  const total = year * 12 + (month - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

function monthLabel(monthCursor: string): string {
  const [year, month] = monthCursor.split('-');
  return `${year}년 ${Number(month)}월`;
}

export default function WeeklyPlanExplorer({ plans }: { plans: PlanSummary[] }) {
  const todayStr = getTodayString();
  const [monthCursor, setMonthCursor] = useState(todayStr.slice(0, 7));

  const planByWeekStart = new Map(plans.map((p) => [p.weekStart, p]));
  const weekStarts = getMonthWeekStarts(monthCursor);
  const thisWeekStart = weekStarts.find(
    (w) => todayStr >= w && todayStr <= addDays(w, 6)
  );

  return (
    <div className="mt-7">
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setMonthCursor((m) => shiftMonth(m, -1))}
          aria-label="이전 달"
          className="flex rounded-btn p-1.5 text-muted-soft hover:bg-surface-soft hover:text-ink"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 6-6 6 6 6" /></svg>
        </button>
        <p className="text-lg font-bold tracking-tight text-ink">{monthLabel(monthCursor)}</p>
        <button
          type="button"
          onClick={() => setMonthCursor((m) => shiftMonth(m, 1))}
          aria-label="다음 달"
          className="flex rounded-btn p-1.5 text-muted-soft hover:bg-surface-soft hover:text-ink"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
        </button>
      </div>

      <div className="mt-5 flex flex-col gap-2.5">
        {weekStarts.map((weekStart, index) => {
          const plan = planByWeekStart.get(weekStart);
          const weekEnd = addDays(weekStart, 6);
          const label = plan?.title ?? `${index + 1}째 주`;
          const isThisWeek = weekStart === thisWeekStart;
          return (
            <form
              key={weekStart}
              action={openWeekBoard.bind(null, weekStart, label)}
              onSubmit={
                plan
                  ? undefined
                  : (e) => {
                      if (!window.confirm(`${weekStart} 주의 계획을 새로 만들까요?`)) {
                        e.preventDefault();
                      }
                    }
              }
            >
              <button
                type="submit"
                className={`flex w-full items-center gap-4 rounded-card border p-4 text-left transition-shadow hover:shadow-float ${
                  isThisWeek
                    ? 'border-l-4 border-hairline border-l-primary bg-canvas'
                    : plan
                      ? 'border-hairline bg-canvas'
                      : 'border-dashed border-border-strong bg-surface-soft'
                }`}
              >
                {plan ? (
                  <ProgressRing value={plan.progress} size={48} stroke={5} />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center text-border-strong">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4M12 13v4M10 15h4" /></svg>
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-soft">
                    {index + 1}째 주
                    {isThisWeek && <span className="ml-1.5 text-primary">이번 주</span>}
                    {!plan && <span className="ml-1.5">· 계획 없음</span>}
                  </p>
                  <p className={`mt-0.5 font-semibold ${plan ? 'text-ink' : 'text-body'}`}>
                    {label}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-soft">
                    {weekStart} ~ {weekEnd}
                  </p>
                </div>
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}
