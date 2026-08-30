export type Season = '봄' | '여름' | '가을' | '겨울';

export const SEASONS: readonly Season[] = ['봄', '여름', '가을', '겨울'];

/**
 * The season a calendar month belongs to, meteorological-style:
 * 3–5 봄, 6–8 여름, 9–11 가을, 12·1·2 겨울. Used as the seasonal
 * background's default when the viewer hasn't picked one.
 *
 * @param month 1–12
 */
export function defaultSeasonForMonth(month: number): Season {
  if (month >= 3 && month <= 5) return '봄';
  if (month >= 6 && month <= 8) return '여름';
  if (month >= 9 && month <= 11) return '가을';
  return '겨울';
}

export function isSeason(value: unknown): value is Season {
  return typeof value === 'string' && (SEASONS as readonly string[]).includes(value);
}
