/**
 * Circular progress dial for the "종이 플래너" UI. `value` is 0–100, or
 * `null` for "no tasks yet" (empty ring, en-dash in the middle). Pure
 * presentational — safe as a Server Component.
 */
type Props = {
  value: number | null;
  size?: number;
  stroke?: number;
  /** ring color when value !== null */
  color?: string;
  /** show the "%" label in the center */
  showLabel?: boolean;
};

export default function ProgressRing({
  value,
  size = 56,
  stroke = 6,
  color = 'var(--color-accent-sage)',
  showLabel = true,
}: Props) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  const offset = circumference * (1 - pct / 100);

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-surface-strong)"
          strokeWidth={stroke}
        />
        {value !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      {showLabel && (
        <span
          className="absolute font-semibold tabular-nums text-ink"
          style={{ fontSize: Math.round(size * 0.28) }}
        >
          {value === null ? '–' : `${value}%`}
        </span>
      )}
    </span>
  );
}
