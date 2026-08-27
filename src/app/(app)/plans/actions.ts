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

/** Idempotent; safe to call on every write. The partial filter restricts the
 *  unique constraint to plans whose monthlyPlanId is an actual string — this
 *  is defense-in-depth for the month-linked case behind the app-level
 *  "one plan per week, per user" rule in createPlan/updatePlan below; it
 *  does NOT need to cover monthlyPlanId: null plans because that check
 *  already does. `userId` is the leading key so one user can never plant a
 *  row that collides with another user's plan for the same week. */
async function ensureIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  // Drop the pre-multi-user index if it's still around: its key set differs,
  // so createIndex below would add a second index rather than replace it,
  // leaving the un-scoped unique constraint (and its cross-user collision)
  // in force.
  await plansCollection(db)
    .dropIndex('monthlyPlanId_1_weekStart_1')
    .catch(() => {});
  await plansCollection(db).createIndex(
    { userId: 1, monthlyPlanId: 1, weekStart: 1 },
    { unique: true, partialFilterExpression: { monthlyPlanId: { $type: 'string' } } }
  );
  indexesEnsured = true;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;
}

export async function createPlan(input: {
  monthlyPlanId: string | null;
  title: string;
  weekStart?: string;
}): Promise<WeeklyPlan> {
  const userId = await requireUserId();
  const weekStart = input.weekStart ?? getWeekStart(new Date());
  const weekEnd = getWeekEnd(weekStart);

  const parsed = weeklyPlanInputSchema.safeParse({
    monthlyPlanId: input.monthlyPlanId,
    title: input.title,
    weekStart,
    weekEnd,
  });
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message);
  }

  const db = await getDb();
  await ensureIndexes(db);

  // A Weekly Plan may only hang off a Monthly Plan the same user owns.
  if (parsed.data.monthlyPlanId) {
    await assertParentOwned(db, 'monthlyPlans', parsed.data.monthlyPlanId, userId, '월간 계획');
  }

  // Exactly one plan per week for this user — regardless of which monthly
  // plan (if any) it's linked to. The DB index above only enforces this for
  // month-linked plans (partial index), so this app-level pre-check is the
  // sole guard for month-less plans; it's also the primary guard overall
  // since it runs before the insert attempt rather than relying on a
  // duplicate-key error.
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
    if (doc.monthlyPlanId) {
      revalidatePath(`/monthly-plans/${doc.monthlyPlanId}`);
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
    if (result.monthlyPlanId) {
      revalidatePath(`/monthly-plans/${result.monthlyPlanId}`);
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
  if (existing.monthlyPlanId) {
    revalidatePath(`/monthly-plans/${existing.monthlyPlanId}`);
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
