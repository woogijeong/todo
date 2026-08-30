'use client';

/**
 * Hand-drawn-looking square checkbox. Wraps a real, visually-hidden
 * `<input type="checkbox">` so keyboard focus and screen readers keep
 * working; the SVG is the visible control.
 */
type Props = {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  /** render without an input — a static "done" mark on the board */
  readOnly?: boolean;
  label: string;
  size?: number;
};

export default function PaperCheck({
  checked,
  onChange,
  readOnly = false,
  label,
  size = 19,
}: Props) {
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={checked ? 'var(--color-accent-sage)' : 'var(--color-border-strong)'}
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      {checked && <path d="m7 12 3.5 3.5L17 8" strokeWidth="2.2" />}
    </svg>
  );

  if (readOnly) {
    return <span className="inline-flex shrink-0">{mark}</span>;
  }

  return (
    <label className="inline-flex shrink-0 cursor-pointer items-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        aria-label={label}
        className="sr-only"
      />
      {mark}
    </label>
  );
}
