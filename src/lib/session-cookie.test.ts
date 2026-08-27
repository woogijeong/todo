import { describe, expect, it } from 'vitest';
import { safeNextPath } from './session-cookie';

describe('safeNextPath', () => {
  it('passes through same-origin paths, keeping the query string', () => {
    expect(safeNextPath('/')).toBe('/');
    expect(safeNextPath('/goals')).toBe('/goals');
    expect(safeNextPath('/plans/abc?tab=x')).toBe('/plans/abc?tab=x');
  });

  it('falls back to / for empty / non-path input', () => {
    expect(safeNextPath(undefined)).toBe('/');
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath('')).toBe('/');
    expect(safeNextPath('goals')).toBe('/');
    expect(safeNextPath('https://evil.com')).toBe('/');
  });

  it('rejects protocol-relative and backslash host bypasses', () => {
    expect(safeNextPath('//evil.com')).toBe('/');
    expect(safeNextPath('/\\evil.com')).toBe('/');
    expect(safeNextPath('/\\/evil.com')).toBe('/');
  });

  it('rejects TAB/CR/LF/control-character bypasses', () => {
    expect(safeNextPath('/\t//evil.com')).toBe('/');
    expect(safeNextPath('/\n//evil.com')).toBe('/');
    expect(safeNextPath('/\r/evil.com')).toBe('/');
    expect(safeNextPath('/\x01x')).toBe('/');
  });

  it('rejects dot-segment payloads that normalise into a protocol-relative URL', () => {
    expect(safeNextPath('/..//evil.com')).toBe('/');
    expect(safeNextPath('/a/b/../..//evil.com')).toBe('/');
    expect(safeNextPath('/%2e%2e//evil.com')).toBe('/');
    expect(safeNextPath('/..//user:pass@evil.com')).toBe('/');
  });

  it('output is same-origin and idempotent (safe to re-parse against a real base)', () => {
    const payloads = [
      '//evil.com',
      '/\\evil.com',
      '/\t\\evil.com',
      'https://evil.com/x',
      '/..//evil.com',
      '/a/b/../..//evil.com',
      '/%2e%2e//evil.com',
      '/goals?tab=x',
      '/a/../goals',
    ];
    for (const payload of payloads) {
      const out = safeNextPath(payload);
      expect(new URL(out, 'https://app.example').origin).toBe('https://app.example');
      expect(safeNextPath(out)).toBe(out);
    }
  });
});
