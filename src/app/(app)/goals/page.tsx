import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createGoal, listGoals } from './actions';
import { requirePageUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function GoalsPage() {
  await requirePageUser();

  const goals = await listGoals();

  async function createGoalAction(formData: FormData) {
    'use server';
    const title = formData.get('title');
    const yearRaw = formData.get('year');
    const description = formData.get('description');

    await createGoal({
      title: typeof title === 'string' ? title : '',
      year: typeof yearRaw === 'string' ? Number(yearRaw) : NaN,
      description: typeof description === 'string' && description.trim() ? description : undefined,
    });

    revalidatePath('/goals');
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold mb-4">연간 계획</h1>

      <form action={createGoalAction} className="mb-8 flex flex-wrap gap-2">
        <input
          name="title"
          placeholder="계획 제목"
          required
          className="flex-1 min-w-40 rounded border px-3 py-2"
        />
        <input
          name="year"
          type="number"
          placeholder="연도"
          required
          defaultValue={new Date().getFullYear()}
          className="w-28 rounded border px-3 py-2"
        />
        <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
          추가
        </button>
      </form>

      {goals.length === 0 ? (
        <p className="text-gray-500">아직 등록된 연간 계획이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {goals.map((goal) => (
            <li key={goal._id} className="rounded border p-3">
              <Link href={`/goals/${goal._id}`} className="font-medium hover:underline">
                {goal.title}
              </Link>
              <span className="ml-2 text-sm text-gray-500">{goal.year}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
