import 'server-only';

/**
 * GitHub OAuth web-application-flow helpers, kept free of Next.js request
 * APIs so the network-facing bits (token exchange, profile fetch) can be
 * unit-tested by stubbing `fetch` — see github-oauth.test.ts.
 *
 * The client secret is only ever read from `process.env` here and is never
 * logged or returned; callers pass around the short-lived access token, not
 * the secret.
 */

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const USER_API_URL = 'https://api.github.com/user';

export class OAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthConfigError';
  }
}

export class OAuthExchangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthExchangeError';
  }
}

export type GithubOAuthConfig = {
  clientId: string;
  clientSecret: string;
};

/** Reads + validates the two required env vars, throwing a clear
 *  `OAuthConfigError` (not a generic crash) when the app hasn't been
 *  configured yet. The callback URL is resolved per-request by
 *  `resolveRedirectUri`, not from env. See docs/GITHUB_OAUTH_SETUP.md. */
export function getOAuthConfig(): GithubOAuthConfig {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  const missing = [
    !clientId && 'GITHUB_CLIENT_ID',
    !clientSecret && 'GITHUB_CLIENT_SECRET',
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new OAuthConfigError(
      `GitHub OAuth 환경변수가 설정되지 않았습니다: ${missing.join(', ')}. docs/GITHUB_OAUTH_SETUP.md 참고.`
    );
  }

  return { clientId: clientId as string, clientSecret: clientSecret as string };
}

/**
 * The OAuth callback URL for this request. Prefers an explicit
 * `GITHUB_OAUTH_REDIRECT_URI` (for when the app sits behind a proxy that
 * obscures its own origin); otherwise derives `<origin>/auth/github/callback`
 * from the request, so `http://localhost:3000` and every deployed domain
 * each get their own matching callback with no extra config. Every such
 * origin must be added to the GitHub OAuth App's callback URLs (it accepts
 * several). Takes a standard web `Request`, so it stays framework-agnostic.
 */
export function resolveRedirectUri(request: Request): string {
  const override = process.env.GITHUB_OAUTH_REDIRECT_URI?.trim();
  if (override) return override;

  const url = new URL(request.url);
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(/:$/, '');
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host;
  return `${proto}://${host}/auth/github/callback`;
}

/** Builds the URL to send the browser to. `scope` is `read:user` only — the
 *  app just needs the public profile (login + avatar). */
export function buildAuthorizeUrl(
  config: GithubOAuthConfig,
  state: string,
  redirectUri: string
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: 'read:user',
    state,
    allow_signup: 'true',
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/** Exchanges the `code` from the callback for a user access token.
 *  `redirectUri` must be byte-identical to the one used in `buildAuthorizeUrl`. */
export async function exchangeCodeForToken(
  config: GithubOAuthConfig,
  code: string,
  redirectUri: string
): Promise<string> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new OAuthExchangeError(`GitHub 토큰 교환 실패 (HTTP ${response.status}).`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (data.error || !data.access_token) {
    throw new OAuthExchangeError(
      `GitHub 토큰 교환 실패: ${data.error_description ?? data.error ?? 'access_token 없음'}`
    );
  }

  return data.access_token;
}

export type GithubProfile = {
  githubId: number;
  login: string;
  avatarUrl: string;
};

/** Fetches the authenticated user's public profile and narrows it to the
 *  fields we persist. */
export async function fetchGithubProfile(accessToken: string): Promise<GithubProfile> {
  const response = await fetch(USER_API_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'todo-app',
    },
  });

  if (!response.ok) {
    throw new OAuthExchangeError(`GitHub 프로필 조회 실패 (HTTP ${response.status}).`);
  }

  const data = (await response.json()) as {
    id?: number;
    login?: string;
    avatar_url?: string;
  };

  if (typeof data.id !== 'number' || typeof data.login !== 'string') {
    throw new OAuthExchangeError('GitHub 프로필 응답이 올바르지 않습니다.');
  }

  return {
    githubId: data.id,
    login: data.login,
    avatarUrl: typeof data.avatar_url === 'string' ? data.avatar_url : '',
  };
}
