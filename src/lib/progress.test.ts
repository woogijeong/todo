import { describe, expect, it } from 'vitest';
import { computeProgress, computeYearlyAverage } from './progress';

describe('computeProgress', () => {
  it('returns 66 (floored) for 3 tasks, 2 done', () => {
    expect(computeProgress(['done', 'done', 'todo'])).toBe(66);
  });

  it('returns 100 for 3/3 done', () => {
    expect(computeProgress(['done', 'done', 'done'])).toBe(100);
  });

  it('returns null for 0 tasks (not 0)', () => {
    expect(computeProgress([])).toBeNull();
  });

  it('does not count doing toward progress', () => {
    // 1 done, 1 doing, 2 todo out of 4 -> only the 1 done counts -> floor(25) = 25
    expect(computeProgress(['done', 'doing', 'todo', 'todo'])).toBe(25);
  });
});

describe('computeYearlyAverage', () => {
  it('averages 50, 100, and excludes a null (empty) plan -> 75', () => {
    expect(computeYearlyAverage([50, 100, null])).toBe(75);
  });

  it('returns null when every child plan is null (no plans have tasks)', () => {
    expect(computeYearlyAverage([null, null])).toBeNull();
  });

  it('returns null for an empty list of plans', () => {
    expect(computeYearlyAverage([])).toBeNull();
  });
});
