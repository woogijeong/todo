import type { CSSProperties, ReactNode } from 'react';

/**
 * A slightly-rotated sticky-note wrapper for "진행 중" task cards.
 * Presentational — Server Component.
 */
type Props = {
  children: ReactNode;
  /** rotation in degrees, e.g. -1.3 or 1 */
  rotate?: number;
  /** note paper color */
  tint?: string;
  className?: string;
  style?: CSSProperties;
};

export default function Sticky({
  children,
  rotate = -1.2,
  tint = '#eaeadb',
  className = '',
  style,
}: Props) {
  return (
    <div
      className={`rounded-[4px] border p-3.5 shadow-[0_3px_9px_rgba(58,47,38,0.10)] ${className}`}
      style={{
        transform: `rotate(${rotate}deg)`,
        background: tint,
        borderColor: 'rgba(58,47,38,0.12)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
