/**
 * One-shot CLI script to create MongoDB indexes ahead of time.
 * Run via `npm run init-indexes`.
 *
 * Uses `getDb()` from `@/lib/mongodb` (the same connection helper used at
 * runtime) rather than a standalone MongoClient, so the index specs and DB
 * name resolution (MONGODB_DB, default 'todo') stay consistent with the app.
 * tsx resolves the `@/*` path alias from tsconfig.json, so this import works
 * unmodified when run as a script.
 */
import { getDb, clientPromise } from '@/lib/mongodb';

async function main(): Promise<void> {
  const db = await getDb();

  // `userId`-prefixed so the common "this user's tasks in this plan" query is
  // fully covered; the plain `{ weeklyPlanId, status }` / `{ dueDate }` forms
  // are kept for the derive-on-read progress aggregations.
  const tasksIndexes = await db
    .collection('tasks')
    .createIndexes([
      { key: { userId: 1, weeklyPlanId: 1, status: 1 } },
      { key: { weeklyPlanId: 1, status: 1 } },
      { key: { dueDate: 1 } },
    ]);
  console.log('Created indexes on tasks:', tasksIndexes);

  // Auth collections (see src/lib/auth.ts — also ensured lazily there).
  const usersIndex = await db
    .collection('users')
    .createIndex({ githubId: 1 }, { unique: true });
  console.log('Created index on users:', usersIndex);

  const sessionsIndexes = await db
    .collection('sessions')
    .createIndexes([
      { key: { token: 1 }, unique: true },
      // TTL: Mongo removes the session document once `expiresAt` passes.
      { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
    ]);
  console.log('Created indexes on sessions:', sessionsIndexes);

  // Same spec as ensureIndexes() in src/app/(app)/plans/actions.ts — must
  // match exactly so creating it here and at runtime is idempotent, not a
  // conflict. `userId` leads the key: exactly one plan per week, per user.
  for (const legacy of [
    'monthlyPlanId_1_weekStart_1',
    'userId_1_monthlyPlanId_1_weekStart_1',
    'yearlyGoalId_1_weekStart_1',
  ]) {
    await db.collection('weeklyPlans').dropIndex(legacy).catch(() => {});
  }
  const weeklyPlansIndex = await db
    .collection('weeklyPlans')
    .createIndex({ userId: 1, weekStart: 1 }, { unique: true });
  console.log('Created index on weeklyPlans:', weeklyPlansIndex);
}

main()
  .then(async () => {
    const client = await clientPromise;
    await client.close();
    console.log('Done.');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Failed to create indexes:', error);
    try {
      const client = await clientPromise;
      await client.close();
    } catch {
      // connection never succeeded; nothing to close
    }
    process.exit(1);
  });
