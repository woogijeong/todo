import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APP_TZ,
  addDays,
  getMonthWeekStarts,
  getTodayString,
  getWeekDates,
  getWeekEnd,
  getWeekStart,
  getWeekdayLabel,
} from './date';

describe('APP_TZ', () => {
  it('is Asia/Seoul', () => {
    expect(APP_TZ).toBe('Asia/Seoul');
  });
});

describe('getWeekStart', () => {
  it('returns the Monday for a Tuesday in KST (2026-08-25 is confirmed a Tuesday)', () => {
    const date = new Date('2026-08-25T12:00:00+09:00');
    expect(getWeekStart(date, 'Asia/Seoul')).toBe('2026-08-24');
  });

  it('handles the year boundary without off-by-one errors from naive ISO week/year math', () => {
    // 2026-12-29 is confirmed a Tuesday in Asia/Seoul (verified via
    // Intl.DateTimeFormat weekday lookup). Its week runs Monday 2026-12-28
    // through Sunday 2027-01-03, straddling the calendar year boundary.
    // A naive implementation that derives the Monday by combining the ISO
    // week number with `date.getFullYear()` would compute a Monday in the
    // wrong year (e.g. read back a 2027 Monday) because the ISO week
    // containing late-December dates can belong to the following year's
    // week-numbering scheme. Returning a real calendar date instead avoids
    // that bug.
    const date = new Date('2026-12-29T12:00:00+09:00');
    expect(getWeekStart(date, 'Asia/Seoul')).toBe('2026-12-28');
  });
});

describe('getTodayString', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the Asia/Seoul calendar date even when system time is UTC and it is a different day there', () => {
    // 2026-08-25T16:00:00Z is 2026-08-26T01:00:00+09:00 in KST — already the
    // next calendar day in Seoul while still 2026-08-25 in UTC. This is the
    // exact case a naive `new Date().toISOString().slice(0,10)` gets wrong.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-25T16:00:00Z'));
    expect(getTodayString('Asia/Seoul')).toBe('2026-08-26');
  });
});

describe('getWeekEnd', () => {
  it('returns weekStart + 6 days', () => {
    expect(getWeekEnd('2026-08-24')).toBe('2026-08-30');
  });

  it('handles a year-boundary week start correctly', () => {
    expect(getWeekEnd('2026-12-28')).toBe('2027-01-03');
  });
});

describe('addDays', () => {
  it('steps forward across a month boundary', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02');
  });

  it('steps backward across a year boundary', () => {
    expect(addDays('2027-01-02', -5)).toBe('2026-12-28');
  });
});

describe('getWeekdayLabel', () => {
  it('returns 월 for a known Monday', () => {
    expect(getWeekdayLabel('2026-08-24')).toBe('월');
  });

  it('returns 일 for a known Sunday', () => {
    expect(getWeekdayLabel('2026-08-30')).toBe('일');
  });
});

describe('getWeekDates', () => {
  it('returns the 7 Monday-to-Sunday dates for a week start', () => {
    expect(getWeekDates('2026-08-24')).toEqual([
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
    ]);
  });
});

describe('getMonthWeekStarts', () => {
  it('includes a leading week-start from the previous month when the 1st is not a Monday', () => {
    // 2026-08-01 is a Saturday, so the week containing it starts 2026-07-27.
    expect(getMonthWeekStarts('2026-08')).toEqual([
      '2026-07-27',
      '2026-08-03',
      '2026-08-10',
      '2026-08-17',
      '2026-08-24',
      '2026-08-31',
    ]);
  });
});
