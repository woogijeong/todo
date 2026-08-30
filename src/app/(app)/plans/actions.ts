'use server';

import { revalidatePath } from 'next/cache';
import type { Collection, Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { weeklyPlanInputSchema, type WeeklyPlan } from '@/lib/schemas';
import {
  parseObjectId,
  assertParentOwned,
  NotFoundError,
  ValidationError,
  DuplicateWeeklyPlanError,
} from '@/lib/mongo-helpers';
import { getWeekStart, getWeekEnd } from '@/lib/date';
import { requireUserId } from '@/lib/auth';

const PLAN_ENTITY = '주간 계획';

type WeeklyPlanDoc = Omit<WeeklyPlan, '_id'> & { _id: import('mongodb').ObjectId };

function toWeeklyPlan(doc: WeeklyPlanDoc): WeeklyPlan {
  return {
    ...doc,
    _id: doc._id.toString(),
  };
}

function plansCollection(db: Db): Collection<WeeklyPlanDoc> {
  return db.collection<WeeklyPlanDoc>('weeklyPlans');
}

let indexesEnsured = false;

/** Idempotent; safe to call on every write. Exactly one Weekly Plan per week
 *  per user — `userId` is the leading key so one user can never plant a row
 *  that collides with another user's plan for the same week. This is the
 *  unconditional form of the "one plan per week" rule (the old partial index
 *  keyed on monthlyPlanId is dropped along with the Monthly Plan layer). */
async function ensureIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  // Drop the legacy indexes if still around: their key sets differ, so
  // createIndex below would add a second index rather than replace them,
  // leaving a stale unique constraint in force.
  for (const legacy of [
    'monthlyPlanId_1_weekStart_1',
    'userId_1_monthlyPlanId_1_weekStart_1',
    'yearlyGoalId_1_weekStart_1',
  ]) {
    await plansCollection(db).dropIndex(legacy).catch(() => {});
  }
  await plansCollection(db).createIndex({ userId: 1, weekStart: 1 }, { unique: true });
  indexesEnsured = true;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;
}

export async function createPlan(input: {
  yearlyGoalId: string | null;
  title: string;
  weekStart?: string;
}): Promise<WeeklyPlan> {
  const userId = await requireUserId();
  const weekStart = input.weekStart ?? getWeekStart(new Date());
  const weekEnd = getWeekEnd(weekStart);

  const parsed = weeklyPlanInputSchema.safeParse({
    yearlyGoalId: input.yearlyGoalId,
    title: input.title,
    weekStart,
    weekEnd,
  });
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message);
  }

  const db = await getDb();
  await ensureIndexes(db);

  // A Weekly Plan may only link to a Yearly Goal the same user owns.
  if (parsed.data.yearlyGoalId) {
    await assertParentOwned(db, 'yearlyGoals', parsed.data.yearlyGoalId, userId, '연간 목표');
  }

  // Exactly one plan per week for this user. The DB unique index enforces
  // this too; the app-level pre-check runs first so the common case returns
  // a clean error rather than relying on a duplicate-key exception.
  const existingForWeek = await plansCollection(db).findOne({ weekStart, userId });
  if (existingForWeek) {
    throw new DuplicateWeeklyPlanError();
  }

  const now = new Date();
  const doc = {
    ...parsed.data,
    userId,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1 as const,
  };

  try {
    const result = await plansCollection(db).insertOne(doc as unknown as WeeklyPlanDoc);
    revalidatePath('/plans');
    revalidatePath('/');
    revalidatePath('/goals');
    if (doc.yearlyGoalId) {
      revalidatePath(`/goals/${doc.yearlyGoalId}`);
    }
    return toWeeklyPlan({ ...doc, _id: result.insertedId });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new DuplicateWeeklyPlanError();
    }
    throw error;
  }
}

export async function updatePlan(id: string, input: unknown): Promise<WeeklyPlan> {
  const userId = await requireUserId();
  const objectId = parseObjectId(id);
  if (!objectId) throw new NotFoundError(PLAN_ENTITY);

  const parsed = weeklyPlanInputSchema.partial().safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message);
  }

  const db = await getDb();
  await ensureIndexes(db);

  if (parsed.data.weekStart) {
    const conflict = await plansCollection(db).findOne({
      weekStart: parsed.data.weekStart,
      userId,
      _id: { $ne: objectId },
    });
    if (conflict) throw new DuplicateWeeklyPlanError();
  }

  try {
    const result = await plansCollection(db).findOneAndUpdate(
      { _id: objectId, userId },
      { $set: { ...parsed.data, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!result) throw new NotFoundError(PLAN_ENTITY);

    revalidatePath('/plans');
    revalidatePath(`/plans/${id}`);
    revalidatePath('/');
    revalidatePath('/goals');
    if (result.yearlyGoalId) {
      revalidatePath(`/goals/${result.yearlyGoalId}`);
    }
    return toWeeklyPlan(result);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new DuplicateWeeklyPlanError();
    }
    throw error;
  }
}

export async function deletePlan(id: string): Promise<number> {
  const userId = await requireUserId();
  const objectId = parseObjectId(id);
  if (!objectId) throw new NotFoundError(PLAN_ENTITY);

  const db = await getDb();

  const existing = await plansCollection(db).findOne({ _id: objectId, userId });
  if (!existing) throw new NotFoundError(PLAN_ENTITY);

  // Cascade-delete the plan's tasks. Their status history lives on in the
  // append-only `taskEvents` collection (with its own userId + plan
  // snapshot), so stats are unaffected — but the tasks themselves have no
  // home once the plan is gone.
  const deleted = await db.collection('tasks').deleteMany({ weeklyPlanId: id, userId });

  await plansCollection(db).deleteOne({ _id: objectId, userId });

  revalidatePath('/plans');
  revalidatePath('/');
  revalidatePath('/goals');
  if (existing.yearlyGoalId) {
    revalidatePath(`/goals/${existing.yearlyGoalId}`);
  }

  return deleted.deletedCount;
}

export async function listPlans(): Promise<WeeklyPlan[]> {
  const userId = await requireUserId();
  const db = await getDb();
  const docs = await plansCollection(db).find({ userId }).sort({ weekStart: -1 }).toArray();
  return docs.map(toWeeklyPlan);
}

export async function getPlan(id: string): Promise<WeeklyPlan | null> {
  const userId = await requireUserId();
  const objectId = parseObjectId(id);
  if (!objectId) return null;

  const db = await getDb();
  const doc = await plansCollection(db).findOne({ _id: objectId, userId });
  return doc ? toWeeklyPlan(doc) : null;
}

export async function getPlanByWeekStart(weekStart: string): Promise<WeeklyPlan | null> {
  const userId = await requireUserId();
  const db = await getDb();
  const doc = await plansCollection(db).findOne({ weekStart, userId });
  return doc ? toWeeklyPlan(doc) : null;
}
