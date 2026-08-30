'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { updateTaskStatus } from '@/app/(app)/tasks/status-actions';
import type { Task, TaskStatus } from '@/lib/schemas';
import { celebrateOnce } from '@/lib/celebrate';
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
  goalTitle: string | null;
  children?: ReactNode;
};

/**
 * The dashboard's "오늘 마감이 가까운 순 / 이번 주 계획" panels. One shared task
 * list backs both, so checking a task off on the left immediately updates the
 * week progress dial and strikes it through on the right.
 */
export default function DashboardPlanPanels({
  planHref,
  planTitle,
  weekRange,
  initialTasks,
  todayString,
  goalTitle,
  children,
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
  const doingCount = useMemo(
    () => tasks.filter((t) => t.status === 'doing').length,
    [tasks]
  );
  const remainingCount = tasks.length - doneCount - doingCount;

  const todayTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.dueDate === todayString)
        .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')),
    [tasks, todayString]
  );
  const noDueTasks = useMemo(
    () => tasks.filter((t) => !t.dueDate),
    [tasks]
  );

  async function toggle(taskId: string, checked: boolean) {
    const previous = tasks;
    const newStatus: TaskStatus = checked ? 'done' : 'todo';
    const optimistic = previous.map((t) =>
      t._id === taskId ? { ...t, status: newStatus } : t
    );
    setTasks(optimistic);
    setError(null);
    try {
      const updated = await updateTaskStatus(taskId, newStatus);
      const settled = optimistic.map((t) => (t._id === taskId ? updated : t));
      setTasks(settled);
      // "하루 목표" — celebrate when every task due today is done, and clear the
      // marker whenever that stops being true so re-completing re-celebrates.
      const todays = settled.filter((t) => t.dueDate === todayString);
      celebrateOnce(
        `day.${todayString}`,
        todays.length > 0 && todays.every((t) => t.status === 'done'),
        'day'
      );
    } catch {
      setTasks(previous);
      setError('상태 변경에 실패했습니다. 다시 시도해 주세요.');
    }
  }

  function taskRow(task: Task) {
    return (
      <li key={task._id} className="flex items-start gap-3">
        <PaperCheck
          checked={task.status === 'done'}
          onChange={(checked) => toggle(task._id, checked)}
          label={`${task.title} 완료 여부`}
        />
        <span
          className={`text-sm leading-snug ${
            task.status === 'done' ? 'text-muted-soft line-through' : 'text-ink'
          }`}
        >
          {task.title}
        </span>
        {goalTitle && (
          <span className="ml-auto shrink-0 rounded-full bg-surface-strong px-2 py-0.5 text-[11px] text-muted">
            {goalTitle}
          </span>
        )}
      </li>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <section className="rounded-card border border-hairline bg-canvas p-6">
        <SectionHeading>오늘 · 마감이 가까운 순</SectionHeading>
        <div className="mt-4">
          {todayTasks.length === 0 ? (
            <p className="text-sm text-muted-soft">오늘 마감인 할 일이 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-3">{todayTasks.map(taskRow)}</ul>
          )}
        </div>

        {noDueTasks.length > 0 && (
          <div className="mt-6 border-t border-hairline-soft pt-4">
            <SectionHeading as="h3" tone="muted">
              이번 주 안에 · 마감일 없음
            </SectionHeading>
            <ul className="mt-3 flex flex-col gap-3">{noDueTasks.map(taskRow)}</ul>
          </div>
        )}

        {error && <p className="mt-3 text-xs text-error">{error}</p>}
      </section>

      <div className="flex flex-col gap-5">
        <section className="rounded-card border border-hairline bg-canvas p-6">
          <SectionHeading tone="sage">이번 주 계획</SectionHeading>
          <div className="mt-4 flex items-center gap-4">
            <ProgressRing value={weekProgress} size={64} />
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
              {tasks.length > 0 && (
                <p className="text-xs text-muted-soft">
                  진행 중 {doingCount} · 남음 {remainingCount}
                </p>
              )}
            </div>
          </div>
          <Link
            href={planHref}
            className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            보드 열기
            <span aria-hidden>→</span>
          </Link>
        </section>

        {children}
      </div>
    </div>
  );
}
