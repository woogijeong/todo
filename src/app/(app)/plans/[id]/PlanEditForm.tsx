'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { updatePlan } from '../actions';
import type { WeeklyPlan, YearlyGoal } from '@/lib/schemas';

type Props = {
  plan: WeeklyPlan;
  goals: YearlyGoal[];
};

/**
 * Where a Weekly Plan's title and its linked Yearly Goal are set. Low-frequency
 * edit, so it stays a collapsed button until opened — mirrors the goal edit
 * affordance. `weekStart` is not editable here.
 */
export default function PlanEditForm({ plan, goals }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;

    const formData = new FormData(e.currentTarget);
    const title = String(formData.get('title') ?? '').trim();
    const goalId = String(formData.get('yearlyGoalId') ?? '').trim();
    if (!title) return;

    setPending(true);
    setError(null);
    try {
      await updatePlan(plan._id, {
        title,
        yearlyGoalId: goalId === '' ? null : goalId,
      });
      setOpen(false);
      router.refresh();
    } catch {
      setError('저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="whitespace-nowrap rounded-btn border border-hairline px-4 py-2 text-sm text-body transition-colors hover:bg-surface-soft"
      >
        주간 계획 편집
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-64 flex-col gap-3 rounded-card border border-hairline bg-canvas p-4"
    >
      <input
        name="title"
        defaultValue={plan.title}
        required
        placeholder="주간 계획 제목"
        aria-label="주간 계획 제목"
        className="rounded-btn border border-hairline bg-page px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />
      <select
        name="yearlyGoalId"
        defaultValue={plan.yearlyGoalId ?? ''}
        aria-label="연간 목표 연결"
        className="rounded-btn border border-hairline bg-page px-3 py-2 text-sm focus:border-primary focus:outline-none"
      >
        <option value="">연간 목표 없음</option>
        {goals.map((goal) => (
          <option key={goal._id} value={goal._id}>
            {goal.title} ({goal.year})
          </option>
        ))}
      </select>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-btn bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
        >
          {pending ? '저장 중…' : '저장'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-btn border border-hairline px-4 py-2 text-sm text-muted hover:bg-surface-soft"
        >
          취소
        </button>
      </div>
    </form>
  );
}
