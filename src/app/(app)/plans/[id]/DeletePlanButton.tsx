'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deletePlan } from '../actions';

type Props = {
  planId: string;
  childTaskCount: number;
};

export default function DeletePlanButton({ planId, childTaskCount }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const confirmed = window.confirm(
      childTaskCount > 0
        ? `이 계획과 하위 할 일 ${childTaskCount}개가 함께 삭제됩니다. 계속할까요?`
        : '이 계획을 삭제할까요?'
    );
    if (!confirmed) return;

    setPending(true);
    setError(null);
    try {
      await deletePlan(planId);
      router.push('/plans');
    } catch {
      setError('삭제에 실패했습니다. 다시 시도해 주세요.');
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="whitespace-nowrap rounded-btn border border-[#f0c9c0] px-3 py-1.5 text-sm font-medium text-error hover:bg-[#fdecec] disabled:opacity-50"
      >
        계획 삭제
      </button>
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  );
}
