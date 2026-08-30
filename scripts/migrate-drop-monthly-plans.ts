/**
 * One-shot migration: collapse the Monthly Plan layer.
 *
 * The app used to be Yearly Goal -> Monthly Plan -> Weekly Plan -> Task.
 * Weekly Plans now link directly to a Yearly Goal. This migration:
 *
 *   1. aborts if any (userId, weekStart) pair has more than one Weekly Plan
 *      (the new unique index would reject it — merge/delete by hand, re-run);
 *   2. copies each Weekly Plan's yearlyGoalId from its Monthly Plan, then
 *      unsets monthlyPlanId;
 *   3. unsets the now-unused taskEvents.monthlyPlanId;
 *   4. backfills tasks.completedAt (= updatedAt) for done tasks missing it, so
 *      the rebuilt stats charts have a completion date to bucket;
 *   5. swaps the weeklyPlans unique index to { userId, weekStart };
 *   6. drops the monthlyPlans collection.
 *
 * Idempotent: safe to run twice (the second run is a clean no-op).
 *
 * Run via `npm run migrate-drop-monthly`.
 */
import type { Db } from 'mongodb';

export class DuplicateWeekError extends Error {
  constructor(public readonly offenders: Array<{ userId: string; weekStart: string; ids: string[] }>) {
    super('Multiple Weekly Plans share a (userId, weekStart)');
    this.name = 'DuplicateWeekError';
  }
}

export type MigrationSummary = {
  migrated: number;
  strayRemoved: number;
  eventsCleaned: number;
  completedBackfilled: number;
  monthlyPlansDropped: boolean;
};

/** The migration body, isolated from the CLI wrapper so it can be tested. */
export async function migrateDropMonthlyPlans(db: Db, log: (m: string) => void = () => {}): Promise<MigrationSummary> {
  const weeklyPlans = db.collection('weeklyPlans');

  // 1. Pre-flight: the new unique index is { userId, weekStart } with no
  //    partial filter, so two plans for the same user+week (historically
  //    possible: one month-linked, one month-less) would make createIndex
  //    fail. Surface them and stop.
  const dups = await weeklyPlans
    .aggregate<{ _id: { userId: string; weekStart: string }; ids: unknown[] }>([
      { $group: { _id: { userId: '$userId', weekStart: '$weekStart' }, ids: { $push: '$_id' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();
  if (dups.length > 0) {
    throw new DuplicateWeekError(
      dups.map((d) => ({ userId: d._id.userId, weekStart: d._id.weekStart, ids: d.ids.map(String) }))
    );
  }

  // 2. Backfill weeklyPlans.yearlyGoalId from the monthly plan, drop monthlyPlanId.
  const monthlyPlans = await db
    .collection<{ _id: unknown; yearlyGoalId: string | null }>('monthlyPlans')
    .find({}, { projection: { yearlyGoalId: 1 } })
    .toArray();
  const goalByMonthly = new Map(monthlyPlans.map((m) => [String(m._id), m.yearlyGoalId ?? null]));

  const plansToMigrate = await weeklyPlans
    .find({ yearlyGoalId: { $exists: false } }, { projection: { monthlyPlanId: 1 } })
    .toArray();
  let migrated = 0;
  for (const plan of plansToMigrate) {
    const monthlyPlanId = (plan as { monthlyPlanId?: string | null }).monthlyPlanId ?? null;
    const yearlyGoalId = monthlyPlanId ? goalByMonthly.get(monthlyPlanId) ?? null : null;
    await weeklyPlans.updateOne(
      { _id: plan._id },
      { $set: { yearlyGoalId }, $unset: { monthlyPlanId: '' } }
    );
    migrated += 1;
  }
  const strayResult = await weeklyPlans.updateMany(
    { monthlyPlanId: { $exists: true } },
    { $unset: { monthlyPlanId: '' } }
  );
  log(`weeklyPlans: ${migrated} migrated, ${strayResult.modifiedCount} stray monthlyPlanId removed`);

  // 3. taskEvents.monthlyPlanId is gone from the schema.
  const eventsResult = await db
    .collection('taskEvents')
    .updateMany({ monthlyPlanId: { $exists: true } }, { $unset: { monthlyPlanId: '' } });
  log(`taskEvents: ${eventsResult.modifiedCount} monthlyPlanId removed`);

  // 4. Backfill completedAt for done tasks that never got one.
  const completedResult = await db
    .collection('tasks')
    .updateMany({ status: 'done', completedAt: { $in: [null, undefined] } }, [
      { $set: { completedAt: '$updatedAt' } },
    ]);
  log(`tasks: ${completedResult.modifiedCount} completedAt backfilled`);

  // 5. Swap the unique index.
  for (const legacy of [
    'monthlyPlanId_1_weekStart_1',
    'userId_1_monthlyPlanId_1_weekStart_1',
    'yearlyGoalId_1_weekStart_1',
  ]) {
    await weeklyPlans.dropIndex(legacy).catch(() => {});
  }
  await weeklyPlans.createIndex({ userId: 1, weekStart: 1 }, { unique: true });
  log('weeklyPlans: unique index -> { userId, weekStart }');

  // 6. Drop the collection.
  const monthlyPlansDropped = await db
    .collection('monthlyPlans')
    .drop()
    .then(() => {
      log('monthlyPlans: dropped');
      return true;
    })
    .catch(() => {
      log('monthlyPlans: already gone');
      return false;
    });

  return {
    migrated,
    strayRemoved: strayResult.modifiedCount,
    eventsCleaned: eventsResult.modifiedCount,
    completedBackfilled: completedResult.modifiedCount,
    monthlyPlansDropped,
  };
}

async function main(): Promise<void> {
  const { getDb, clientPromise } = await import('@/lib/mongodb');
  try {
    const db = await getDb();
    await migrateDropMonthlyPlans(db, (m) => console.log(m));
    await (await clientPromise).close();
    console.log('Done.');
    process.exit(0);
  } catch (error) {
    if (error instanceof DuplicateWeekError) {
      console.error('Aborting: multiple Weekly Plans share a (userId, weekStart):');
      for (const o of error.offenders) {
        console.error(`  userId=${o.userId} weekStart=${o.weekStart} -> ${o.ids.join(', ')}`);
      }
      console.error('Merge or delete the extras, then re-run.');
    } else {
      console.error('Migration failed:', error instanceof Error ? error.message : error);
    }
    try {
      await (await clientPromise).close();
    } catch {
      // connection never succeeded; nothing to close
    }
    process.exit(1);
  }
}

// Only run when invoked directly as a script, not when imported by a test.
if (process.argv[1] && process.argv[1].includes('migrate-drop-monthly-plans')) {
  void main();
}
