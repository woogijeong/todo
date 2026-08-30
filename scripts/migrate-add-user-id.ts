/**
 * One-shot migration: assign every pre-auth document an owner.
 *
 * Before GitHub OAuth the app had a single implicit user, so the existing
 * yearlyGoals / weeklyPlans / tasks / taskEvents documents have no `userId`.
 * This backfills them with the `users._id` of the GitHub account named by
 * `SEED_OWNER_GITHUB_LOGIN`.
 *
 * Prerequisite: that GitHub account must have logged in at least once (so a
 * `users` row exists). Run:
 *
 *   SEED_OWNER_GITHUB_LOGIN=your-github-login npm run migrate-user-id
 *
 * Idempotent: only documents missing `userId` are touched, so re-running is
 * a no-op.
 */
import { getDb, clientPromise } from '@/lib/mongodb';

const COLLECTIONS = [
  'yearlyGoals',
  'weeklyPlans',
  'tasks',
  'taskEvents',
] as const;

async function main(): Promise<void> {
  const login = process.env.SEED_OWNER_GITHUB_LOGIN;
  if (!login) {
    throw new Error(
      'SEED_OWNER_GITHUB_LOGIN 환경변수를 설정하세요. 예: SEED_OWNER_GITHUB_LOGIN=octocat npm run migrate-user-id'
    );
  }

  const db = await getDb();
  const user = await db.collection('users').findOne({ login });
  if (!user) {
    throw new Error(
      `GitHub 로그인 "${login}" 에 해당하는 사용자가 없습니다. 먼저 그 계정으로 앱에 로그인한 뒤 다시 실행하세요.`
    );
  }

  const userId = user._id.toString();
  console.log(`Backfilling userId=${userId} (login: ${login})`);

  for (const name of COLLECTIONS) {
    const result = await db
      .collection(name)
      .updateMany({ userId: { $exists: false } }, { $set: { userId } });
    console.log(`  ${name}: ${result.modifiedCount} document(s) updated`);
  }
}

main()
  .then(async () => {
    const client = await clientPromise;
    await client.close();
    console.log('Done.');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Migration failed:', error instanceof Error ? error.message : error);
    try {
      const client = await clientPromise;
      await client.close();
    } catch {
      // connection never succeeded; nothing to close
    }
    process.exit(1);
  });
