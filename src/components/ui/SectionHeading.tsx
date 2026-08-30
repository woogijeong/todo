import type { ReactNode } from 'react';

/**
 * Paper-notebook section header: a title with a 2px underline, optional
 * count and a right-aligned action slot. Presentational — Server Component.
 */
type Props = {
  children: ReactNode;
  count?: number | string;
  action?: ReactNode;
  /** underline / title color accent */
  tone?: 'ink' | 'sage' | 'muted';
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
};

const TONE = {
  ink: { text: 'text-ink', border: 'border-ink' },
  sage: { text: 'text-[color:var(--color-accent-sage)]', border: 'border-[color:var(--color-accent-sage)]' },
  muted: { text: 'text-muted', border: 'border-border-strong' },
} as const;

export default function SectionHeading({
  children,
  count,
  action,
  tone = 'ink',
  as: Tag = 'h2',
  className = '',
}: Props) {
  const t = TONE[tone];
  return (
    <div
      className={`flex items-end justify-between gap-3 border-b-2 ${t.border} pb-2.5 ${className}`}
    >
      <div className="flex items-baseline gap-2">
        <Tag className={`text-base font-bold tracking-tight ${t.text}`}>{children}</Tag>
        {count !== undefined && (
          <span className="text-sm tabular-nums text-muted-soft">{count}</span>
        )}
      </div>
      {action}
    </div>
  );
}
