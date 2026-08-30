import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { SESSION_COOKIE_NAME } from './session-cookie';

/**
 * US-009 AC5: unassigned tasks (weeklyPlanId: null) must not leak into any
 * progress calculation. The exclusion happens in the Mongo query inside the
 * progress helpers, so this needs a real database. Progress helpers now also
 * scope every aggregation to the calling user (US-007), so a session cookie
 * is stubbed against a seeded `users`/`sessions` pair.
 */
const TEST_TOKEN = 'progress-test-token';
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === SESSION_COOKIE_NAME ? { name, value: TEST_TOKEN } : undefined,
  }),
}));

describe('progress calculation excludes unassigned tasks (US-009 AC5)', () => {
  let mongod: MongoMemoryServer;
  let userId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.MONGODB_DB = 'progress-integration-test';

    const { getDb } = await import('./mongodb');
    const db = await getDb();
    const now = new Date();
    const user = await db.collection('users').insertOne({
      githubId: 1, login: 'tester', avatarUrl: '', createdAt: now, updatedAt: now, schemaVersion: 1,
    });
    userId = user.insertedId.toString();
    await db.collection('sessions').insertOne({
      token: TEST_TOKEN,
      userId,
      createdAt: now,
      expiresAt: new Date(Date.now() + 60_000),
    });
  });

  afterAll(async () => {
    const { clientPromise } = await import('./mongodb');
    const client = await clientPromise;
    await client.close();
    await mongod.stop();
  });

  it('getWeeklyPlanProgress ignores tasks with weeklyPlanId: null even when they outnumber assigned ones', async () => {
    const { getDb } = await import('./mongodb');
    const { getWeeklyPlanProgress } = await import('./progress');

    const db = await getDb();
    const planId = 'plan-a';

    await db.collection('tasks').insertMany([
      { userId, weeklyPlanId: planId, status: 'done' },
      { userId, weeklyPlanId: planId, status: 'todo' },
      { userId, weeklyPlanId: null, status: 'done' },
      { userId, weeklyPlanId: null, status: 'done' },
      { userId, weeklyPlanId: null, status: 'done' },
    ]);

    expect(await getWeeklyPlanProgress(planId)).toBe(50);
  });

  it('getYearlyGoalProgress is unaffected by tasks that belong to no Weekly Plan at all', async () => {
    const { getDb } = await import('./mongodb');
    const { getYearlyGoalProgress } = await import('./progress');

    const db = await getDb();
    const goalId = 'goal-a';
    const planId = 'plan-b';

    await db
      .collection<{ _id: string; userId: string; yearlyGoalId: string }>('weeklyPlans')
      .insertOne({ _id: planId, userId, yearlyGoalId: goalId });
    await db.collection('tasks').insertMany([
      { userId, weeklyPlanId: planId, status: 'done' },
      { userId, weeklyPlanId: planId, status: 'done' },
      { userId, weeklyPlanId: null, status: 'todo' },
    ]);

    expect(await getYearlyGoalProgress(goalId)).toBe(100);
  });

  it('excludes another user\'s tasks from the same plan id', async () => {
    const { getDb } = await import('./mongodb');
    const { getWeeklyPlanProgress } = await import('./progress');

    const db = await getDb();
    const planId = 'shared-plan-id';
    await db.collection('tasks').insertMany([
      { userId, weeklyPlanId: planId, status: 'done' },
      { userId, weeklyPlanId: planId, status: 'done' },
      // Another user's tasks on the same plan id string — must not count.
      { userId: 'someone-else', weeklyPlanId: planId, status: 'todo' },
      { userId: 'someone-else', weeklyPlanId: planId, status: 'todo' },
    ]);

    expect(await getWeeklyPlanProgress(planId)).toBe(100);
  });
});
