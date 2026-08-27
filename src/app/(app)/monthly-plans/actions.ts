'use server';

import { revalidatePath } from 'next/cache';
import type { Collection, Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { monthlyPlanInputSchema, type MonthlyPlan } from '@/lib/schemas';
import {
  parseObjectId,
  assertParentOwned,
  NotFoundError,
  ValidationError,
  DuplicateMonthlyPlanError,
} from '@/lib/mongo-helpers';
import { requireUserId } from '@/lib/auth';

const MONTHLY_PLAN_ENTITY = '월간 계획';

type MonthlyPlanDoc = Omit<MonthlyPlan, '_id'> & { _id: import('mongodb').ObjectId };

function toMonthlyPlan(doc: MonthlyPlanDoc): MonthlyPlan {
  return {
    ...doc,
    _id: doc._id.toString(),
  };
}

function monthlyPlansCollection(db: Db): Collection<MonthlyPlanDoc> {
  return db.collection<MonthlyPlanDoc>('monthlyPlans');
}

function defaultMonthlyPlanTitle(month: string): string {
  const [year, monthNum] = month.split('-');
  return `${year}년 ${Number(monthNum)}월`;
}

export async function createMonthlyPlan(input: {
  yearlyGoalId: string | null;
  title: string;
  month: string;
}): Promise<MonthlyPlan> {
  const userId = await requireUserId();

  const parsed = monthlyPlanInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message);
  }

  const db = await getDb();

  // A Monthly Plan may only hang off a Yearly Goal the same user owns.
  if (parsed.data.yearlyGoalId) {
    await assertParentOwned(db, 'yearlyGoals', parsed.data.yearlyGoalId, userId, '연간 계획');
  }

  // Exactly one monthly plan per calendar month, per user — mirrors the
  // "one weekly plan per week" rule in src/app/plans/actions.ts, and makes
  // findOrCreateMonthlyPlanForMonth's auto-vivification unambiguous (never
  // more than one candidate to find).
  const existingForMonth = await monthlyPlansCollection(db).findOne({
    month: parsed.data.month,
    userId,
  });
  if (existingForMonth) {
    throw new DuplicateMonthlyPlanError();
  }

  const now = new Date();
  const doc = {
    ...parsed.data,
    userId,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1 as const,
  };

  const result = await monthlyPlansCollection(db).insertOne(doc as unknown as MonthlyPlanDoc);
  revalidatePath('/monthly-plans');
  if (doc.yearlyGoalId) {
    revalidatePath(`/goals/${doc.yearlyGoalId}`);
  }
  return toMonthlyPlan({ ...doc, _id: result.insertedId });
}

export async function updateMonthlyPlan(id: string, input: unknown): Promise<MonthlyPlan> {
  const userId = await requireUserId();
  const objectId = parseObjectId(id);
  if (!objectId) throw new NotFoundError(MONTHLY_PLAN_ENTITY);

  const parsed = monthlyPlanInputSchema.partial().safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message);
  }

  const db = await getDb();

  if (parsed.data.month) {
    const conflict = await monthlyPlansCollection(db).findOne({
      month: parsed.data.month,
      userId,
      _id: { $ne: objectId },
    });
    if (conflict) throw new DuplicateMonthlyPlanError();
  }

  const result = await monthlyPlansCollection(db).findOneAndUpdate(
    { _id: objectId, userId },
    { $set: { ...parsed.data, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!result) throw new NotFoundError(MONTHLY_PLAN_ENTITY);

  revalidatePath('/monthly-plans');
  revalidatePath(`/monthly-plans/${id}`);
  if (result.yearlyGoalId) {
    revalidatePath(`/goals/${result.yearlyGoalId}`);
  }
  return toMonthlyPlan(result);
}

/** Orphans (doesn't cascade-delete) child Weekly Plans, same policy as
 *  deleteGoal/deletePlan elsewhere in the app. Returns the orphaned count so
 *  the caller can show it in a confirmation dialog. */
export async function deleteMonthlyPlan(id: string): Promise<number> {
  const userId = await requireUserId();
  const objectId = parseObjectId(id);
  if (!objectId) throw new NotFoundError(MONTHLY_PLAN_ENTITY);

  const db = await getDb();

  const existing = await monthlyPlansCollection(db).findOne({ _id: objectId, userId });
  if (!existing) throw new NotFoundError(MONTHLY_PLAN_ENTITY);

  const orphanResult = await db
    .collection('weeklyPlans')
    .updateMany(
      { monthlyPlanId: id, userId },
      { $set: { monthlyPlanId: null, updatedAt: new Date() } }
    );

  await monthlyPlansCollection(db).deleteOne({ _id: objectId, userId });

  revalidatePath('/monthly-plans');
  revalidatePath('/plans');
  if (existing.yearlyGoalId) {
    revalidatePath(`/goals/${existing.yearlyGoalId}`);
  }

  return orphanResult.modifiedCount;
}

export async function listMonthlyPlans(): Promise<MonthlyPlan[]> {
  const userId = await requireUserId();
  const db = await getDb();
  const docs = await monthlyPlansCollection(db).find({ userId }).sort({ month: -1 }).toArray();
  return docs.map(toMonthlyPlan);
}

export async function getMonthlyPlan(id: string): Promise<MonthlyPlan | null> {
  const userId = await requireUserId();
  const objectId = parseObjectId(id);
  if (!objectId) return null;

  const db = await getDb();
  const doc = await monthlyPlansCollection(db).findOne({ _id: objectId, userId });
  return doc ? toMonthlyPlan(doc) : null;
}

export async function getMonthlyPlanByMonth(month: string): Promise<MonthlyPlan | null> {
  const userId = await requireUserId();
  const db = await getDb();
  const doc = await monthlyPlansCollection(db).findOne({ month, userId });
  return doc ? toMonthlyPlan(doc) : null;
}

/**
 * Returns the id of the Monthly Plan for `month` ('YYYY-MM'), creating one
 * with a default title (e.g. "2026년 8월") if none exists yet. Used by the
 * Weekly Plan tab's day-level quick-add flow so a user can start typing a
 * task for a date without ever having to explicitly create a container plan
 * first — mirrors the existing "이번 주 계획 만들기" auto-vivification pattern,
 * one level up the hierarchy.
 */
export async function findOrCreateMonthlyPlanForMonth(month: string): Promise<string> {
  const userId = await requireUserId();
  const db = await getDb();

  const existing = await monthlyPlansCollection(db).findOne({ month, userId });
  if (existing) return existing._id.toString();

  try {
    const created = await createMonthlyPlan({
      yearlyGoalId: null,
      title: defaultMonthlyPlanTitle(month),
      month,
    });
    return created._id;
  } catch (error) {
    if (!(error instanceof DuplicateMonthlyPlanError)) throw error;
    // Race: another request created it between our check and the insert.
    const raced = await monthlyPlansCollection(db).findOne({ month, userId });
    if (!raced) throw error;
    return raced._id.toString();
  }
}
