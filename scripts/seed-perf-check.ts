/**
 * US-019 perf/QA check: seeds ~2,000 Task documents (plus their Weekly
 * Plans, Yearly Goals, and the taskEvents each status transition would have
 * produced) into a REAL MongoDB engine, applies the same indexes
 * `scripts/init-indexes.ts` creates in production, and times the board
 * query and the stats hierarchy against that data.
 *
 * Uses `mongodb-memory-server` (a real mongod binary, run in-process) rather
 * than mocking Mongo, so the timings reflect genuine query execution and
 * the index usage actually matters — not a fabricated number. If a real
 * MONGODB_URI is set in the environment, that's used instead (so this can
 * also be run against a real Atlas cluster later without changes).
 *
 * Run via `npm run seed-perf-check`.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

async function main(): Promise<void> {
  let mongod: import('mongodb-memory-server').MongoMemoryServer | undefined;

  if (!process.env.MONGODB_URI) {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    console.log(`Using in-process mongodb-memory-server: ${process.env.MONGODB_URI}`);
  } else {
    console.log(`Using configured MONGODB_URI: ${process.env.MONGODB_URI}`);
  }

  // Imported AFTER MONGODB_URI is set, and only actually connects on first
  // `getDb()` call (lazy by design — see src/lib/mongodb.ts) — so setting
  // the env var above, before this point, is what makes the real app code
  // pick up the in-memory server instead of throwing/needing Atlas.
  const { getDb } = await import('@/lib/mongodb');
  const { listTasksByPlan } = await import('@/app/(app)/tasks/actions');
  const { getWeeklyPlanProgress, getYearlyGoalProgress } = await import('@/lib/progress');
  const { getStatsSnapshot } = await import('@/lib/stats');
  const { getWeekStart, getWeekEnd } = await import('@/lib/date');

  const db = await getDb();

  console.log('Creating indexes (same specs as scripts/init-indexes.ts)...');
  await db
    .collection('tasks')
    .createIndexes([{ key: { weeklyPlanId: 1, status: 1 } }, { key: { dueDate: 1 } }]);
  await db
    .collection('weeklyPlans')
    .createIndex({ userId: 1, weekStart: 1 }, { unique: true });

  console.log('Seeding: 3 yearly goals, ~12 weekly plans, 2000 tasks, ~2000 taskEvents...');
  const now = new Date();

  const goalIds: string[] = [];
  for (let g = 0; g < 3; g++) {
    const result = await db.collection('yearlyGoals').insertOne({
      title: `목표 ${g + 1}`,
      year: 2026,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    });
    goalIds.push(result.insertedId.toString());
  }

  // Yearly Goal -> Weekly Plan -> Task. Some weekly plans intentionally
  // goal-less (yearlyGoalId: null).
  const planIds: string[] = [];
  for (let w = 0; w < 12; w++) {
    const weekStart = getWeekStart(new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000));
    const weekEnd = getWeekEnd(weekStart);
    const yearlyGoalId = w % 4 === 0 ? null : goalIds[w % 3];
    const result = await db.collection('weeklyPlans').insertOne({
      yearlyGoalId,
      title: `주간 계획 ${w + 1}`,
      weekStart,
      weekEnd,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    });
    planIds.push(result.insertedId.toString());
  }

  const TASK_COUNT = 2000;
  const statuses = ['todo', 'doing', 'done'] as const;
  const taskDocs = [];
  const eventDocs = [];
  for (let i = 0; i < TASK_COUNT; i++) {
    const weeklyPlanId = planIds[i % planIds.length];
    const status = statuses[i % 3];

    taskDocs.push({
      weeklyPlanId,
      title: `할 일 ${i + 1}`,
      status,
      completedAt:
        status === 'done'
          ? new Date(now.getTime() - (i % 90) * 24 * 60 * 60 * 1000)
          : null,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    });

    if (status !== 'todo') {
      eventDocs.push({
        taskId: `seed-${i}`,
        weeklyPlanId,
        fromStatus: 'todo',
        toStatus: status,
        occurredAt: new Date(now.getTime() - (i % 90) * 24 * 60 * 60 * 1000),
      });
    }
  }
  await db.collection('tasks').insertMany(taskDocs);
  await db.collection('taskEvents').insertMany(eventDocs);
  console.log(`Seeded ${taskDocs.length} tasks, ${eventDocs.length} taskEvents.`);

  async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const ms = performance.now() - start;
    console.log(`  ${label}: ${ms.toFixed(1)}ms`);
    return result;
  }

  console.log('\n--- Query timings (indexes applied) ---');
  await time('board query: listTasksByPlan(one plan id)', () => listTasksByPlan(planIds[0]));
  await time('progress: getWeeklyPlanProgress(one plan)', () => getWeeklyPlanProgress(planIds[0]));
  await time('progress: getYearlyGoalProgress(one goal)', () => getYearlyGoalProgress(goalIds[0]));
  await time('stats: getStatsSnapshot (12 weeks + 30 days + goal totals)', () => getStatsSnapshot());

  // The app's own MongoClient (getDb()/clientPromise in src/lib/mongodb.ts)
  // keeps an open connection pool alive for the life of the process — that's
  // correct for a long-lived Next.js server, but this is a one-shot CLI
  // script, so it must close that client explicitly or the event loop never
  // drains and the process hangs after printing all its output.
  const client = await (await import('@/lib/mongodb')).clientPromise;
  await client.close();

  if (mongod) {
    await mongod.stop();
  }
  console.log('\nDone.');
  process.exit(0);
}

main().catch((error) => {
  console.error('seed-perf-check failed:', error);
  process.exit(1);
});
