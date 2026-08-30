import { describe, expect, it } from 'vitest';
import {
  aggregateGoalCumulative,
  bucketDailyCompletions,
  buildWeeklyCompletionSeries,
} from './stats';
import type { TaskStatus } from './schemas';

const S = (n: number, done: number): TaskStatus[] => [
  ...Array<TaskStatus>(done).fill('done'),
  ...Array<TaskStatus>(n - done).fill('todo'),
];

describe('buildWeeklyCompletionSeries', () => {
  it('keeps only the most recent 12 weeks, oldest first, and flags the current week', () => {
    const clean = Array.from({ length: 15 }, (_, i) => ({
      planId: `p${i}`,
      weekStart: `2026-01-${String(i + 1).padStart(2, '0')}`,
      statuses: S(4, Math.min(i, 4)),
    }));

    const series = buildWeeklyCompletionSeries(clean, '2026-01-15');

    expect(series).toHaveLength(12);
    expect(series[0].weekStart).toBe('2026-01-04'); // weeks 1..3 dropped
    expect(series[series.length - 1].weekStart).toBe('2026-01-15');
    expect(series[series.length - 1].isCurrent).toBe(true);
    expect(series[0].isCurrent).toBe(false);
  });

  it('reports null progress for a plan with no tasks', () => {
    const series = buildWeeklyCompletionSeries(
      [{ planId: 'p1', weekStart: '2026-02-02', statuses: [] }],
      '2026-02-09'
    );
    expect(series[0].progress).toBeNull();
  });
});

describe('bucketDailyCompletions', () => {
  it('produces 30 day buckets ending on today, counting per date', () => {
    const buckets = bucketDailyCompletions(
      ['2026-08-30', '2026-08-30', '2026-08-28', '2026-07-01'],
      '2026-08-30'
    );
    expect(buckets).toHaveLength(30);
    expect(buckets[29]).toMatchObject({ date: '2026-08-30', count: 2 });
    expect(buckets[27]).toMatchObject({ date: '2026-08-28', count: 1 });
    // 2026-07-01 is outside the 30-day window -> ignored
    expect(buckets.reduce((s, b) => s + b.count, 0)).toBe(3);
  });
});

describe('aggregateGoalCumulative', () => {
  const titles = new Map([
    ['g1', '사이드 프로젝트'],
    ['g2', '책 읽기'],
  ]);

  it('groups by goal, sorts named goals by count desc, and puts 목표 없음 last', () => {
    const rows = [
      { yearlyGoalId: 'g1' },
      { yearlyGoalId: 'g1' },
      { yearlyGoalId: 'g2' },
      { yearlyGoalId: null },
      { yearlyGoalId: 'unknown-id' }, // not in titles -> 목표 없음 bucket
    ];
    const result = aggregateGoalCumulative(rows, titles);

    expect(result.map((r) => [r.title, r.count])).toEqual([
      ['사이드 프로젝트', 2],
      ['책 읽기', 1],
      ['목표 없음', 2],
    ]);
  });

  it('omits the 목표 없음 row when every completion maps to a known goal', () => {
    const result = aggregateGoalCumulative([{ yearlyGoalId: 'g1' }], titles);
    expect(result).toEqual([{ goalId: 'g1', title: '사이드 프로젝트', count: 1 }]);
  });
});
