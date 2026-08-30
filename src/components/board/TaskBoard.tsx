'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
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
import { createTask, deleteTask, updateTask } from '@/app/(app)/tasks/actions';
import { checkGoalMilestone } from '@/app/(app)/plans/[id]/milestone-actions';
import type { Task, TaskStatus } from '@/lib/schemas';
import { getTodayString, getWeekDates, getWeekdayLabel } from '@/lib/date';
import { getDueBadge } from '@/lib/due-status';
import { celebrateOnce } from '@/lib/celebrate';
import { notifyDueTask, requestNotificationPermission } from '@/lib/notify';
import ProgressRing from '@/components/ui/ProgressRing';
import PaperCheck from '@/components/ui/PaperCheck';

const COLUMN_TONE: Record<TaskStatus, { text: string; border: string }> = {
  todo: { text: 'text-ink', border: 'border-ink' },
  doing: {
    text: 'text-[color:var(--color-accent-sage)]',
    border: 'border-[color:var(--color-accent-sage)]',
  },
  done: { text: 'text-muted-soft', border: 'border-border-strong' },
};

const STICKY_TINTS = ['#eaeadb', '#f2e2cf'];

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
  const [addOpen, setAddOpen] = useState(false);
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

  // The calendar drives which tasks the drag-and-drop board shows. `null` is
  // "전체" — every task in the plan, each card tagged with its date. Pick a
  // day and the board narrows to just that day.
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { byDate, unscheduled } = useMemo(() => {
    const map = new Map<string, Task[]>(weekDates.map((d) => [d, []]));
    const un: Task[] = [];
    for (const task of tasks) {
      const bucket = task.dueDate ? map.get(task.dueDate) : undefined;
      if (bucket) bucket.push(task);
      else un.push(task);
    }
    return { byDate: map, unscheduled: un };
  }, [tasks, weekDates]);

  const boardTasks = selectedDay ? byDate.get(selectedDay) ?? [] : tasks;

  async function changeStatus(taskId: string, newStatus: TaskStatus) {
    const previous = tasks;
    const current = tasks.find((t) => t._id === taskId);
    if (!current || current.status === newStatus) return;

    const optimistic = previous.map((t) =>
      t._id === taskId ? { ...t, status: newStatus } : t
    );
    setTasks(optimistic);
    setError(null);

    try {
      const updated = await updateTaskStatus(taskId, newStatus);
      const settled = optimistic.map((t) => (t._id === taskId ? updated : t));
      setTasks(settled);
      if (newStatus === 'done') void celebrateMilestones(settled);
    } catch {
      setTasks(previous);
      setError('상태 변경에 실패했습니다. 다시 시도해 주세요.');
    }
  }

  // Fired after a task lands in "완료": celebrate once when all of today's due
  // tasks on this plan are done ("하루 목표"), and once when the plan's yearly
  // goal reaches 100%. Each is deduped by a localStorage marker.
  async function celebrateMilestones(list: Task[]) {
    const todays = list.filter((t) => t.dueDate === today);
    if (todays.length > 0 && todays.every((t) => t.status === 'done')) {
      celebrateOnce(`day.${today}`, true, 'day');
    }
    try {
      const milestone = await checkGoalMilestone(planId);
      if (milestone) {
        celebrateOnce(`goal.${milestone.goalId}`, milestone.progress === 100, 'goal');
      }
    } catch {
      /* milestone check is best-effort — never block the status change on it */
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
        dueDate: newDueDate || selectedDay || today,
      });
      setTasks((prev) => [...prev, created]);
      setNewTitle('');
      setNewDueDate('');
      setAddOpen(false);
    } catch {
      setError('할 일 추가에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setAdding(false);
    }
  }

  async function editTask(
    taskId: string,
    patch: { title: string; dueDate: string | null }
  ) {
    const previous = tasks;
    setTasks((prev) =>
      prev.map((t) =>
        t._id === taskId
          ? { ...t, title: patch.title, dueDate: patch.dueDate ?? undefined }
          : t
      )
    );
    setError(null);
    try {
      const updated = await updateTask(taskId, {
        title: patch.title,
        dueDate: patch.dueDate,
      });
      setTasks((prev) => prev.map((t) => (t._id === taskId ? updated : t)));
    } catch {
      setTasks(previous);
      setError('할 일 수정에 실패했습니다. 다시 시도해 주세요.');
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

  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const todayDueCount = tasks.filter(
    (t) => getDueBadge(t.dueDate, t.status, today) === '오늘 마감'
  ).length;

  const addForm = (
    <div className="mt-2.5">
      {addOpen ? (
        <form
          onSubmit={addTask}
          className="flex flex-col gap-1.5 rounded-btn border border-dashed border-border-strong p-2"
        >
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="새 할 일 제목"
            aria-label="새 할 일 제목"
            autoFocus
            className="rounded-btn border border-hairline bg-canvas px-2 py-1.5 text-sm"
          />
          <input
            type="date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            onClick={(e) => e.currentTarget.showPicker?.()}
            aria-label="기한"
            className="rounded-btn border border-hairline bg-canvas px-2 py-1.5 text-xs"
          />
          <div className="flex gap-1.5">
            <button
              type="submit"
              disabled={adding || !newTitle.trim()}
              className="rounded-btn bg-primary px-3 py-1.5 text-xs font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
            >
              추가
            </button>
            <button
              type="button"
              onClick={() => {
                setAddOpen(false);
                setNewTitle('');
                setNewDueDate('');
              }}
              className="rounded-btn border border-hairline px-3 py-1.5 text-xs text-muted hover:bg-surface-soft"
            >
              취소
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="w-full rounded-btn border border-dashed border-border-strong px-3 py-2 text-left text-sm text-muted-soft hover:bg-surface-soft hover:text-ink"
        >
          + 할 일 추가
        </button>
      )}
    </div>
  );

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-2.5">
          <ProgressRing value={progress} size={40} stroke={5} showLabel={false} />
          {progress === null ? (
            <span className="text-sm text-muted-soft">할 일 없음</span>
          ) : (
            <span className="text-sm text-body">
              {tasks.length}개 중 <strong className="font-semibold">{doneCount}개 완료</strong>
              <span className="text-muted-soft"> · {progress}%</span>
            </span>
          )}
        </div>
        {todayDueCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-primary-disabled)] px-2.5 py-0.5 text-xs text-primary">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            오늘 마감 {todayDueCount}건
          </span>
        )}
        <div className="ml-auto">
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
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-between rounded-btn border border-border-strong bg-surface-strong px-3 py-2 text-sm text-error">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-4 flex text-error"
            aria-label="닫기"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-5 sm:flex-row">
        <WeekCalendar
          weekDates={weekDates}
          byDate={byDate}
          today={today}
          selected={selectedDay}
          onSelect={setSelectedDay}
        />

        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-ink">
            {selectedDay ? (
              <>
                {Number(selectedDay.slice(5, 7))}월 {Number(selectedDay.slice(8, 10))}일 (
                {getWeekdayLabel(selectedDay)})
                {selectedDay === today && (
                  <span className="ml-1.5 text-xs font-normal text-primary">오늘</span>
                )}
              </>
            ) : (
              '이번 주 전체'
            )}
          </h2>

          <DndContext
            id="task-board"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {COLUMNS.map((col) => (
                <Column
                  key={col.status}
                  status={col.status}
                  label={col.label}
                  tasks={boardTasks.filter((t) => t.status === col.status)}
                  onChangeStatus={changeStatus}
                  onDelete={removeTask}
                  onEdit={editTask}
                  today={today}
                  showDate={selectedDay === null}
                  footer={col.status === 'todo' ? addForm : undefined}
                />
              ))}
            </div>
          </DndContext>
        </div>
      </div>

      {/* A due-date helper within this plan (tasks with no dueDate, or one
          outside the visible week) — not an "unassigned task" feature; every
          task here still belongs to this weekly plan. */}
      {selectedDay !== null && unscheduled.length > 0 && (
        <button
          type="button"
          onClick={() => setSelectedDay(null)}
          className="mt-6 w-full rounded-card border border-dashed border-hairline p-3 text-left text-sm text-muted hover:bg-surface-soft"
        >
          날짜 미정 {unscheduled.length}개 — 전체 보기에서 날짜를 지정하세요 →
        </button>
      )}
    </div>
  );
}

