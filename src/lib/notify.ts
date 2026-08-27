'use client';

/**
 * Tab-open-only browser notifications. There is no service worker and no
 * background push in this app (see docs/.omc/plans/todo-app-plan.md — 기한
 * 알림 절: background push isn't feasible without auth + Vercel Hobby cron
 * limits), so a notification only ever fires while this tab is open and the
 * task's due badge is visible. All functions are safe to import from a
 * Server Component module graph (React only actually calls them from
 * useEffect/event handlers on the client), but each still guards on
 * `typeof window !== 'undefined'` so they're inert if ever evaluated during
 * SSR or in a non-browser test environment.
 */

function storageKey(taskId: string, dateStr: string): string {
  return `todo-app:notified:${taskId}:${dateStr}`;
}

/** Must be called from inside a user-gesture event handler (a button's
 *  onClick) — never on mount/page-load, since browsers require that. */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
}

export function hasNotifiedToday(taskId: string, dateStr: string): boolean {
  if (typeof window === 'undefined') return true; // fail closed: never fire from a non-browser context
  try {
    return window.localStorage.getItem(storageKey(taskId, dateStr)) === '1';
  } catch {
    return true; // storage unavailable (private mode etc.) — fail closed rather than spam
  }
}

function markNotifiedToday(taskId: string, dateStr: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(taskId, dateStr), '1');
  } catch {
    // storage unavailable — nothing to do, worst case is a possible repeat notification
  }
}

/**
 * Fires a due-date notification for one task if, and only if: permission is
 * already granted (never requests it here), the task hasn't already been
 * notified today, and the caller has already excluded completed tasks
 * (this function itself doesn't know task status — callers filter by
 * `getDueBadge` returning non-null, which already excludes 'done').
 */
export function notifyDueTask(taskId: string, title: string, dateStr: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (hasNotifiedToday(taskId, dateStr)) return;

  new Notification(title, { body });
  markNotifiedToday(taskId, dateStr);
}
