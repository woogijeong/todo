'use client';

import { useMemo, useState } from 'react';
import { updateTaskStatus } from '@/app/(app)/tasks/status-actions';
import type { Task, TaskStatus } from '@/lib/schemas';

// Not imported from '@/lib/progress': that module's top-level `import {
// getDb } from './mongodb'` would bundle the mongodb driver into this
// Client Component. Mirrors TaskBoard.tsx's own copy of this exact
// function, kept for the same reason.
function computeProgress(statuses: TaskStatus[]): number | null {
  const total = statuses.length;
  if (total === 0) return null;
  const done = statuses.filter((s) => s === 'done').length;
  return Math.floor((done / total) * 100);
}

type Props = {
  initialTasks: Task[];
};

export default function WeekChecklist({ initialTasks }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [error, setError] = useState<string | null>(null);

  const progress = useMemo(
    () => computeProgress(tasks.map((t) => t.status)),
    [tasks]
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
    <div className="mt-2">
      {progress === null ? (
        <p className="text-sm text-muted-soft">할 일 없음</p>
      ) : (
        <div>
          <div className="h-2 w-full rounded-full bg-surface-strong">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-sm text-muted">{progress}%</p>
        </div>
      )}

      {tasks.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
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

      {error && <p className="mt-2 text-xs text-error">{error}</p>}
    </div>
  );
}
