import { NextResponse, type NextRequest } from 'next/server';
import {
  OAUTH_NEXT_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  safeNextPath,
} from '@/lib/session-cookie';
import {
  exchangeCodeForToken,
  fetchGithubProfile,
  getOAuthConfig,
  OAuthConfigError,
  OAuthExchangeError,
} from '@/lib/github-oauth';
import { createSession, upsertGithubUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function loginError(request: NextRequest): NextResponse {
  const url = new URL('/login', request.url);
  // Fixed flag, not a reflected message — never let the callback place
  // attacker-controlled text on the login page.
  url.searchParams.set('error', '1');
  const response = NextResponse.redirect(url);
  // Clear the one-shot OAuth cookies regardless of outcome.
  response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
  response.cookies.delete(OAUTH_NEXT_COOKIE_NAME);
  return response;
}

export async function GET(request: NextRequest) {
  let config;
  try {
    config = getOAuthConfig();
  } catch (error) {
    if (error instanceof OAuthConfigError) {
      return new NextResponse(error.message, { status: 500 });
    }
    throw error;
  }

  const params = request.nextUrl.searchParams;
  const code = params.get('code');
  const returnedState = params.get('state');
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value;
  // Re-validate on the way out even though /auth/github already validated on
  // the way in: deliberate defense-in-depth, not redundant — the cookie
  // could have been tampered with, and `safeNextPath`'s output is what
  // `new URL(next, request.url)` below re-parses.
  const next = safeNextPath(request.cookies.get(OAUTH_NEXT_COOKIE_NAME)?.value);

  if (params.get('error') || !code || !returnedState || !expectedState || returnedState !== expectedState) {
    return loginError(request);
  }

  let profile;
  try {
    const accessToken = await exchangeCodeForToken(config, code);
    profile = await fetchGithubProfile(accessToken);
  } catch (error) {
    if (error instanceof OAuthExchangeError) {
      return loginError(request);
    }
    throw error;
  }

  const userId = await upsertGithubUser(profile);
  const { token, expiresAt } = await createSession(userId);

  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
  response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
  response.cookies.delete(OAUTH_NEXT_COOKIE_NAME);
  return response;
}
