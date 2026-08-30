'use client';

import { useEffect, useState } from 'react';

/**
 * Same dial as <ProgressRing>, but the arc sweeps from empty to `value` on
 * mount. Used for the "전체 진행률" on the goal detail page so reaching 100%
 * reads as the gauge filling up. Server-safe fallback: renders empty until the
 * client effect runs.
 */
type Props = {
  value: number | null;
  size?: number;
  stroke?: number;
  color?: string;
  showLabel?: boolean;
};

export default function AnimatedProgressRing({
  value,
  size = 56,
  stroke = 6,
  color = 'var(--color-accent-sage)',
  showLabel = true,
}: Props) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setShown(value ?? 0), 40);
    return () => clearTimeout(t);
  }, [value]);

  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, shown));
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
            className="gauge-ring"
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
