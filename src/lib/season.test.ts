import { describe, it, expect } from 'vitest';
import { defaultSeasonForMonth, isSeason, SEASONS } from './season';

describe('defaultSeasonForMonth', () => {
  it('maps spring months (3–5) to 봄', () => {
    expect([3, 4, 5].map(defaultSeasonForMonth)).toEqual(['봄', '봄', '봄']);
  });

  it('maps summer months (6–8) to 여름', () => {
    expect([6, 7, 8].map(defaultSeasonForMonth)).toEqual(['여름', '여름', '여름']);
  });

  it('maps autumn months (9–11) to 가을', () => {
    expect([9, 10, 11].map(defaultSeasonForMonth)).toEqual(['가을', '가을', '가을']);
  });

  it('maps winter months (12, 1, 2) to 겨울', () => {
    expect([12, 1, 2].map(defaultSeasonForMonth)).toEqual(['겨울', '겨울', '겨울']);
  });

  it('covers every month with a valid season', () => {
    for (let m = 1; m <= 12; m++) {
      expect(SEASONS).toContain(defaultSeasonForMonth(m));
    }
  });
});

describe('isSeason', () => {
  it('accepts the four seasons and rejects anything else', () => {
    expect(isSeason('봄')).toBe(true);
    expect(isSeason('가을')).toBe(true);
    expect(isSeason('spring')).toBe(false);
    expect(isSeason('')).toBe(false);
    expect(isSeason(null)).toBe(false);
    expect(isSeason(3)).toBe(false);
  });
});
