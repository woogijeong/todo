import { ObjectId, type Db } from 'mongodb';

export class NotFoundError extends Error {
  constructor(entity: string) {
    super(`${entity}을(를) 찾을 수 없습니다.`);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class DuplicateWeeklyPlanError extends Error {
  constructor() {
    super('이미 같은 주에 대한 주간 계획이 존재합니다.');
    this.name = 'DuplicateWeeklyPlanError';
  }
}

/** Parses a client-supplied id string into an ObjectId, or returns null if invalid.
 *  Callers MUST check for null and respond with a not-found result instead of
 *  letting `new ObjectId(id)` throw a raw BSONError. */
export function parseObjectId(id: string): ObjectId | null {
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

/** Confirms `id` names a document in `collection` owned by `userId`, throwing
 *  `ValidationError` otherwise (a malformed id fails the same way — a
 *  well-formed id is not a capability). Used on write paths so a caller can't
 *  attach a task to, or plant a row referencing, another user's parent
 *  document, and so the error never distinguishes "not yours" from
 *  "doesn't exist". */
export async function assertParentOwned(
  db: Db,
  collection: string,
  id: string,
  userId: string,
  entityLabel: string
): Promise<void> {
  const objectId = parseObjectId(id);
  const doc = objectId
    ? await db.collection(collection).findOne({ _id: objectId, userId }, { projection: { _id: 1 } })
    : null;
  if (!doc) throw new ValidationError(`상위 ${entityLabel}을 찾을 수 없습니다.`);
}
