'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { addDays, getMonthWeekStarts, getTodayString, getWeekdayLabel } from '@/lib/date';
import { listTasksByPlan } from '@/app/(app)/tasks/actions';
import { updateTaskStatus } from '@/app/(app)/tasks/status-actions';
import { createTaskForDate } from './day-actions';
import type { Task, TaskStatus } from '@/lib/schemas';

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

function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-4 text-sm text-ink hover:underline">
      ‹ {label}
    </button>
  );
}

export default function WeeklyPlanExplorer({ plans }: { plans: PlanSummary[] }) {
  const todayStr = getTodayString();
  const [monthCursor, setMonthCursor] = useState(todayStr.slice(0, 7));
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const planByWeekStart = new Map(plans.map((p) => [p.weekStart, p]));
  const weekStarts = getMonthWeekStarts(monthCursor);

  if (selectedWeekStart && selectedDate) {
    const plan = planByWeekStart.get(selectedWeekStart) ?? null;
    return (
      <DayPanel
        key={selectedDate}
        date={selectedDate}
        weekStart={selectedWeekStart}
        initialPlanId={plan?._id ?? null}
        onBack={() => setSelectedDate(null)}
      />
    );
  }

  if (selectedWeekStart) {
    const plan = planByWeekStart.get(selectedWeekStart) ?? null;
    const days = Array.from({ length: 7 }, (_, i) => addDays(selectedWeekStart, i));
    return (
      <div className="mt-8">
        <BackLink label={monthLabel(monthCursor)} onClick={() => setSelectedWeekStart(null)} />
        <h2 className="text-sm font-semibold text-muted">
          {plan?.title ?? '새 주간 계획'} · {selectedWeekStart} ~ {addDays(selectedWeekStart, 6)}
        </h2>
        <div className="mt-3 grid grid-cols-7 gap-2">
          {days.map((date) => (
            <button
              key={date}
              type="button"
              onClick={() => setSelectedDate(date)}
              className={`rounded-card border p-3 text-center transition-colors hover:border-border-strong hover:shadow-float ${
                date === todayStr ? 'border-ink' : 'border-hairline'
              }`}
            >
              <p className="text-xs text-muted">{getWeekdayLabel(date)}</p>
              <p className="mt-1 text-lg font-medium">{Number(date.slice(8, 10))}</p>
            </button>
          ))}
        </div>
        {plan && (
          <Link href={`/plans/${plan._id}`} className="mt-4 inline-block text-sm text-ink hover:underline">
            이 주 전체 보드 보기 →
          </Link>
        )}
      </div>
    );
  }

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
          return (
            <button
              key={weekStart}
              type="button"
              onClick={() => setSelectedWeekStart(weekStart)}
              className="rounded-card border border-hairline p-4 text-left transition-colors hover:border-border-strong hover:shadow-float"
            >
              <p className="text-xs font-medium text-muted-soft">{index + 1}째 주</p>
              <p className="mt-0.5 font-medium text-ink">{plan?.title ?? `${index + 1}째 주`}</p>
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
          );
        })}
      </div>
    </div>
  );
}

function DayPanel({
  date,
  weekStart,
  initialPlanId,
  onBack,
}: {
  date: string;
  weekStart: string;
  initialPlanId: string | null;
  onBack: () => void;
}) {
  const [resolvedPlanId, setResolvedPlanId] = useState<string | null>(initialPlanId);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!resolvedPlanId) {
        if (!cancelled) setLoading(false);
        return;
      }
      const all = await listTasksByPlan(resolvedPlanId);
      if (!cancelled) {
        setTasks(all.filter((t) => t.dueDate === date));
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // `loading` intentionally starts true via useState's initial value, not
    // an effect-set call, and stays correct across `date` changes because
    // the parent remounts this component with `key={selectedDate}` — see
    // WeeklyPlanExplorer's DayPanel usage below.
  }, [resolvedPlanId, date]);

  async function toggle(taskId: string, checked: boolean) {
    const previous = tasks;
    const newStatus: TaskStatus = checked ? 'done' : 'todo';
    setTasks((prev) => prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t)));
    setError(null);
    try {
      const updated = await updateTaskStatus(taskId, newStatus);
      setTasks((prev) => prev.map((t) => (t._id === taskId ? updated : t)));
    } catch {
      setTasks(previous);
      setError('상태 변경에 실패했습니다. 다시 시도해 주세요.');
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || pending) return;

    setPending(true);
    setError(null);
    try {
      const { task, weeklyPlanId } = await createTaskForDate(date, trimmed);
      setResolvedPlanId(weeklyPlanId);
      setTasks((prev) => [...prev, task]);
      setTitle('');
    } catch {
      setError('할 일 추가에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-8">
      <BackLink label={`${weekStart} ~ ${addDays(weekStart, 6)}`} onClick={onBack} />
      <h2 className="text-sm font-semibold text-muted">
        {date} ({getWeekdayLabel(date)})
      </h2>

      <form onSubmit={handleAdd} className="mt-3 flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="새 할 일 제목"
          aria-label="새 할 일 제목"
          className="flex-1 rounded-btn border border-hairline px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={pending || !title.trim()}
          className="rounded-btn bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
        >
          추가
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-error">{error}</p>}

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-muted-soft">불러오는 중…</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-soft">할 일 없음</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {tasks.map((task) => (
              <li key={task._id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={task.status === 'done'}
                  onChange={(e) => toggle(task._id, e.target.checked)}
                  aria-label={`${task.title} 완료 여부`}
                  className="h-4 w-4 shrink-0 rounded-btn border-hairline"
                />
                <span
                  className={`text-sm ${
                    task.status === 'done' ? 'text-muted-soft line-through' : 'text-ink'
                  }`}
                >
                  {task.title}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {resolvedPlanId && (
        <Link
          href={`/plans/${resolvedPlanId}`}
          className="mt-4 inline-block text-sm text-ink hover:underline"
        >
          이번 주 전체 보드 보기 →
        </Link>
      )}
    </div>
  );
}
