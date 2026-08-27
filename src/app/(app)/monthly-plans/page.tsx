import Link from 'next/link';
import { listMonthlyPlans } from './actions';
import MonthlyPlanCreateToggle from './MonthlyPlanCreateToggle';
import { listGoals } from '@/app/(app)/goals/actions';
import { getMonthlyPlanProgress } from '@/lib/progress';
import { requirePageUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function monthLabel(month: string): string {
  const [year, monthNum] = month.split('-');
  return `${year}년 ${Number(monthNum)}월`;
}

export default async function MonthlyPlansPage() {
  await requirePageUser();

  const [plans, goals] = await Promise.all([listMonthlyPlans(), listGoals()]);
  const progresses = await Promise.all(plans.map((plan) => getMonthlyPlanProgress(plan._id)));

  return (
    <main className="mx-auto max-w-4xl p-6">
      <MonthlyPlanCreateToggle goals={goals} existingMonths={plans.map((plan) => plan.month)} />

      {plans.length === 0 ? (
        <p className="mt-8 text-muted">등록된 월간 계획이 없습니다.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {plans.map((plan, index) => {
            const progress = progresses[index];
            return (
              <Link
                key={plan._id}
                href={`/monthly-plans/${plan._id}`}
                className="rounded-card border border-hairline p-4 transition-colors hover:border-border-strong hover:shadow-float"
              >
                <p className="font-medium text-ink">{plan.title}</p>
                <p className="mt-1 text-sm text-muted">{monthLabel(plan.month)}</p>
                <div className="mt-3">
                  {progress === null ? (
                    <p className="text-xs text-muted-soft">할 일 없음</p>
                  ) : (
                    <>
                      <div className="h-1.5 w-full rounded-full bg-surface-strong">
                        <div
                          className="h-1.5 rounded-full bg-primary"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted">{progress}%</p>
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
