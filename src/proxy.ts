import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie';

/** Next.js 16 renamed `middleware.ts`/`export function middleware` to
 *  `proxy.ts`/`export function proxy` (functionality unchanged). This is an
 *  optimistic, cookie-only check per Next's auth guide — it keeps page
 *  navigation gated behind /login, but every Server Action still
 *  re-validates independently via requireUser() (see src/lib/auth.ts),
 *  since Proxy does not run in front of Server Actions invoked directly from
 *  a Client Component, and the presence of a cookie here is not proof the
 *  session is still valid. */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE_NAME)) {
    return NextResponse.next();
  }

  const url = new URL('/login', request.url);
  url.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  // `login` and `auth` (the OAuth routes) must stay reachable while logged
  // out. Server Actions POST to the page route they're used on, so excluding
  // a path here also skips its Server Actions — every mutation re-checks
  // auth server-side anyway.
  matcher: ['/((?!login|auth|_next/static|_next/image|favicon.ico).*)'],
};
