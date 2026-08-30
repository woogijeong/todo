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
    <main className="mx-auto max-w-2xl p-6 sm:p-8">
      <h1 className="mb-1.5 text-[26px] font-bold tracking-tight text-ink">연간 계획</h1>
      <p className="mb-6 text-sm text-muted-soft">한 해 동안 이루고 싶은 큰 목표</p>

      <form action={createGoalAction} className="mb-8 flex flex-wrap gap-2">
        <input
          name="title"
          placeholder="계획 제목"
          required
          className="min-w-40 flex-1 rounded-btn border border-hairline bg-canvas px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
        />
        <input
          name="year"
          type="number"
          placeholder="연도"
          required
          defaultValue={new Date().getFullYear()}
          className="w-28 rounded-btn border border-hairline bg-canvas px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
        />
        <button type="submit" className="rounded-btn bg-primary px-5 py-3 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-active">
          추가
        </button>
      </form>

      {goals.length === 0 ? (
        <p className="text-muted">아직 등록된 연간 계획이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {goals.map((goal) => (
            <li key={goal._id}>
              <Link
                href={`/goals/${goal._id}`}
                className="flex items-center justify-between gap-3 rounded-card border border-hairline bg-canvas p-4 transition-shadow hover:shadow-float"
              >
                <span className="font-semibold text-ink">{goal.title}</span>
                <span className="shrink-0 text-sm text-muted-soft">{goal.year}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
