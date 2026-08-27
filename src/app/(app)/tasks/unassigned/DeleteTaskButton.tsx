'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteTask } from '@/app/(app)/tasks/actions';

type Props = {
  taskId: string;
  title: string;
};

export default function DeleteTaskButton({ taskId, title }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const confirmed = window.confirm(`'${title}' 할 일을 삭제하시겠습니까?`);
    if (!confirmed) return;

    setPending(true);
    setError(null);
    try {
      await deleteTask(taskId);
      router.refresh();
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
        className="whitespace-nowrap rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        삭제
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
