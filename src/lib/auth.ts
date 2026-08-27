import 'server-only';
import { randomBytes } from 'node:crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ObjectId, type Db } from 'mongodb';
import { getDb } from './mongodb';
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from './session-cookie';

export class UnauthorizedError extends Error {
  constructor() {
    super('로그인이 필요합니다.');
    this.name = 'UnauthorizedError';
  }
}

/** The authenticated identity threaded through every Server Action / read.
 *  `id` is the string form of a `users._id` and is the value stored in the
 *  `userId` field of every domain document. */
export type SessionUser = {
  id: string;
  githubId: number;
  login: string;
  avatarUrl: string;
};

type UserDoc = {
  _id: ObjectId;
  githubId: number;
  login: string;
  avatarUrl: string;
  createdAt: Date;
  updatedAt: Date;
  schemaVersion: 1;
};

type SessionDoc = {
  _id: ObjectId;
  token: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
};

let authIndexesEnsured = false;

/** Idempotent; safe to call before every session/user write. Mirrors the
 *  `ensureIndexes` pattern in src/app/plans/actions.ts so the app works
 *  without a separate `npm run init-indexes` step, while that script stays
 *  the canonical place these are also declared. */
async function ensureAuthIndexes(db: Db): Promise<void> {
  if (authIndexesEnsured) return;
  await db.collection('users').createIndex({ githubId: 1 }, { unique: true });
  await db.collection('sessions').createIndex({ token: 1 }, { unique: true });
  // TTL: Mongo drops the session document itself once `expiresAt` passes, so
  // an abandoned session can't linger forever. getSessionUser still checks
  // expiry explicitly because the TTL monitor only runs about once a minute.
  await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  authIndexesEnsured = true;
}

function usersCollection(db: Db) {
  return db.collection<UserDoc>('users');
}

function sessionsCollection(db: Db) {
  return db.collection<SessionDoc>('sessions');
}

/** Reads the session cookie and resolves it to the current user, or `null`
 *  if there is no cookie, the session is unknown, or it has expired (an
 *  expired session document is deleted on the way out).
 *
 *  Wrapped in React `cache` so the several scoped reads a single page render
 *  triggers (listGoals + listPlans + progress rollups + …) share one
 *  sessions/users lookup instead of repeating it per call. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const db = await getDb();
  const session = await sessionsCollection(db).findOne({ token });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await sessionsCollection(db).deleteOne({ _id: session._id });
    return null;
  }

  if (!ObjectId.isValid(session.userId)) return null;
  const user = await usersCollection(db).findOne({ _id: new ObjectId(session.userId) });
  if (!user) return null;

  return {
    id: user._id.toString(),
    githubId: user.githubId,
    login: user.login,
    avatarUrl: user.avatarUrl,
  };
});

/** Like `getSessionUser` but throws `UnauthorizedError` when unauthenticated.
 *  Every mutating Server Action calls this — Proxy is only an optimistic UX
 *  gate and never runs in front of a Server Action invoked directly from a
 *  Client Component (see src/proxy.ts). */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireUserId(): Promise<string> {
  return (await requireUser()).id;
}

/** For Server Components: redirects to /login (clean `NEXT_REDIRECT`, no
 *  error log) instead of throwing, so a page never fires its scoped reads —
 *  which would each throw `UnauthorizedError` — while logged out. The
 *  route-group layout (src/app/(app)/layout.tsx) does the same as a
 *  backstop; calling this first in each page keeps the redirect noise-free. */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}

/** Upserts the GitHub profile into `users` (keyed on the stable numeric
 *  `githubId`) and returns the string `users._id`. */
export async function upsertGithubUser(profile: {
  githubId: number;
  login: string;
  avatarUrl: string;
}): Promise<string> {
  const db = await getDb();
  await ensureAuthIndexes(db);

  const now = new Date();
  const result = await usersCollection(db).findOneAndUpdate(
    { githubId: profile.githubId },
    {
      $set: { login: profile.login, avatarUrl: profile.avatarUrl, updatedAt: now },
      $setOnInsert: { githubId: profile.githubId, createdAt: now, schemaVersion: 1 },
    },
    { upsert: true, returnDocument: 'after' }
  );

  if (!result) throw new Error('사용자 계정을 생성하지 못했습니다.');
  return result._id.toString();
}

/** Creates a fresh session row and returns the opaque token to put in the
 *  cookie plus its expiry (for the cookie's own `expires`). */
export async function createSession(
  userId: string
): Promise<{ token: string; expiresAt: Date }> {
  const db = await getDb();
  await ensureAuthIndexes(db);

  const token = randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await sessionsCollection(db).insertOne({ token, userId, createdAt: now, expiresAt } as SessionDoc);
  return { token, expiresAt };
}

/** Hard-deletes the session row so the token can never be resolved again —
 *  this is what makes logout a complete server-side session teardown, not
 *  just a cookie clear. */
export async function deleteSession(token: string): Promise<void> {
  const db = await getDb();
  await sessionsCollection(db).deleteOne({ token });
}
