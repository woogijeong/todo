'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { updateTaskStatus } from '@/app/(app)/tasks/status-actions';
import { createTask, deleteTask } from '@/app/(app)/tasks/actions';
import type { Task, TaskStatus } from '@/lib/schemas';
import { getTodayString, getWeekDates, getWeekdayLabel } from '@/lib/date';
import { getDueBadge } from '@/lib/due-status';
import { notifyDueTask, requestNotificationPermission } from '@/lib/notify';

// Not imported from '@/lib/progress': that module's top-level `import {
// getDb } from './mongodb'` establishes a MongoDB connection as a module
// side effect, so pulling it into this Client Component bundles the mongodb
// driver (and Node built-ins like 'child_process'/'dns') for the browser and
// breaks the production build. Mirrors `computeProgress` exactly — same
// floor(done/total*100), same null-on-empty behavior.
function computeProgress(statuses: TaskStatus[]): number | null {
  const total = statuses.length;
  if (total === 0) return null;
  const done = statuses.filter((s) => s === 'done').length;
  return Math.floor((done / total) * 100);
}

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: '할 일' },
  { status: 'doing', label: '진행 중' },
  { status: 'done', label: '완료' },
];

type Props = {
  planId: string;
  initialTasks: Task[];
  weekStart: string;
};

