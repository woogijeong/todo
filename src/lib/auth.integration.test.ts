import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { SESSION_COOKIE_NAME } from './session-cookie';

let currentToken: string | null = null;
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === SESSION_COOKIE_NAME && currentToken
        ? { name, value: currentToken }
        : undefined,
  }),
}));

describe('session lifecycle (US-002 / US-004)', () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.MONGODB_DB = 'auth-lifecycle-test';
  });

  afterAll(async () => {
    const { clientPromise } = await import('./mongodb');
    const client = await clientPromise;
    await client.close();
    await mongod.stop();
  });

  it('upsertGithubUser is keyed on githubId and updates login/avatar on re-login', async () => {
    const { upsertGithubUser } = await import('./auth');
    const id1 = await upsertGithubUser({ githubId: 7, login: 'old', avatarUrl: 'a1' });
    const id2 = await upsertGithubUser({ githubId: 7, login: 'new', avatarUrl: 'a2' });
    expect(id2).toBe(id1);

    const { getDb } = await import('./mongodb');
    const { ObjectId } = await import('mongodb');
    const user = await getDb().then((db) =>
      db.collection('users').findOne({ _id: new ObjectId(id1) })
    );
    expect(user).toMatchObject({ githubId: 7, login: 'new', avatarUrl: 'a2' });
  });

  it('createSession → getSessionUser resolves; logout deletes the row and the token no longer resolves', async () => {
    const { upsertGithubUser, createSession, deleteSession, getSessionUser } = await import('./auth');
    const userId = await upsertGithubUser({ githubId: 8, login: 'sam', avatarUrl: 'av' });

    const { token } = await createSession(userId);
    currentToken = token;

    const resolved = await getSessionUser();
    expect(resolved).toMatchObject({ id: userId, githubId: 8, login: 'sam', avatarUrl: 'av' });

    // Full logout: the session document is removed.
    await deleteSession(token);
    expect(await getSessionUser()).toBeNull();

    const { getDb } = await import('./mongodb');
    const remaining = await getDb().then((db) => db.collection('sessions').countDocuments({ token }));
    expect(remaining).toBe(0);
  });

  it('an expired session resolves to null and is cleaned up', async () => {
    const { upsertGithubUser, getSessionUser } = await import('./auth');
    const { getDb } = await import('./mongodb');
    const userId = await upsertGithubUser({ githubId: 9, login: 'exp', avatarUrl: '' });
    const db = await getDb();
    await db.collection('sessions').insertOne({
      token: 'expired-token',
      userId,
      createdAt: new Date(Date.now() - 120_000),
      expiresAt: new Date(Date.now() - 60_000),
    });
    currentToken = 'expired-token';
    expect(await getSessionUser()).toBeNull();
    expect(await db.collection('sessions').countDocuments({ token: 'expired-token' })).toBe(0);
  });
});
