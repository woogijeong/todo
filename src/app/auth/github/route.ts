import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import {
  OAUTH_NEXT_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME,
  safeNextPath,
} from '@/lib/session-cookie';
import { buildAuthorizeUrl, getOAuthConfig, OAuthConfigError } from '@/lib/github-oauth';

export const dynamic = 'force-dynamic';

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

  const state = randomBytes(16).toString('hex');
  const next = safeNextPath(request.nextUrl.searchParams.get('next'));

  const response = NextResponse.redirect(buildAuthorizeUrl(config, state));

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 10, // 10 minutes to complete the round-trip
  };
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, state, cookieOptions);
  response.cookies.set(OAUTH_NEXT_COOKIE_NAME, next, cookieOptions);

  return response;
}
