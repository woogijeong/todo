'use server';

import { revalidatePath } from 'next/cache';
import type { Filter, WithId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { taskInputSchema, type Task, type TaskStatus } from '@/lib/schemas';
import {
  parseObjectId,
  assertParentOwned,
  NotFoundError,
  ValidationError,
} from '@/lib/mongo-helpers';
import { requireUserId } from '@/lib/auth';

/** Every mutation below revalidates '/': the dashboard aggregates the
 *  current week's plan and its task checklist, so any task
 *  create/update/delete can change what it shows. Without this, the
 *  dashboard (and any other cached view) can keep showing pre-mutation data
 *  — Next.js reuses cached page output on back/forward navigation (and for a
 *  short window on forward navigation) unless a mutation explicitly
 *  invalidates the paths it affects. The owning plan's board page is
 *  revalidated too, for the same reason. */
function revalidateTaskViews(weeklyPlanId: string | null | undefined): void {
  revalidatePath('/');
  if (weeklyPlanId) {
    revalidatePath(`/plans/${weeklyPlanId}`);
  }
}

/**
 * `weeklyPlanId` is stored as a plain string (not a real ObjectId reference),
 * matching `Task.weeklyPlanId: string | null` from the Zod schema exactly and
 * matching how weeklyPlans.yearlyGoalId is stored (see src/app/(app)/plans/actions.ts,
 * src/app/(app)/goals/actions.ts). This keeps every other module's queries/orphaning
 * updates (`{ weeklyPlanId: someIdString }`) correct without needing to know
 * this collection secretly stores an ObjectId here. `ObjectId.isValid()` is
 * still used to validate the string looks like a real id before accepting it.
 */
type TaskDoc = {
  userId: string;
  weeklyPlanId: string | null;
  title: string;
  description?: string;
  status: TaskStatus;
  dueDate?: string;
  completedAt?: Date | null;
  notifiedAt?: string;
  createdAt: Date;
  updatedAt: Date;
  schemaVersion: 1;
};

async function getTasksCollection() {
  const db = await getDb();
  return db.collection<TaskDoc>('tasks');
}

function toTask(doc: WithId<TaskDoc>): Task {
  return {
    ...doc,
    _id: doc._id.toString(),
  };
}

export async function createTask(input: unknown): Promise<Task> {
  const userId = await requireUserId();
  const parsed = taskInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('할 일 입력값이 올바르지 않습니다.');
  }

  if (parsed.data.weeklyPlanId) {
    await assertParentOwned(await getDb(), 'weeklyPlans', parsed.data.weeklyPlanId, userId, '주간 계획');
  }

  const now = new Date();
  const doc: TaskDoc = {
    ...parsed.data,
    userId,
    status: parsed.data.status ?? 'todo',
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };

  const tasks = await getTasksCollection();
  const result = await tasks.insertOne(doc);
  revalidateTaskViews(doc.weeklyPlanId);
  return toTask({ _id: result.insertedId, ...doc });
}

export async function getTask(id: string): Promise<Task | null> {
  const userId = await requireUserId();
  const objectId = parseObjectId(id);
  if (!objectId) return null;

  const tasks = await getTasksCollection();
  const task = await tasks.findOne({ _id: objectId, userId });
  return task ? toTask(task) : null;
}

export async function updateTask(id: string, input: unknown): Promise<Task> {
  const userId = await requireUserId();
  const objectId = parseObjectId(id);
  if (!objectId) throw new NotFoundError('할 일');

  // `dueDate: '' | null` means "clear the due date" (back to unscheduled) —
  // that can't go through `dateOnlyString`, so pull it out before parsing.
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const clearDueDate = raw.dueDate === '' || raw.dueDate === null;
  const parsed = taskInputSchema
    .partial()
    .safeParse(clearDueDate ? { ...raw, dueDate: undefined } : raw);
  if (!parsed.success) {
    throw new ValidationError('할 일 입력값이 올바르지 않습니다.');
  }

  const set: Partial<TaskDoc> = { ...parsed.data, updatedAt: new Date() };
  if (set.weeklyPlanId) {
    await assertParentOwned(await getDb(), 'weeklyPlans', set.weeklyPlanId, userId, '주간 계획');
  }

  const mongoUpdate: Record<string, unknown> = { $set: set };
  if (clearDueDate) {
    delete set.dueDate;
    mongoUpdate.$unset = { dueDate: '' };
  }

  const tasks = await getTasksCollection();
  const previous = await tasks.findOne(
    { _id: objectId, userId },
    { projection: { weeklyPlanId: 1 } }
  );
  const result = await tasks.findOneAndUpdate(
    { _id: objectId, userId },
    mongoUpdate,
    { returnDocument: 'after' }
  );

  if (!result) throw new NotFoundError('할 일');
  revalidateTaskViews(result.weeklyPlanId);
  if (previous && previous.weeklyPlanId !== result.weeklyPlanId) {
    revalidateTaskViews(previous.weeklyPlanId);
  }
  return toTask(result);
}

export async function deleteTask(id: string): Promise<void> {
  const userId = await requireUserId();
  const objectId = parseObjectId(id);
  if (!objectId) throw new NotFoundError('할 일');

  const tasks = await getTasksCollection();
  const deleted = await tasks.findOneAndDelete({ _id: objectId, userId });
  if (!deleted) throw new NotFoundError('할 일');
  revalidateTaskViews(deleted.weeklyPlanId);
}

export async function listTasksByPlan(weeklyPlanId: string | null): Promise<Task[]> {
  const userId = await requireUserId();
  const tasks = await getTasksCollection();

  let filter: Filter<TaskDoc>;
  if (weeklyPlanId === null) {
    filter = { weeklyPlanId: null, userId };
  } else {
    if (!parseObjectId(weeklyPlanId)) return [];
    filter = { weeklyPlanId, userId };
  }

  const docs = await tasks.find(filter).sort({ updatedAt: -1 }).toArray();
  return docs.map(toTask);
}
