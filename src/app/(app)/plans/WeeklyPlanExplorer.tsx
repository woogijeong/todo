'use client';

import { useState } from 'react';
import { addDays, getMonthWeekStarts, getTodayString } from '@/lib/date';
import { openWeekBoard } from './week-actions';

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
    <div className="mt-8">
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => setMonthCursor((m) => shiftMonth(m, -1))}
          aria-label="이전 달"
          className="rounded-btn px-3 py-1 text-lg text-muted hover:bg-surface-soft"
        >
          ‹
        </button>
        <p className="text-lg font-semibold text-ink">{monthLabel(monthCursor)}</p>
        <button
          type="button"
          onClick={() => setMonthCursor((m) => shiftMonth(m, 1))}
          aria-label="다음 달"
          className="rounded-btn px-3 py-1 text-lg text-muted hover:bg-surface-soft"
        >
          ›
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2">
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
                className={`w-full rounded-card border p-4 text-left transition-colors hover:border-border-strong hover:shadow-float ${
                  isThisWeek ? 'border-ink' : 'border-hairline'
                }`}
              >
                <p className="text-xs font-medium text-muted-soft">
                  {index + 1}째 주
                  {isThisWeek && <span className="ml-1.5 text-primary">이번 주</span>}
                  {!plan && <span className="ml-1.5 text-muted-soft">· 계획 없음</span>}
                </p>
                <p className="mt-0.5 font-medium text-ink">{label}</p>
                <p className="mt-0.5 text-sm text-muted">
                  {weekStart} ~ {weekEnd}
                </p>
                {plan && (
                  <div className="mt-2">
                    {plan.progress === null ? (
                      <p className="text-xs text-muted-soft">할 일 없음</p>
                    ) : (
                      <div className="h-1.5 w-full rounded-full bg-surface-strong">
                        <div
                          className="h-1.5 rounded-full bg-primary"
                          style={{ width: `${plan.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}
