import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie';

// createPlan() calls revalidatePath(), which requires a Next.js request
// context that doesn't exist when calling Server Actions directly from a
// plain Vitest run. Mocking it as a no-op is the standard way to test
// Server Action logic in isolation from the Next.js server runtime.
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

// Every mutation in this flow runs requireUserId() (see src/lib/auth.ts),
// which reads the session cookie via next/headers `cookies()` and resolves
// it against the `sessions`/`users` collections. Stub `cookies()` to return
// the test session token seeded in beforeAll.
const TEST_TOKEN = 'test-session-token';
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === SESSION_COOKIE_NAME ? { name, value: TEST_TOKEN } : undefined,
  }),
}));

/**
 * Regression test for a real bug the architect review caught: calling
 * `createNextWeekPlan` twice on a goal-less plan (yearlyGoalId: null) used to
 * double-create both the plan and its tasks.
 */
describe('createNextWeekPlan idempotency for goal-less plans (US-016 AC3)', () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.MONGODB_DB = 'next-week-idempotency-test';

    const { getDb } = await import('@/lib/mongodb');
    const db = await getDb();
    const user = await db
      .collection('users')
      .insertOne({ githubId: 1, login: 'tester', avatarUrl: '', createdAt: new Date(), updatedAt: new Date(), schemaVersion: 1 });
    await db.collection('sessions').insertOne({
      token: TEST_TOKEN,
      userId: user.insertedId.toString(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
  });

  afterAll(async () => {
    const { clientPromise } = await import('@/lib/mongodb');
    const client = await clientPromise;
    await client.close();
    await mongod.stop();
  });

  it('creates exactly one next-week plan (and duplicates tasks only once) when called twice on a goal-less plan', async () => {
    const { createPlan, listPlans } = await import('../actions');
    const { createTask } = await import('@/app/(app)/tasks/actions');
    const { createNextWeekPlan } = await import('./next-week-actions');

    const plan = await createPlan({
      yearlyGoalId: null,
      title: '이번 주',
      weekStart: '2026-08-24',
    });
    await createTask({ weeklyPlanId: plan._id, title: '할 일 1', status: 'todo' });
    await createTask({ weeklyPlanId: plan._id, title: '할 일 2', status: 'done' });

    const first = await createNextWeekPlan(plan._id);
    const second = await createNextWeekPlan(plan._id);

    expect(second.newPlanId).toBe(first.newPlanId);

    const allPlans = await listPlans();
    const nextWeekPlans = allPlans.filter(
      (p) => p.yearlyGoalId === null && p.weekStart === '2026-08-31'
    );
    expect(nextWeekPlans).toHaveLength(1);

    const { listTasksByPlan } = await import('@/app/(app)/tasks/actions');
    const clonedTasks = await listTasksByPlan(first.newPlanId);
    expect(clonedTasks).toHaveLength(2);
    expect(clonedTasks.every((t) => t.status === 'todo')).toBe(true);
  });
});
