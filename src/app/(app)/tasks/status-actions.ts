'use server';

import { revalidatePath } from 'next/cache';
import type { WithId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import {
  taskStatus,
  taskEventInputSchema,
  type Task,
  type TaskEventInput,
  type TaskStatus,
} from '@/lib/schemas';
import { parseObjectId, NotFoundError, ValidationError } from '@/lib/mongo-helpers';
import { requireUserId } from '@/lib/auth';

/** Mirrors the `TaskDoc` shape in `./actions.ts`; kept local so this file has
 *  no non-`getDb`/`getPlan` dependency on that module (see task ticket). */
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

function toTask(doc: WithId<TaskDoc>): Task {
  return {
    ...doc,
    _id: doc._id.toString(),
  };
}

/**
 * Transitions a task to `newStatus` and appends an immutable record to the
 * `taskEvents` audit log. A same-status call (`newStatus === current status`)
 * is a no-op: no document update, no event insert, and `taskEvents` is never
 * updated or deleted elsewhere in this module. Returns the task as it stands
 * after the call (unchanged on a no-op, updated otherwise).
 */
export async function updateTaskStatus(taskId: string, newStatus: TaskStatus): Promise<Task> {
  const userId = await requireUserId();
  const objectId = parseObjectId(taskId);
  if (!objectId) throw new NotFoundError('할 일');

  if (!taskStatus.safeParse(newStatus).success) {
    throw new ValidationError('할 일 상태 값이 올바르지 않습니다.');
  }

  const db = await getDb();
  const tasks = db.collection<TaskDoc>('tasks');

  const current = await tasks.findOne({ _id: objectId, userId });
  if (!current) throw new NotFoundError('할 일');

  if (current.status === newStatus) {
    return toTask(current);
  }

  const now = new Date();
  const update: Partial<TaskDoc> = { status: newStatus, updatedAt: now };
  if (newStatus === 'done') {
    update.completedAt = now;
  } else if (current.status === 'done') {
    update.completedAt = null;
  }

  const result = await tasks.findOneAndUpdate(
    { _id: objectId, userId },
    { $set: update },
    { returnDocument: 'after' }
  );
  if (!result) throw new NotFoundError('할 일');

  const event: TaskEventInput = taskEventInputSchema.parse({
    userId,
    taskId,
    weeklyPlanId: current.weeklyPlanId,
    fromStatus: current.status,
    toStatus: newStatus,
    occurredAt: now,
  });

  await db.collection<TaskEventInput>('taskEvents').insertOne(event);

  // The dashboard's week checklist/progress and the plan board both derive
  // from this task's status, and can be served from a stale cached page
  // (back/forward navigation, or a short forward-nav window) without this.
  revalidatePath('/');
  if (current.weeklyPlanId) {
    revalidatePath(`/plans/${current.weeklyPlanId}`);
  }

  return toTask(result);
}
