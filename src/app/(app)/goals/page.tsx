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
      <h1 className="mb-6 text-2xl font-semibold text-ink">연간 계획</h1>

      <form action={createGoalAction} className="mb-8 flex flex-wrap gap-2">
        <input
          name="title"
          placeholder="계획 제목"
          required
          className="min-w-40 flex-1 rounded-btn border border-hairline px-3 py-2.5 text-sm focus:border-ink focus:outline-none"
        />
        <input
          name="year"
          type="number"
          placeholder="연도"
          required
          defaultValue={new Date().getFullYear()}
          className="w-28 rounded-btn border border-hairline px-3 py-2.5 text-sm focus:border-ink focus:outline-none"
        />
        <button type="submit" className="rounded-btn bg-primary px-5 py-3 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active">
          추가
        </button>
      </form>

      {goals.length === 0 ? (
        <p className="text-muted">아직 등록된 연간 계획이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {goals.map((goal) => (
            <li
              key={goal._id}
              className="rounded-card border border-hairline p-4 transition-shadow hover:shadow-float"
            >
              <Link href={`/goals/${goal._id}`} className="font-medium text-ink hover:underline">
                {goal.title}
              </Link>
              <span className="ml-2 text-sm text-muted">{goal.year}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
