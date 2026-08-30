import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Db } from 'mongodb';
import { migrateDropMonthlyPlans, DuplicateWeekError } from './migrate-drop-monthly-plans';

describe('migrateDropMonthlyPlans', () => {
  let mongod: MongoMemoryServer;
  let db: Db;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.MONGODB_DB = 'migrate-drop-monthly-test';
    const { getDb } = await import('@/lib/mongodb');
    db = await getDb();
  });

  afterAll(async () => {
    const { clientPromise } = await import('@/lib/mongodb');
    await (await clientPromise).close();
    await mongod.stop();
  });

  it('inherits yearlyGoalId, strips monthlyPlanId everywhere, backfills completedAt, and is idempotent', async () => {
    const now = new Date('2026-08-20T00:00:00Z');

    await db.collection('monthlyPlans').insertOne({
      _id: 'm1' as unknown as never,
      userId: 'u1',
      yearlyGoalId: 'g1',
      title: '8월',
      month: '2026-08',
    });
    await db.collection('weeklyPlans').insertMany([
      { _id: 'w1' as unknown as never, userId: 'u1', monthlyPlanId: 'm1', title: '1주', weekStart: '2026-08-03', weekEnd: '2026-08-09' },
      { _id: 'w2' as unknown as never, userId: 'u1', monthlyPlanId: null, title: '2주', weekStart: '2026-08-10', weekEnd: '2026-08-16' },
    ]);
    await db.collection('taskEvents').insertOne({
      userId: 'u1', taskId: 't1', weeklyPlanId: 'w1', monthlyPlanId: 'm1', fromStatus: 'todo', toStatus: 'done', occurredAt: now,
    });
    await db.collection('tasks').insertOne({
      userId: 'u1', weeklyPlanId: 'w1', title: '옛 완료', status: 'done', createdAt: now, updatedAt: now,
    });

    const summary = await migrateDropMonthlyPlans(db);
    expect(summary.migrated).toBe(2);
    expect(summary.completedBackfilled).toBe(1);
    expect(summary.monthlyPlansDropped).toBe(true);

    const w1 = await db.collection('weeklyPlans').findOne({ _id: 'w1' as unknown as never });
    expect(w1).toMatchObject({ yearlyGoalId: 'g1' });
    expect(w1).not.toHaveProperty('monthlyPlanId');
    const w2 = await db.collection('weeklyPlans').findOne({ _id: 'w2' as unknown as never });
    expect(w2).toMatchObject({ yearlyGoalId: null });

    const evt = await db.collection('taskEvents').findOne({ taskId: 't1' });
    expect(evt).not.toHaveProperty('monthlyPlanId');

    const task = await db.collection('tasks').findOne({ title: '옛 완료' });
    expect(task?.completedAt).toEqual(now);

    expect(await db.listCollections({ name: 'monthlyPlans' }).toArray()).toHaveLength(0);

    const indexes = await db.collection('weeklyPlans').indexes();
    expect(indexes.some((i) => i.name === 'userId_1_weekStart_1' && i.unique)).toBe(true);

    // Re-run: clean no-op (nothing left to migrate, strip, or backfill).
    const second = await migrateDropMonthlyPlans(db);
    expect(second).toMatchObject({ migrated: 0, strayRemoved: 0, eventsCleaned: 0, completedBackfilled: 0 });
  });

  it('aborts with DuplicateWeekError when a (userId, weekStart) pair is not unique', async () => {
    await db.collection('weeklyPlans').deleteMany({});
    // The first test already created the unique index; drop it so the
    // pre-existing-duplicate scenario can be set up at all.
    await db.collection('weeklyPlans').dropIndex('userId_1_weekStart_1').catch(() => {});
    await db.collection('weeklyPlans').insertMany([
      { userId: 'u9', yearlyGoalId: null, title: 'a', weekStart: '2026-09-07', weekEnd: '2026-09-13' },
      { userId: 'u9', yearlyGoalId: null, title: 'b', weekStart: '2026-09-07', weekEnd: '2026-09-13' },
    ]);

    await expect(migrateDropMonthlyPlans(db)).rejects.toBeInstanceOf(DuplicateWeekError);
  });
});
