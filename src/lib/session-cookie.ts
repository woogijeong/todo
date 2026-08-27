/** Shared between src/proxy.ts (runs before the app, no `server-only`
 *  allowed) and src/lib/auth.ts (Server Components / Actions / Route
 *  Handlers), so it must stay free of any server-only import or side effect.
 *
 *  Replaces the old shared-access-code cookie: the value is now an opaque
 *  per-session token (see src/lib/auth.ts `createSession`), never a secret
 *  that is the same for every visitor. */
export const SESSION_COOKIE_NAME = 'todo_session';

/** OAuth CSRF `state` + post-login redirect target, set on the way out to
 *  GitHub and read back in the callback. Short-lived, cleared after use. */
export const OAUTH_STATE_COOKIE_NAME = 'todo_oauth_state';
export const OAUTH_NEXT_COOKIE_NAME = 'todo_oauth_next';

/** 30 days, matching the old access-code cookie's lifetime. */
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

/**
 * Normalises an untrusted post-login redirect target to a same-origin path,
 * or `/` if it is anything else. Shared (not inlined) by every producer and
 * consumer of a `next` value — the OAuth entry route, the OAuth callback,
 * and the login page — so the check can never drift between them.
 *
 * A leading-slash check alone is not enough:
 *  - `//host` and `/\host` both resolve cross-origin (`\` is normalised to
 *    `/` by the WHATWG URL parser for special schemes), and
 *  - a TAB / CR / LF between the slashes (`/\thost`) is stripped by the
 *    parser, reintroducing the bypass.
 * So we reject backslashes and C0 controls outright, then require the value
 * to still resolve to the throwaway probe origin.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/')) return '/';
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    if (raw[i] === '\\' || code < 0x20 || code === 0x7f) return '/';
  }
  try {
    const probe = new URL(raw, 'http://redirect.invalid');
    if (probe.origin !== 'http://redirect.invalid') return '/';
    const path = probe.pathname + probe.search;
    // Dot-segment normalisation (`/..//evil.com` → `//evil.com`) can turn an
    // input that passed the checks above into a protocol-relative URL. Reject
    // the output too, so the result is safe to re-parse against a real base
    // (it is — the OAuth entry route and the login page both do).
    if (path.startsWith('//')) return '/';
    return path;
  } catch {
    return '/';
  }
}
