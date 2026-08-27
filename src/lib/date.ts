export const APP_TZ = 'Asia/Seoul';

/**
 * Today's calendar date as 'YYYY-MM-DD' in `tz` (default Asia/Seoul), derived
 * via Intl so it's correct regardless of the server's or browser's own
 * timezone — never `new Date().toISOString()` (UTC) or `toLocaleDateString()`
 * (host locale/timezone), both of which can disagree with Asia/Seoul.
 */
export function getTodayString(tz: string = APP_TZ): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  const day = parts.find((p) => p.type === 'day')!.value;
  return `${year}-${month}-${day}`;
}

/**
 * Returns the Monday of the week containing `date`, as 'YYYY-MM-DD',
 * using the calendar date in `tz` (not the server's local time or naive UTC-offset math).
 */
export function getWeekStart(date: Date, tz: string = APP_TZ): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = Number(parts.find((p) => p.type === 'year')!.value);
  const month = Number(parts.find((p) => p.type === 'month')!.value);
  const day = Number(parts.find((p) => p.type === 'day')!.value);

  // Noon UTC avoids any DST/offset edge cases when deriving the weekday and
  // stepping back to Monday, since only the calendar date (not the time) matters here.
  const asUtcNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const weekday = asUtcNoon.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysSinceMonday = (weekday + 6) % 7;

  const monday = new Date(asUtcNoon);
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);

  return monday.toISOString().slice(0, 10);
}

/**
 * Given a week-start date string ('YYYY-MM-DD', a Monday), returns the week-end
 * date string (that Monday + 6 days, i.e. the Sunday). Pure date math on the
 * plain string; no timezone is needed since weekStartStr is already a calendar date.
 */
export function getWeekEnd(weekStartStr: string): string {
  const [year, month, day] = weekStartStr.split('-').map(Number);
  const end = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  end.setUTCDate(end.getUTCDate() + 6);
  return end.toISOString().slice(0, 10);
}

/**
 * Steps a 'YYYY-MM-DD' string by `days` calendar days (positive or negative).
 * Pure date math; parses at UTC noon (not midnight) to sidestep any
 * DST/offset edge cases when only the calendar date matters, not the time.
 * The single canonical version of this logic — previously duplicated with
 * slightly different (midnight-parse) implementations in
 * next-week-actions.ts and TaskBoard.tsx.
 */
export function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Sunday-first, matching `Date.getUTCDay()`'s 0=Sunday indexing. */
export const WEEKDAY_LABELS_SUN_FIRST = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** Korean weekday label ('일'..'토') for a 'YYYY-MM-DD' calendar-date string. */
export function getWeekdayLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
  return WEEKDAY_LABELS_SUN_FIRST[weekday];
}

/** The 7 calendar-date strings (Monday..Sunday) of the week starting at `weekStart`. */
export function getWeekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/**
 * Monday-start week-starts (as 'YYYY-MM-DD') covering the whole calendar
 * month `month` ('YYYY-MM'), including a leading week that starts in the
 * previous month if the 1st isn't a Monday. Used anywhere weeks need to be
 * listed for a month regardless of whether a Weekly Plan exists for them
 * yet (the Weekly Plan tab's month view, the dashboard's monthly bar chart).
 */
export function getMonthWeekStarts(month: string): string[] {
  const [year, monthNum] = month.split('-').map(Number);
  const firstOfMonth = `${month}-01`;
  const lastDayOfMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  const lastOfMonth = `${month}-${String(lastDayOfMonth).padStart(2, '0')}`;

  const weekStarts: string[] = [];
  let cursor = getWeekStart(new Date(`${firstOfMonth}T00:00:00Z`));
  while (cursor <= lastOfMonth) {
    weekStarts.push(cursor);
    cursor = addDays(cursor, 7);
  }
  return weekStarts;
}
