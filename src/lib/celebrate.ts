'use client';

/**
 * Fire-and-forget celebration signal. Any client component calls
 * `celebrate('goal' | 'day')`; the <CelebrationOverlay> mounted in the app
 * layout listens for the event and plays the confetti.
 *
 * A `localStorage` marker per milestone keeps it from firing again on every
 * later render — `markCelebrated` once it has played, `clearCelebrated` when
 * the milestone is no longer met (so re-completing a goal celebrates again).
 * Every storage access is guarded.
 */

export type CelebrationKind = 'goal' | 'day';

export const CELEBRATE_EVENT = 'chagok:celebrate';

export function celebrate(kind: CelebrationKind): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CELEBRATE_EVENT, { detail: { kind } }));
}

function key(id: string): string {
  return `chagok.celebrated.${id}`;
}

export function wasCelebrated(id: string): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(key(id)) === '1';
  } catch {
    return false;
  }
}

export function markCelebrated(id: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key(id), '1');
  } catch {
    /* storage unavailable — worst case the animation replays once */
  }
}

export function clearCelebrated(id: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key(id));
  } catch {
    /* ignore */
  }
}

/**
 * Celebrate `id` once and remember it; a later call with `met: false` clears
 * the marker so the next time the milestone is reached it celebrates again.
 * Returns true when it fired this call.
 */
export function celebrateOnce(id: string, met: boolean, kind: CelebrationKind): boolean {
  if (!met) {
    clearCelebrated(id);
    return false;
  }
  if (wasCelebrated(id)) return false;
  markCelebrated(id);
  celebrate(kind);
  return true;
}
