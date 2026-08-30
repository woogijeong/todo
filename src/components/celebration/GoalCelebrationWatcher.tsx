'use client';

import { useEffect } from 'react';
import { celebrateOnce } from '@/lib/celebrate';

/**
 * Renders nothing. Whenever a goal in `goals` is at 100%, celebrates it once
 * (per-goal `localStorage` marker); if it later drops below 100 the marker is
 * cleared so re-completing it celebrates again. Mounted wherever the server
 * has just computed goal progress — dashboard, goals list, goal detail — so a
 * goal finished on the board fires as soon as the next of those screens loads.
 */
export default function GoalCelebrationWatcher({
  goals,
}: {
  goals: Array<{ id: string; progress: number | null }>;
}) {
  const signature = goals.map((g) => `${g.id}:${g.progress}`).join('|');

  useEffect(() => {
    for (const goal of goals) {
      celebrateOnce(`goal.${goal.id}`, goal.progress === 100, 'goal');
    }
    // `signature` collapses the goal list to a primitive so the effect only
    // re-runs when a progress value actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return null;
}