/**
 * The week calendar that sits beside the board and drives which day it
 * shows. Controlled by the parent: `selected` is `null` for "전체" (board
 * falls back to today), or a 'YYYY-MM-DD' string.
 */
function WeekCalendar({
  weekDates,
  byDate,
  today,
  selected,
  onSelect,
}: {
  weekDates: string[];
  byDate: Map<string, Task[]>;
  today: string;
  selected: string | null;
  onSelect: (day: string | null) => void;
}) {
  return (
    <div className="flex shrink-0 gap-2 overflow-x-auto pb-1 sm:w-40 sm:flex-col sm:overflow-visible sm:pb-0">
      <button
        type="button"
        onClick={() => onSelect(null)}
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
        const count = byDate.get(date)?.length ?? 0;
        const isSelected = selected === date;
        const isToday = date === today;
        return (
          <button
            key={date}
            type="button"
            onClick={() => onSelect(date)}
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
                <span className="ml-1 text-[11px] text-primary">오늘</span>
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
  );
}

type EditFn = (
  taskId: string,
  patch: { title: string; dueDate: string | null }
) => void;

function Column({
  status,
  label,
  tasks,
  onChangeStatus,
  onDelete,
  onEdit,
  today,
  showDate,
  footer,
}: {
  status: TaskStatus;
  label: string;
  tasks: Task[];
  onChangeStatus: (taskId: string, newStatus: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  onEdit: EditFn;
  today: string;
  showDate: boolean;
  footer?: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const tone = COLUMN_TONE[status];

  return (
    <div
      ref={setNodeRef}
      className={`rounded-card border bg-canvas p-4 transition-colors ${
        isOver ? 'border-primary bg-surface-strong' : 'border-hairline'
      }`}
    >
      <div className={`mb-3.5 flex items-baseline gap-2 border-b-2 ${tone.border} pb-2`}>
        <h2 className={`text-sm font-bold tracking-tight ${tone.text}`}>{label}</h2>
        <span className="text-xs tabular-nums text-muted-soft">{tasks.length}</span>
      </div>
      <SortableContext
        items={tasks.map((t) => t._id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex min-h-[80px] flex-col gap-2.5">
          {tasks.map((task, i) => (
            <TaskCard
              key={task._id}
              task={task}
              column={status}
              stickyIndex={i}
              onChangeStatus={onChangeStatus}
              onDelete={onDelete}
              onEdit={onEdit}
              today={today}
              showDate={showDate}
            />
          ))}
        </div>
      </SortableContext>
      {footer}
    </div>
  );
}

function TaskCard({
  task,
  column,
  stickyIndex,
  onChangeStatus,
  onDelete,
  onEdit,
  today,
  showDate,
}: {
  task: Task;
  column: TaskStatus;
  stickyIndex: number;
  onChangeStatus: (taskId: string, newStatus: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  onEdit: EditFn;
  today: string;
  showDate: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task._id });

  const isDoing = column === 'doing';
  const isDone = column === 'done';
  const rotate = isDoing ? (stickyIndex % 2 === 0 ? -1.2 : 1) : 0;

  const style = {
    transform:
      [CSS.Transform.toString(transform), rotate ? `rotate(${rotate}deg)` : '']
        .filter(Boolean)
        .join(' ') || undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
    ...(isDoing
      ? { background: STICKY_TINTS[stickyIndex % STICKY_TINTS.length] }
      : {}),
  };

  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftDue, setDraftDue] = useState(task.dueDate ?? '');

  function startEditing() {
    setDraftTitle(task.title);
    setDraftDue(task.dueDate ?? '');
    setEditing(true);
  }

  function saveEdit(e: FormEvent) {
    e.preventDefault();
    const title = draftTitle.trim();
    if (!title) return;
    onEdit(task._id, { title, dueDate: draftDue || null });
    setEditing(false);
  }

  const dueBadge = getDueBadge(task.dueDate, task.status, today);
  const dayNum = showDate && task.dueDate ? Number(task.dueDate.slice(8, 10)) : null;

  if (editing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="rounded-card border border-ink bg-canvas p-2"
      >
        <form onSubmit={saveEdit} className="flex flex-col gap-1.5">
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            aria-label="할 일 제목"
            autoFocus
            className="rounded-btn border border-hairline px-2 py-1 text-sm"
          />
          <input
            type="date"
            value={draftDue}
            onChange={(e) => setDraftDue(e.target.value)}
            onClick={(e) => e.currentTarget.showPicker?.()}
            aria-label="기한"
            className="rounded-btn border border-hairline px-2 py-1 text-xs"
          />
          <div className="flex gap-1">
            <button
              type="submit"
              className="rounded-btn bg-primary px-2.5 py-1 text-xs font-medium text-on-primary hover:bg-primary-active"
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-btn border border-hairline px-2.5 py-1 text-xs text-muted hover:bg-surface-soft"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        isDoing
          ? 'rounded-[4px] border border-[color:rgba(58,47,38,0.12)] p-3 shadow-[0_3px_9px_rgba(58,47,38,0.10)]'
          : 'rounded-card border border-hairline bg-canvas p-2.5 transition-shadow hover:shadow-float'
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={`flex items-start gap-2 text-sm font-medium ${
            isDone ? 'text-muted-soft' : 'text-ink'
          }`}
        >
          {!isDoing && (
            <PaperCheck
              checked={isDone}
              onChange={(checked) => onChangeStatus(task._id, checked ? 'done' : 'todo')}
              label={`${task.title} 완료 여부`}
              size={16}
            />
          )}
          <span
            {...attributes}
            {...listeners}
            className={`cursor-grab touch-none ${isDone ? 'text-muted-soft line-through' : ''}`}
          >
            {dayNum !== null && (
              <span className="mr-1.5 inline-block rounded-full bg-surface-strong px-1.5 text-[11px] font-semibold text-muted">
                {dayNum}
              </span>
            )}
            {task.title}
          </span>
        </div>
        {dueBadge && (
          <span
            className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
              dueBadge === '지연'
                ? 'border-border-strong bg-surface-strong text-error'
                : 'border-[color:var(--color-primary-disabled)] text-primary'
            }`}
          >
            {dueBadge}
          </span>
        )}
      </div>
      {task.description && (
        <p className="mt-1 text-xs text-muted">{task.description}</p>
      )}
      <div className="mt-2 flex items-center gap-1">
        <select
          value={task.status}
          onChange={(e) => onChangeStatus(task._id, e.target.value as TaskStatus)}
          className="w-full rounded-btn border border-hairline bg-canvas px-1 py-1 text-xs"
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
          onClick={startEditing}
          className="flex shrink-0 rounded-btn p-1.5 text-muted-soft hover:bg-surface-strong hover:text-ink"
          aria-label="할 일 편집"
          title="편집"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onDelete(task._id)}
          className="flex shrink-0 rounded-btn p-1.5 text-muted-soft hover:bg-surface-strong hover:text-error"
          aria-label="할 일 삭제"
          title="삭제"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
          </svg>
        </button>
      </div>
    </div>
  );
}
