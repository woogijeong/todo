'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { yearlyGoalInputSchema, type YearlyGoal } from '@/lib/schemas';
import { parseObjectId, NotFoundError, ValidationError } from '@/lib/mongo-helpers';
import { requireUserId } from '@/lib/auth';

const COLLECTION = 'yearlyGoals';
const MONTHLY_PLANS_COLLECTION = 'monthlyPlans';

type YearlyGoalDoc = {
  _id: ObjectId;
  userId: string;
  title: string;
  description?: string;
  year: number;
  createdAt: Date;
  updatedAt: Date;
  schemaVersion: 1;
};

function toYearlyGoal(doc: YearlyGoalDoc): YearlyGoal {
  return {
    _id: doc._id.toString(),
    userId: doc.userId,
    title: doc.title,
    description: doc.description,
    year: doc.year,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    schemaVersion: doc.schemaVersion,
  };
}

export async function listGoals(): Promise<YearlyGoal[]> {
  const userId = await requireUserId();
  const db = await getDb();
  const docs = await db
    .collection<YearlyGoalDoc>(COLLECTION)
    .find({ userId })
    .sort({ year: -1, createdAt: -1 })
    .toArray();
  return docs.map(toYearlyGoal);
}

export async function getGoal(id: string): Promise<YearlyGoal | null> {
  const userId = await requireUserId();
  const objectId = parseObjectId(id);
  if (!objectId) return null;
  const db = await getDb();
  const doc = await db.collection<YearlyGoalDoc>(COLLECTION).findOne({ _id: objectId, userId });
  return doc ? toYearlyGoal(doc) : null;
}

export async function createGoal(input: unknown): Promise<YearlyGoal> {
  const userId = await requireUserId();
  const parsed = yearlyGoalInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('연간 계획 입력값이 올바르지 않습니다.');
  }

  const now = new Date();
  const doc: Omit<YearlyGoalDoc, '_id'> = {
    ...parsed.data,
    userId,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };

  const db = await getDb();
  const result = await db.collection<Omit<YearlyGoalDoc, '_id'>>(COLLECTION).insertOne(doc);

  revalidatePath('/goals');
  revalidatePath('/');
  revalidatePath('/monthly-plans');
  return toYearlyGoal({ _id: result.insertedId, ...doc });
}

export async function updateGoal(id: string, input: unknown): Promise<YearlyGoal> {
  const userId = await requireUserId();
  const objectId = parseObjectId(id);
  if (!objectId) throw new NotFoundError('연간 계획');

  const parsed = yearlyGoalInputSchema.partial().safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('연간 계획 입력값이 올바르지 않습니다.');
  }

  const db = await getDb();
  const result = await db.collection<YearlyGoalDoc>(COLLECTION).findOneAndUpdate(
    { _id: objectId, userId },
    { $set: { ...parsed.data, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );

  if (!result) throw new NotFoundError('연간 계획');
  revalidatePath('/goals');
  revalidatePath(`/goals/${id}`);
  revalidatePath('/');
  revalidatePath('/monthly-plans');
  return toYearlyGoal(result);
}

export async function deleteGoal(id: string): Promise<{ orphanedMonthlyPlanCount: number }> {
  const userId = await requireUserId();
  const objectId = parseObjectId(id);
  if (!objectId) throw new NotFoundError('연간 계획');

  const db = await getDb();

  const existing = await db.collection<YearlyGoalDoc>(COLLECTION).findOne({ _id: objectId, userId });
  if (!existing) throw new NotFoundError('연간 계획');

  // Orphan, don't cascade-delete: children keep existing but lose their parent reference.
  // monthlyPlans.yearlyGoalId is stored as the string form of the goal's _id (schema boundary
  // represents ObjectId refs as strings), so we match on the string id, not an ObjectId.
  // Weekly Plans are one level further removed (they link to a Monthly Plan, not directly
  // to a Yearly Goal), so deleting a goal no longer touches weeklyPlans at all.
  const orphanResult = await db
    .collection(MONTHLY_PLANS_COLLECTION)
    .updateMany({ yearlyGoalId: id, userId }, { $set: { yearlyGoalId: null } });

  await db.collection(COLLECTION).deleteOne({ _id: objectId, userId });

  revalidatePath('/goals');
  revalidatePath('/');
  revalidatePath('/monthly-plans');

  return { orphanedMonthlyPlanCount: orphanResult.modifiedCount };
}