export default function TaskBoard({ planId, initialTasks, weekStart }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [adding, setAdding] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(
    'default'
  );

  const today = getTodayString();

  useEffect(() => {
    // Deliberately effect + setState, not a lazy useState initializer: this
    // Client Component is still server-rendered for the initial HTML, where
    // `window`/`Notification` don't exist. Starting both server and client
    // renders from the same literal ('default') and correcting it here,
    // strictly after mount, is what keeps hydration output identical and
    // avoids a hydration mismatch — the cascading-render cost the lint rule
    // warns about is an acceptable, one-time tradeoff for that correctness.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotifPermission(
      typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
    );
  }, []);

  // Tab-open-only: fires whenever the task list changes (initial load, after
  // a status update) for any task whose due badge is '오늘 마감'/'지연' and that
  // isn't 'done' (getDueBadge already returns null for done tasks). Each
  // call is itself deduped per task-per-day via localStorage inside
  // notifyDueTask, and this whole effect no-ops unless permission is already
  // 'granted' (never requests permission here — that only happens from the
  // button's onClick, per the user-gesture requirement).
  useEffect(() => {
    if (notifPermission !== 'granted') return;
    for (const task of tasks) {
      const badge = getDueBadge(task.dueDate, task.status, today);
      if (!badge) continue;
      notifyDueTask(task._id, `"${task.title}" ${badge}`, today, badge);
    }
  }, [tasks, notifPermission, today]);

  async function enableNotifications() {
    const result = await requestNotificationPermission();
    setNotifPermission(result);
  }

  const sensors = useSensors(
    // A minimum drag distance before a pointer drag "activates" means a
    // vertical swipe that never travels 8px horizontally/vertically first
    // is left alone and falls through to native touch scrolling, instead of
    // dnd-kit hijacking every touchstart on a card.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const progress = useMemo(
    () => computeProgress(tasks.map((t) => t.status)),
    [tasks]
  );

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  async function changeStatus(taskId: string, newStatus: TaskStatus) {
    const previous = tasks;
    const current = tasks.find((t) => t._id === taskId);
    if (!current || current.status === newStatus) return;

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

  async function addTask(e: FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title || adding) return;

    setAdding(true);
    setError(null);
    try {
      const created = await createTask({
        weeklyPlanId: planId,
        title,
        status: 'todo',
        dueDate: newDueDate || today,
      });
      setTasks((prev) => [...prev, created]);
      setNewTitle('');
      setNewDueDate('');
    } catch {
      setError('할 일 추가에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setAdding(false);
    }
  }

  async function removeTask(taskId: string) {
    const target = tasks.find((t) => t._id === taskId);
    if (!target) return;

    const confirmed = window.confirm(`'${target.title}' 할 일을 삭제하시겠습니까?`);
    if (!confirmed) return;

    const previous = tasks;
    setTasks((prev) => prev.filter((t) => t._id !== taskId));
    setError(null);

    try {
      await deleteTask(taskId);
    } catch {
      setTasks(previous);
      setError('할 일 삭제에 실패했습니다. 다시 시도해 주세요.');
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    // `over.id` is a column status when dropped on empty column space, but
    // a task id when dropped on top of another card (SortableContext makes
    // cards themselves droppable targets too) — resolve either case back to
    // a target column status.
    const overId = String(over.id);
    const isColumnId = COLUMNS.some((c) => c.status === overId);
    const newStatus = isColumnId
      ? (overId as TaskStatus)
      : tasks.find((t) => t._id === overId)?.status;
    if (!newStatus) return;

    void changeStatus(taskId, newStatus);
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <ProgressBar progress={progress} />
        </div>
        {notifPermission === 'default' && (
          <button
            type="button"
            onClick={enableNotifications}
            className="whitespace-nowrap rounded-btn border border-hairline px-2 py-1 text-xs text-muted hover:bg-surface-soft"
          >
            마감 알림 켜기
          </button>
        )}
        {notifPermission === 'denied' && (
          <span className="whitespace-nowrap text-xs text-muted-soft">알림이 차단되어 있습니다</span>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-between rounded-btn border border-[#f0c9c0] bg-[#fdecec] px-3 py-2 text-sm text-error">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-4 text-error hover:text-error"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={addTask} className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="새 할 일 제목"
          aria-label="새 할 일 제목"
          className="min-w-[10rem] flex-1 rounded-btn border border-hairline px-2 py-1.5 text-sm"
        />
        <input
          type="date"
          value={newDueDate}
          onChange={(e) => setNewDueDate(e.target.value)}
          aria-label="기한"
          className="rounded-btn border border-hairline px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={adding || !newTitle.trim()}
          className="rounded-btn bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
        >
          추가
        </button>
      </form>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {COLUMNS.map((col) => (
            <Column
              key={col.status}
              status={col.status}
              label={col.label}
              tasks={tasks.filter((t) => t.status === col.status)}
              onChangeStatus={changeStatus}
              onDelete={removeTask}
              today={today}
            />
          ))}
        </div>
      </DndContext>

      <WeekCalendar
        tasks={tasks}
        weekDates={weekDates}
        today={today}
        onChangeStatus={changeStatus}
      />
    </div>
  );
}

function ProgressBar({ progress }: { progress: number | null }) {
  if (progress === null) {
    return <p className="text-sm text-muted-soft">할 일 없음</p>;
  }
  return (
    <div>
      <div className="flex items-center justify-between text-sm text-muted">
        <span>진행률</span>
        <span>{progress}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-surface-strong">
        <div
          className="h-1.5 rounded-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

/**
 * "날짜별 보기": a week calendar that stays beside the task list. Picking a
 * day filters the list to just that day's tasks; "전체" shows every day.
 */
function WeekCalendar({
  tasks,
  weekDates,
  today,
  onChangeStatus,
}: {
  tasks: Task[];
  weekDates: string[];
  today: string;
  onChangeStatus: (taskId: string, newStatus: TaskStatus) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, Task[]>(weekDates.map((date) => [date, []]));
    const unscheduled: Task[] = [];
    for (const task of tasks) {
      const bucket = task.dueDate ? map.get(task.dueDate) : undefined;
      if (bucket) {
        bucket.push(task);
      } else {
        unscheduled.push(task);
      }
    }
    return { map, unscheduled };
  }, [tasks, weekDates]);

  const selectedTasks = selected ? byDate.map.get(selected) ?? [] : [];

  return (
    <div className="mt-8">
      <h2 className="text-sm font-semibold text-muted">날짜별 보기</h2>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row">
        <div className="flex shrink-0 gap-2 overflow-x-auto pb-1 sm:w-44 sm:flex-col sm:overflow-visible sm:pb-0">
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-pressed={selected === null}
            className={`shrink-0 rounded-btn px-3 py-2 text-sm transition-colors ${
              selected === null
                ? 'bg-ink text-white'
                : 'border border-hairline text-muted hover:bg-surface-soft'
            }`}
          >
            전체
          </button>
          {weekDates.map((date) => {
            const count = byDate.map.get(date)?.length ?? 0;
            const isSelected = selected === date;
            const isToday = date === today;
            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelected(date)}
                aria-pressed={isSelected}
                className={`flex shrink-0 items-center justify-between gap-2 rounded-btn px-3 py-2 text-sm transition-colors ${
                  isSelected
                    ? 'bg-ink text-white'
                    : `border ${isToday ? 'border-ink' : 'border-hairline'} text-body hover:bg-surface-soft`
                }`}
              >
                <span className="whitespace-nowrap">
                  {Number(date.slice(8, 10))}일 ({getWeekdayLabel(date)})
                  {isToday && !isSelected && (
                    <span className="ml-1 text-[11px] text-ink">오늘</span>
                  )}
                </span>
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 text-[11px] ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-surface-strong text-muted'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="min-w-0 flex-1">
          {selected === null ? (
            <div className="flex flex-col gap-2">
              {weekDates.map((date) => (
                <DayRow
                  key={date}
                  date={date}
                  tasks={byDate.map.get(date) ?? []}
                  isToday={date === today}
                  onChangeStatus={onChangeStatus}
                />
              ))}
              {byDate.unscheduled.length > 0 && (
                <div className="rounded-card border border-dashed border-hairline p-3">
                  <p className="text-sm font-medium text-muted">날짜 미정</p>
                  <DayTaskList tasks={byDate.unscheduled} onChangeStatus={onChangeStatus} />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-card border border-hairline p-4">
              <p className="text-sm font-medium text-body">
                {selected} ({getWeekdayLabel(selected)})
                {selected === today && (
                  <span className="ml-1.5 text-xs font-normal text-ink">오늘</span>
                )}
              </p>
              {selectedTasks.length === 0 ? (
                <p className="mt-1 text-xs text-muted-soft">이 날짜에 할 일이 없습니다.</p>
              ) : (
                <DayTaskList tasks={selectedTasks} onChangeStatus={onChangeStatus} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DayRow({
  date,
  tasks,
  isToday,
  onChangeStatus,
}: {
  date: string;
  tasks: Task[];
  isToday: boolean;
  onChangeStatus: (taskId: string, newStatus: TaskStatus) => void;
}) {
  const weekday = getWeekdayLabel(date);

  return (
    <div className={`rounded-card border p-3 ${isToday ? 'border-ink' : 'border-hairline'}`}>
      <p className="text-sm font-medium text-body">
        {date} ({weekday})
        {isToday && <span className="ml-1.5 text-xs font-normal text-ink">오늘</span>}
      </p>
      {tasks.length === 0 ? (
        <p className="mt-1 text-xs text-muted-soft">할 일 없음</p>
      ) : (
        <DayTaskList tasks={tasks} onChangeStatus={onChangeStatus} />
      )}
    </div>
  );
}

function DayTaskList({
  tasks,
  onChangeStatus,
}: {
  tasks: Task[];
  onChangeStatus: (taskId: string, newStatus: TaskStatus) => void;
}) {
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {tasks.map((task) => (
        <li key={task._id} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={task.status === 'done'}
            onChange={(e) => onChangeStatus(task._id, e.target.checked ? 'done' : 'todo')}
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
  );
}

function Column({
  status,
  label,
  tasks,
  onChangeStatus,
  onDelete,
  today,
}: {
  status: TaskStatus;
  label: string;
  tasks: Task[];
  onChangeStatus: (taskId: string, newStatus: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  today: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-card border p-3 transition-colors ${
        isOver ? 'border-primary bg-[#fff0f3]' : 'border-hairline bg-surface-soft'
      }`}
    >
      <h2 className="mb-3 text-sm font-semibold text-ink">
        {label} ({tasks.length})
      </h2>
      <SortableContext
        items={tasks.map((t) => t._id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex min-h-[80px] flex-col gap-2">
          {tasks.map((task) => (
            <TaskCard
              key={task._id}
              task={task}
              onChangeStatus={onChangeStatus}
              onDelete={onDelete}
              today={today}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function TaskCard({
  task,
  onChangeStatus,
  onDelete,
  today,
}: {
  task: Task;
  onChangeStatus: (taskId: string, newStatus: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  today: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const dueBadge = getDueBadge(task.dueDate, task.status, today);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-card border border-hairline bg-canvas p-2 transition-shadow hover:shadow-float"
    >
      <div {...attributes} {...listeners} className="cursor-grab touch-none">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-ink">{task.title}</p>
          {dueBadge && (
            <span
              className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                dueBadge === '지연' ? 'bg-[#fdecec] text-error' : 'bg-amber-100 text-amber-700'
              }`}
            >
              {dueBadge}
            </span>
          )}
        </div>
        {task.description && (
          <p className="mt-1 text-xs text-muted">{task.description}</p>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1">
        <select
          value={task.status}
          onChange={(e) => onChangeStatus(task._id, e.target.value as TaskStatus)}
          className="w-full rounded-btn border border-hairline px-1 py-1 text-xs"
          aria-label="상태 변경"
        >
          {COLUMNS.map((col) => (
            <option key={col.status} value={col.status}>
              {col.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onDelete(task._id)}
          className="shrink-0 rounded-btn px-1.5 py-1 text-xs text-muted-soft hover:bg-[#fdecec] hover:text-error"
          aria-label="할 일 삭제"
          title="삭제"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
