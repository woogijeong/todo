'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie';
import { deleteSession } from '@/lib/auth';

/** Full logout: delete the session row (so the token can never resolve
 *  again) and clear the cookie, then bounce to /login. */
export async function logout(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await deleteSession(token);
    store.delete(SESSION_COOKIE_NAME);
  }
  redirect('/login');
}
