import type { TaskStatus } from './schemas';

export type DueBadge = '오늘 마감' | '지연' | null;

/**
 * Pure, timezone-agnostic: caller supplies `today` (already resolved via
 * `getTodayString()` for Asia/Seoul) so this stays trivially unit-testable.
 * A completed task never shows a due badge — its deadline is moot once done.
 */
export function getDueBadge(
  dueDate: string | undefined,
  status: TaskStatus,
  today: string
): DueBadge {
  if (!dueDate || status === 'done') return null;
  if (dueDate === today) return '오늘 마감';
  if (dueDate < today) return '지연';
  return null;
}
