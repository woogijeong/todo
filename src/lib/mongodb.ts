import { MongoClient, type Db } from 'mongodb';

const options = {
  maxPoolSize: 10,
};

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function createClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    // Reject instead of throwing synchronously at import time, so modules
    // that import this file (directly or transitively) don't blow up just
    // because MONGODB_URI isn't set yet — e.g. unit tests that only exercise
    // DB-independent pure functions, or a build step that never awaits this.
    // Whoever actually awaits `clientPromise`/`getDb()` still sees the error.
    return Promise.reject(
      new Error('Missing MONGODB_URI environment variable. Set it in .env.local (see .env.local.example).')
    );
  }
  const client = new MongoClient(uri, options);
  return client.connect();
}

if (!global._mongoClientPromise) {
  global._mongoClientPromise = createClientPromise();
}
// Mark handled so Node doesn't report an unhandled rejection when nothing
// ever awaits this cached promise; real awaiters below still observe the
// rejection independently.
global._mongoClientPromise.catch(() => {});

export const clientPromise: Promise<MongoClient> = global._mongoClientPromise;

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  const dbName = process.env.MONGODB_DB ?? 'todo';
  return client.db(dbName);
}
