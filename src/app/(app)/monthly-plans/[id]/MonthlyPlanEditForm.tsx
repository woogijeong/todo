'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { updateMonthlyPlan } from '../actions';
import type { MonthlyPlan, YearlyGoal } from '@/lib/schemas';

type Props = {
  plan: MonthlyPlan;
  goals: YearlyGoal[];
};

export default function MonthlyPlanEditForm({ plan, goals }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;

    const formData = new FormData(e.currentTarget);
    const title = String(formData.get('title') ?? '').trim();
    const month = String(formData.get('month') ?? '').trim();
    const goalId = String(formData.get('yearlyGoalId') ?? '').trim();
    if (!title || !month) return;

    setPending(true);
    setError(null);
    try {
      await updateMonthlyPlan(plan._id, {
        title,
        month,
        yearlyGoalId: goalId === '' ? null : goalId,
      });
      setOpen(false);
      router.refresh();
    } catch {
      setError('저장에 실패했습니다. 이미 그 달에 다른 계획이 있는지 확인해 주세요.');
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="whitespace-nowrap rounded-btn border border-ink px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-soft"
      >
        편집
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 flex flex-col gap-3 rounded-card border border-hairline p-4"
    >
      <input
        name="title"
        defaultValue={plan.title}
        required
        placeholder="계획 제목"
        className="rounded-btn border border-hairline px-3 py-2.5 text-sm focus:border-ink focus:outline-none"
      />
      <input
        name="month"
        type="month"
        defaultValue={plan.month}
        required
        aria-label="해당 월"
        onClick={(e) => e.currentTarget.showPicker?.()}
        className="rounded-btn border border-hairline px-3 py-2.5 text-sm focus:border-ink focus:outline-none"
      />
      <select
        name="yearlyGoalId"
        defaultValue={plan.yearlyGoalId ?? ''}
        aria-label="연간 계획 연동"
        className="rounded-btn border border-hairline px-3 py-2.5 text-sm focus:border-ink focus:outline-none"
      >
        <option value="">연간 계획 없음</option>
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
          className="rounded-btn bg-primary px-5 py-2.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
        >
          {pending ? '저장 중…' : '저장'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-btn border border-hairline px-4 py-2.5 text-sm text-muted hover:bg-surface-soft"
        >
          취소
        </button>
      </div>
    </form>
  );
}
