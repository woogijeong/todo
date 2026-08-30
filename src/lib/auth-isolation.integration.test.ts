import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { SESSION_COOKIE_NAME } from './session-cookie';

vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

// The mocked cookie jar reads a mutable `currentToken` so a single test can
// act as different users by swapping it. `getSessionUser` is wrapped in
// React `cache`, which is a pass-through when called outside a request
// (i.e. here), so each call re-resolves against the live value.
let currentToken: string | null = null;
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === SESSION_COOKIE_NAME && currentToken
        ? { name, value: currentToken }
        : undefined,
  }),
}));

describe('per-user data isolation (US-007)', () => {
  let mongod: MongoMemoryServer;
  const tokenA = 'token-a';
  const tokenB = 'token-b';

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.MONGODB_DB = 'auth-isolation-test';

    const { getDb } = await import('./mongodb');
    const db = await getDb();
    const now = new Date();
    const a = await db.collection('users').insertOne({
      githubId: 101, login: 'alice', avatarUrl: '', createdAt: now, updatedAt: now, schemaVersion: 1,
    });
    const b = await db.collection('users').insertOne({
      githubId: 102, login: 'bob', avatarUrl: '', createdAt: now, updatedAt: now, schemaVersion: 1,
    });
    await db.collection('sessions').insertMany([
      { token: tokenA, userId: a.insertedId.toString(), createdAt: now, expiresAt: new Date(Date.now() + 60_000) },
      { token: tokenB, userId: b.insertedId.toString(), createdAt: now, expiresAt: new Date(Date.now() + 60_000) },
    ]);
  });

  afterAll(async () => {
    const { clientPromise } = await import('./mongodb');
    const client = await clientPromise;
    await client.close();
    await mongod.stop();
  });

  it("keeps each user's goals, plans, tasks and progress fully separate", async () => {
    const { createGoal, listGoals } = await import('@/app/(app)/goals/actions');
    const { createPlan, listPlans } = await import('@/app/(app)/plans/actions');
    const { createTask, listTasksByPlan, updateTask, deleteTask } = await import(
      '@/app/(app)/tasks/actions'
    );
    const { getWeeklyPlanProgress } = await import('./progress');

    // --- Alice creates a goal, a plan and two tasks (one done) ---
    currentToken = tokenA;
    await createGoal({ title: 'Alice 목표', year: 2026 });
    const alicePlan = await createPlan({ yearlyGoalId: null, title: 'Alice 주', weekStart: '2026-08-24' });
    await createTask({ weeklyPlanId: alicePlan._id, title: 'A1', status: 'done' });
    await createTask({ weeklyPlanId: alicePlan._id, title: 'A2', status: 'todo' });

    // --- Bob creates his own, same week ---
    currentToken = tokenB;
    await createGoal({ title: 'Bob 목표', year: 2026 });
    const bobPlan = await createPlan({ yearlyGoalId: null, title: 'Bob 주', weekStart: '2026-08-24' });
    await createTask({ weeklyPlanId: bobPlan._id, title: 'B1', status: 'todo' });

    // Bob only sees his own.
    expect((await listGoals()).map((g) => g.title)).toEqual(['Bob 목표']);
    expect((await listPlans()).map((p) => p.title)).toEqual(['Bob 주']);
    expect((await listTasksByPlan(bobPlan._id)).map((t) => t.title)).toEqual(['B1']);
    // Bob cannot read tasks inside Alice's plan id.
    expect(await listTasksByPlan(alicePlan._id)).toEqual([]);
    // Progress rollup for Alice's plan, computed as Bob, sees no tasks.
    expect(await getWeeklyPlanProgress(alicePlan._id)).toBeNull();
    // Bob cannot mutate Alice's task.
    const aliceTaskId = await (async () => {
      currentToken = tokenA;
      const [t] = await listTasksByPlan(alicePlan._id);
      currentToken = tokenB;
      return t._id;
    })();
    await expect(updateTask(aliceTaskId, { title: 'hacked' })).rejects.toThrow();
    await expect(deleteTask(aliceTaskId)).rejects.toThrow();
    // Bob cannot attach a new task to (or plant a row referencing) Alice's plan.
    await expect(
      createTask({ weeklyPlanId: alicePlan._id, title: 'planted', status: 'todo' })
    ).rejects.toThrow();
    const [bobTask] = await listTasksByPlan(bobPlan._id);
    await expect(updateTask(bobTask._id, { weeklyPlanId: alicePlan._id })).rejects.toThrow();
    // Bob cannot link a Weekly Plan to Alice's Yearly Goal either.
    currentToken = tokenA;
    const [aliceGoal] = await listGoals();
    currentToken = tokenB;
    await expect(
      createPlan({ yearlyGoalId: aliceGoal._id, title: 'x', weekStart: '2026-09-07' })
    ).rejects.toThrow();

    // Alice still sees exactly her data and correct 50% progress (1 done / 2).
    currentToken = tokenA;
    expect((await listGoals()).map((g) => g.title)).toEqual(['Alice 목표']);
    expect((await listPlans()).map((p) => p.title)).toEqual(['Alice 주']);
    expect((await listTasksByPlan(alicePlan._id)).map((t) => t.title).sort()).toEqual(['A1', 'A2']);
    expect(await getWeeklyPlanProgress(alicePlan._id)).toBe(50);
  });

  it('rejects reads/mutations when unauthenticated', async () => {
    currentToken = null;
    const { listGoals } = await import('@/app/(app)/goals/actions');
    const { createTask } = await import('@/app/(app)/tasks/actions');
    await expect(listGoals()).rejects.toThrow();
    await expect(createTask({ weeklyPlanId: null, title: 'x', status: 'todo' })).rejects.toThrow();
  });
});
