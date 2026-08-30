'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { updateGoal } from '../actions';
import type { YearlyGoal } from '@/lib/schemas';

export default function GoalEditForm({ goal }: { goal: YearlyGoal }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;

    const formData = new FormData(e.currentTarget);
    const title = String(formData.get('title') ?? '').trim();
    const yearRaw = String(formData.get('year') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const year = Number(yearRaw);
    if (!title || !Number.isInteger(year)) return;

    setPending(true);
    setError(null);
    try {
      await updateGoal(goal._id, {
        title,
        year,
        description: description || undefined,
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
        className="whitespace-nowrap rounded-btn border border-primary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-surface-strong"
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
        defaultValue={goal.title}
        required
        placeholder="계획 제목"
        className="rounded-btn border border-hairline px-3 py-2.5 text-sm bg-canvas focus:border-primary focus:outline-none"
      />
      <input
        name="year"
        type="number"
        defaultValue={goal.year}
        required
        aria-label="연도"
        className="w-32 rounded-btn border border-hairline px-3 py-2.5 text-sm bg-canvas focus:border-primary focus:outline-none"
      />
      <textarea
        name="description"
        defaultValue={goal.description ?? ''}
        rows={3}
        placeholder="설명 (선택)"
        className="rounded-btn border border-hairline px-3 py-2.5 text-sm bg-canvas focus:border-primary focus:outline-none"
      />

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
