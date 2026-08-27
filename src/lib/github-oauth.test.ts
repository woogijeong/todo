import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchGithubProfile,
  getOAuthConfig,
  OAuthConfigError,
  OAuthExchangeError,
} from './github-oauth';

const config = {
  clientId: 'cid',
  clientSecret: 'secret',
  redirectUri: 'http://localhost:3000/auth/github/callback',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('getOAuthConfig', () => {
  it('throws OAuthConfigError naming every missing var', () => {
    vi.stubEnv('GITHUB_CLIENT_ID', '');
    vi.stubEnv('GITHUB_CLIENT_SECRET', '');
    vi.stubEnv('GITHUB_OAUTH_REDIRECT_URI', '');
    try {
      getOAuthConfig();
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(OAuthConfigError);
      expect((e as Error).message).toContain('GITHUB_CLIENT_ID');
      expect((e as Error).message).toContain('GITHUB_CLIENT_SECRET');
      expect((e as Error).message).toContain('GITHUB_OAUTH_REDIRECT_URI');
    }
  });

  it('returns the three values when all are set', () => {
    vi.stubEnv('GITHUB_CLIENT_ID', 'cid');
    vi.stubEnv('GITHUB_CLIENT_SECRET', 'secret');
    vi.stubEnv('GITHUB_OAUTH_REDIRECT_URI', 'http://x/cb');
    expect(getOAuthConfig()).toEqual({
      clientId: 'cid',
      clientSecret: 'secret',
      redirectUri: 'http://x/cb',
    });
  });
});

describe('buildAuthorizeUrl', () => {
  it('targets github.com with client_id, redirect_uri, read:user scope and state', () => {
    const url = new URL(buildAuthorizeUrl(config, 'st4te'));
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('cid');
    expect(url.searchParams.get('redirect_uri')).toBe(config.redirectUri);
    expect(url.searchParams.get('scope')).toBe('read:user');
    expect(url.searchParams.get('state')).toBe('st4te');
  });
});

describe('exchangeCodeForToken', () => {
  it('posts the code and returns the access_token', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ access_token: 'gho_abc' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const token = await exchangeCodeForToken(config, 'the-code');
    expect(token).toBe('gho_abc');

    const [calledUrl, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe('https://github.com/login/oauth/access_token');
    expect(JSON.parse(String(init.body))).toMatchObject({
      client_id: 'cid',
      client_secret: 'secret',
      code: 'the-code',
    });
  });

  it('throws OAuthExchangeError when GitHub returns an error payload', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: 'bad_verification_code', error_description: 'expired' }),
      { status: 200 }
    )));
    await expect(exchangeCodeForToken(config, 'x')).rejects.toBeInstanceOf(OAuthExchangeError);
  });

  it('throws OAuthExchangeError on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    await expect(exchangeCodeForToken(config, 'x')).rejects.toBeInstanceOf(OAuthExchangeError);
  });
});

describe('fetchGithubProfile', () => {
  it('maps id/login/avatar_url to githubId/login/avatarUrl', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            id: 42,
            login: 'octocat',
            avatar_url: 'https://avatars/x.png',
            bio: 'ignored',
          }),
          { status: 200 }
        )
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const profile = await fetchGithubProfile('gho_abc');
    expect(profile).toEqual({ githubId: 42, login: 'octocat', avatarUrl: 'https://avatars/x.png' });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer gho_abc');
  });

  it('throws when the profile is missing id/login', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ login: 'x' }), { status: 200 })));
    await expect(fetchGithubProfile('t')).rejects.toBeInstanceOf(OAuthExchangeError);
  });
});
