'use client';

import { useEffect, useState, type CSSProperties } from 'react';

/**
 * A progress bar whose fill sweeps from 0 to `value` on mount (and re-animates
 * when `value` changes). Same visual language as the app's static bars — the
 * caller passes the fill's colour via `fillClassName`/`fillStyle`.
 */
export default function GaugeBar({
  value,
  trackClassName = 'h-1.5',
  className = '',
  fillClassName = 'bg-[color:var(--color-primary)]',
  fillStyle,
}: {
  value: number | null;
  trackClassName?: string;
  className?: string;
  fillClassName?: string;
  fillStyle?: CSSProperties;
}) {
  const [w, setW] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setW(value ?? 0), 40);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div className={`overflow-hidden rounded-full bg-surface-strong ${trackClassName} ${className}`}>
      <div
        className={`gauge-fill h-full rounded-full ${fillClassName}`}
        style={{ width: `${w}%`, ...fillStyle }}
      />
    </div>
  );
}
