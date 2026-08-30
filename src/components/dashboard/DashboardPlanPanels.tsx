'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { updateTaskStatus } from '@/app/(app)/tasks/status-actions';
import type { Task, TaskStatus } from '@/lib/schemas';
import ProgressRing from '@/components/ui/ProgressRing';
import PaperCheck from '@/components/ui/PaperCheck';
import SectionHeading from '@/components/ui/SectionHeading';

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
 * The dashboard's split "오늘의 계획 / 이번 주 계획" panels. One shared task
 * list backs both, so checking a task off on the "오늘" side immediately
 * updates the week progress dial and strikes it through on the "이번 주" side.
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
  const doneCount = useMemo(
    () => tasks.filter((t) => t.status === 'done').length,
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
    <div className="grid gap-5 md:grid-cols-2">
      <section className="rounded-card border border-hairline bg-canvas p-6">
        <SectionHeading>오늘의 계획</SectionHeading>
        <div className="mt-4">
          {todayTasks.length === 0 ? (
            <p className="text-sm text-muted-soft">오늘 할 일이 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {todayTasks.map((task) => (
                <li key={task._id} className="flex items-start gap-3">
                  <PaperCheck
                    checked={task.status === 'done'}
                    onChange={(checked) => toggle(task._id, checked)}
                    label={`${task.title} 완료 여부`}
                  />
                  <span
                    className={`text-sm leading-snug ${
                      task.status === 'done'
                        ? 'text-muted-soft line-through'
                        : 'text-ink'
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

      <section className="rounded-card border border-hairline bg-canvas p-6">
        <SectionHeading tone="sage">이번 주 계획</SectionHeading>
        <div className="mt-4 flex items-center gap-4">
          <ProgressRing value={weekProgress} size={60} />
          <div className="min-w-0">
            <Link href={planHref} className="font-semibold text-ink hover:text-primary">
              {planTitle}
            </Link>
            <p className="text-xs text-muted-soft">{weekRange}</p>
            <p className="mt-1 text-xs text-muted">
              {weekProgress === null
                ? '할 일 없음'
                : `${tasks.length}개 중 ${doneCount}개 완료`}
            </p>
          </div>
        </div>

        {tasks.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1.5 border-t border-hairline-soft pt-3">
            {tasks.slice(0, 6).map((task) => (
              <li
                key={task._id}
                className={`text-sm ${
                  task.status === 'done'
                    ? 'text-muted-soft line-through'
                    : 'text-body'
                }`}
              >
                {task.title}
              </li>
            ))}
            {tasks.length > 6 && (
              <li className="text-xs text-muted-soft">외 {tasks.length - 6}개</li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
