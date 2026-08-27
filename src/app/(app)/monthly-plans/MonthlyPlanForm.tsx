'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createMonthlyPlan } from './actions';
import { getTodayString } from '@/lib/date';
import type { YearlyGoal } from '@/lib/schemas';

type Props = {
  goals: YearlyGoal[];
  existingMonths: string[];
};

export default function MonthlyPlanForm({ goals, existingMonths }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const thisMonth = getTodayString().slice(0, 7);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;

    const form = e.currentTarget;
    const formData = new FormData(form);
    const title = String(formData.get('title') ?? '').trim();
    const month = String(formData.get('month') ?? '').trim() || thisMonth;
    const goalId = String(formData.get('yearlyGoalId') ?? '').trim();
    if (!title) return;

    if (existingMonths.includes(month)) {
      setError('이미 그 달에 계획이 있습니다. 한 달에는 하나의 월간 계획만 만들 수 있어요.');
      return;
    }

    setPending(true);
    setError(null);
    try {
      await createMonthlyPlan({
        yearlyGoalId: goalId === '' ? null : goalId,
        title,
        month,
      });
      form.reset();
      router.refresh();
    } catch {
      setError('계획 생성에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold text-ink">월간 계획</h1>

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
        <input
          name="title"
          placeholder="계획 제목"
          required
          className="min-w-40 flex-1 rounded-btn border border-hairline px-3 py-2.5 text-sm focus:border-ink focus:outline-none"
        />
        <input
          name="month"
          type="month"
          defaultValue={thisMonth}
          aria-label="해당 월"
          onClick={(e) => e.currentTarget.showPicker?.()}
          className="rounded-btn border border-hairline px-3 py-2.5 text-sm focus:border-ink focus:outline-none"
        />
        <select
          name="yearlyGoalId"
          defaultValue=""
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
        <button
          type="submit"
          disabled={pending}
          className="rounded-btn bg-primary px-5 py-3 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
        >
          추가
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-error">{error}</p>}
    </>
  );
}
