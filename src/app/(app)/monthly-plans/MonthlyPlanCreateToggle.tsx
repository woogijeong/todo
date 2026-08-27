'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createMonthlyPlan } from './actions';
import YearlyGoalSlider from '@/components/plans/YearlyGoalSlider';
import { getTodayString } from '@/lib/date';
import type { YearlyGoal } from '@/lib/schemas';

type Props = {
  goals: YearlyGoal[];
  existingMonths: string[];
};

export default function MonthlyPlanCreateToggle({ goals, existingMonths }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;

    const form = e.currentTarget;
    const formData = new FormData(form);
    const title = String(formData.get('title') ?? '').trim();
    const monthRaw = String(formData.get('month') ?? '').trim();
    const yearlyGoalIdRaw = String(formData.get('yearlyGoalId') ?? '').trim();
    if (!title) return;

    const resolvedMonth = monthRaw || getTodayString().slice(0, 7);
    if (existingMonths.includes(resolvedMonth)) {
      setError('이미 그 달에 계획이 있습니다. 한 달에는 하나의 월간 계획만 만들 수 있어요.');
      return;
    }

    setPending(true);
    setError(null);
    try {
      await createMonthlyPlan({
        yearlyGoalId: yearlyGoalIdRaw === '' ? null : yearlyGoalIdRaw,
        title,
        month: resolvedMonth,
      });
      form.reset();
      setOpen(false);
      router.refresh();
    } catch {
      setError('계획 생성에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">월간 계획</h1>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setOpen((prev) => !prev);
          }}
          aria-expanded={open}
          aria-label={open ? '계획 추가 폼 닫기' : '새 월간 계획 추가'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-xl leading-none text-white hover:bg-gray-800"
        >
          {open ? '×' : '+'}
        </button>
      </div>

      {open && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 flex flex-col gap-3 rounded border border-gray-200 p-4"
        >
          <input
            type="text"
            name="title"
            placeholder="제목"
            required
            className="rounded border px-3 py-2"
          />
          <input
            type="month"
            name="month"
            className="rounded border px-3 py-2"
            aria-label="해당 월 (비워두면 이번 달)"
          />
          <div>
            <p className="mb-1 text-sm text-gray-600">연결할 연간 계획 (선택)</p>
            {goals.length === 0 ? (
              <p className="text-sm text-gray-400">
                등록된 연간 계획이 없습니다.{' '}
                <Link href="/goals" className="text-blue-600 hover:underline">
                  새로 만들기
                </Link>
              </p>
            ) : (
              <YearlyGoalSlider goals={goals} name="yearlyGoalId" />
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {pending ? '생성 중…' : '계획 생성'}
          </button>
        </form>
      )}
    </div>
  );
}
