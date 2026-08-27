'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { updateTaskStatus } from '@/app/(app)/tasks/status-actions';
import type { Task, TaskStatus } from '@/lib/schemas';

// Not imported from '@/lib/progress' — that module pulls in the mongodb
// driver as a side effect and would break the client bundle. Mirrors
// `computeProgress` exactly.
function computeProgress(statuses: TaskStatus[]): number | null {
  const total = statuses.length;
  if (total === 0) return null;
  return Math.floor((statuses.filter((s) => s === 'done').length / total) * 100);
}

type Props = {
  planHref: string;
  planTitle: string;
  weekRange: string;
  initialTasks: Task[];
  todayString: string;
};

/**
 * The dashboard's split "이번 주 계획 / 오늘의 계획" panels. One shared task
 * list backs both, so checking a task off on the "오늘" side immediately
 * updates the week progress bar and strikes it through on the "이번 주" side.
 * Checkboxes live only on the "오늘" panel — the week panel is a read-only
 * overview.
 */
export default function DashboardPlanPanels({
  planHref,
  planTitle,
  weekRange,
  initialTasks,
  todayString,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [error, setError] = useState<string | null>(null);

  const weekProgress = useMemo(
    () => computeProgress(tasks.map((t) => t.status)),
    [tasks]
  );
  const todayTasks = useMemo(
    () => tasks.filter((t) => t.dueDate === todayString),
    [tasks, todayString]
  );

  async function toggle(taskId: string, checked: boolean) {
    const previous = tasks;
    const newStatus: TaskStatus = checked ? 'done' : 'todo';
    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t))
    );
    setError(null);
    try {
      const updated = await updateTaskStatus(taskId, newStatus);
      setTasks((prev) => prev.map((t) => (t._id === taskId ? updated : t)));
    } catch {
      setTasks(previous);
      setError('상태 변경에 실패했습니다. 다시 시도해 주세요.');
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-card border border-hairline p-6">
        <h2 className="text-base font-semibold text-ink">이번 주 계획</h2>
        <div className="mt-3">
          <Link href={planHref} className="font-medium text-ink hover:underline">
            {planTitle}
          </Link>
          <p className="text-sm text-muted">{weekRange}</p>

          {weekProgress === null ? (
            <p className="mt-2 text-sm text-muted-soft">할 일 없음</p>
          ) : (
            <div className="mt-2">
              <div className="h-2 w-full rounded-full bg-surface-strong">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${weekProgress}%` }}
                />
              </div>
              <p className="mt-1 text-sm text-muted">{weekProgress}%</p>
            </div>
          )}

          {tasks.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {tasks.map((task) => (
                <li
                  key={task._id}
                  className={`text-sm ${
                    task.status === 'done' ? 'text-muted-soft line-through' : 'text-ink'
                  }`}
                >
                  {task.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-card border border-hairline p-6">
        <h2 className="text-base font-semibold text-ink">오늘의 계획</h2>
        <div className="mt-3">
          {todayTasks.length === 0 ? (
            <p className="text-sm text-muted-soft">오늘 할 일이 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {todayTasks.map((task) => (
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
          {error && <p className="mt-2 text-xs text-error">{error}</p>}
        </div>
      </section>
    </div>
  );
}
