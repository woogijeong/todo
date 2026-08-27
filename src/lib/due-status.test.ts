import { describe, expect, it } from 'vitest';
import { getDueBadge } from './due-status';

describe('getDueBadge', () => {
  const today = '2026-08-25';

  it('returns "오늘 마감" when dueDate equals today', () => {
    expect(getDueBadge('2026-08-25', 'todo', today)).toBe('오늘 마감');
  });

  it('returns "지연" when dueDate is before today', () => {
    expect(getDueBadge('2026-08-20', 'doing', today)).toBe('지연');
  });

  it('returns null when dueDate is in the future', () => {
    expect(getDueBadge('2026-08-30', 'todo', today)).toBeNull();
  });

  it('returns null when there is no dueDate', () => {
    expect(getDueBadge(undefined, 'todo', today)).toBeNull();
  });

  it('returns null for a done task even if overdue', () => {
    expect(getDueBadge('2026-08-20', 'done', today)).toBeNull();
  });

  it('returns null for a done task due today', () => {
    expect(getDueBadge('2026-08-25', 'done', today)).toBeNull();
  });
});
