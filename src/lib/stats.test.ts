import { describe, expect, it } from 'vitest';
import { buildMonthHierarchy, buildWeekStat, type WeekStat } from './stats';

describe('buildWeekStat', () => {
  it('computes week progress from all tasks and day progress from only that day\'s tasks', () => {
    const plan = { _id: 'p1', title: '이번 주', weekStart: '2026-08-24', weekEnd: '2026-08-30' };
    const tasks = [
      { status: 'done' as const, dueDate: '2026-08-24' },
      { status: 'todo' as const, dueDate: '2026-08-24' },
      { status: 'done' as const, dueDate: '2026-08-26' },
      { status: 'todo' as const }, // no dueDate: counts toward the week, no day
    ];

    const week = buildWeekStat(plan, tasks);

    expect(week.progress).toBe(50); // 2 done / 4 total
    expect(week.days).toHaveLength(7);
    expect(week.days[0]).toMatchObject({ date: '2026-08-24', weekday: '월', progress: 50 }); // 1/2
    expect(week.days[2]).toMatchObject({ date: '2026-08-26', weekday: '수', progress: 100 }); // 1/1
    expect(week.days[1].progress).toBeNull(); // no tasks due 2026-08-25
  });

  it('returns null progress for a week with no tasks', () => {
    const plan = { _id: 'p2', title: '빈 주', weekStart: '2026-09-07', weekEnd: '2026-09-13' };
    const week = buildWeekStat(plan, []);
    expect(week.progress).toBeNull();
    expect(week.days.every((d) => d.progress === null)).toBe(true);
  });
});

describe('buildMonthHierarchy', () => {
  it('groups weeks by the month of their weekStart and averages non-null week progress', () => {
    const weeks: WeekStat[] = [
      { planId: 'a', title: 'A', weekStart: '2026-08-24', weekEnd: '2026-08-30', progress: 50, days: [] },
      { planId: 'b', title: 'B', weekStart: '2026-08-03', weekEnd: '2026-08-09', progress: null, days: [] },
      { planId: 'c', title: 'C', weekStart: '2026-09-07', weekEnd: '2026-09-13', progress: 80, days: [] },
    ];

    const months = buildMonthHierarchy(weeks);

    expect(months).toHaveLength(2);
    expect(months[0]).toMatchObject({ month: '2026-08', label: '2026년 8월', progress: 50 });
    expect(months[0].weeks.map((w) => w.weekStart)).toEqual(['2026-08-03', '2026-08-24']);
    expect(months[1]).toMatchObject({ month: '2026-09', label: '2026년 9월', progress: 80 });
  });

  it('returns a null month progress when every week in it is null', () => {
    const weeks: WeekStat[] = [
      { planId: 'a', title: 'A', weekStart: '2026-08-24', weekEnd: '2026-08-30', progress: null, days: [] },
    ];
    expect(buildMonthHierarchy(weeks)[0].progress).toBeNull();
  });
});
