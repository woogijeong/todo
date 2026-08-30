'use client';

import { useState } from 'react';
import type { MonthStat } from '@/lib/stats';

const FILL_SEGMENTS = 10;

function FillMeter({ progress }: { progress: number | null }) {
  if (progress === null) {
    return <p className="text-xs text-muted-soft">할 일 없음</p>;
  }

  const filled = Math.round((progress / 100) * FILL_SEGMENTS);

  return (
    <div>
      <div className="flex gap-0.5">
        {Array.from({ length: FILL_SEGMENTS }, (_, i) => (
          <span
            key={i}
            className={`h-3 flex-1 rounded-sm ${
              i < filled ? 'bg-[color:var(--color-accent-sage)]' : 'bg-surface-strong'
            }`}
          />
        ))}
      </div>
      <p className="mt-1 text-xs font-medium text-muted">{progress}%</p>
    </div>
  );
}

function Card({
  title,
  subtitle,
  progress,
  onClick,
}: {
  title: string;
  subtitle?: string;
  progress: number | null;
  onClick?: () => void;
}) {
  const body = (
    <>
      <p className="font-semibold text-ink">{title}</p>
      {subtitle && <p className="mt-0.5 text-xs text-muted-soft">{subtitle}</p>}
      <div className="mt-3">
        <FillMeter progress={progress} />
      </div>
    </>
  );

  if (!onClick) {
    return (
      <div className="rounded-card border border-hairline bg-canvas p-4">{body}</div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-card border border-hairline bg-canvas p-4 text-left transition-shadow hover:shadow-float"
    >
      {body}
    </button>
  );
}

function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-primary"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="m15 6-6 6 6 6" />
      </svg>
      {label}
    </button>
  );
}

export default function StatsExplorer({ months }: { months: MonthStat[] }) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  if (months.length === 0) {
    return <p className="mt-8 text-muted">등록된 주간 계획이 없습니다.</p>;
  }

  const month = months.find((m) => m.month === selectedMonth) ?? null;
  const week = month?.weeks.find((w) => w.planId === selectedPlanId) ?? null;

  if (month && week) {
    return (
      <div className="mt-8">
        <BackLink label={month.label} onClick={() => setSelectedPlanId(null)} />
        <h2 className="text-sm font-semibold text-muted">
          {week.title} · {week.weekStart} ~ {week.weekEnd}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {week.days.map((day) => (
            <Card key={day.date} title={`${day.date} (${day.weekday})`} progress={day.progress} />
          ))}
        </div>
      </div>
    );
  }

  if (month) {
    return (
      <div className="mt-8">
        <BackLink label="월별 보기" onClick={() => setSelectedMonth(null)} />
        <h2 className="text-sm font-semibold text-muted">{month.label}의 주간 계획</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {month.weeks.map((w) => (
            <Card
              key={w.planId}
              title={w.title}
              subtitle={`${w.weekStart} ~ ${w.weekEnd}`}
              progress={w.progress}
              onClick={() => setSelectedPlanId(w.planId)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="text-sm font-semibold text-muted">월별 완료율</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {months.map((m) => (
          <Card key={m.month} title={m.label} progress={m.progress} onClick={() => setSelectedMonth(m.month)} />
        ))}
      </div>
    </div>
  );
}
