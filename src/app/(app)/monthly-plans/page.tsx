import Link from 'next/link';
import { listMonthlyPlans } from './actions';
import MonthlyPlanForm from './MonthlyPlanForm';
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
    <main className="mx-auto max-w-2xl p-6">
      <MonthlyPlanForm goals={goals} existingMonths={plans.map((plan) => plan.month)} />

      {plans.length === 0 ? (
        <p className="mt-8 text-muted">아직 등록된 월간 계획이 없습니다.</p>
      ) : (
        <ul className="mt-8 space-y-2">
          {plans.map((plan, index) => {
            const progress = progresses[index];
            return (
              <li key={plan._id}>
                <Link
                  href={`/monthly-plans/${plan._id}`}
                  className="block rounded-card border border-hairline p-4 transition-shadow hover:shadow-float"
                >
                  <span className="font-medium text-ink">{plan.title}</span>
                  <span className="ml-2 text-sm text-muted">{monthLabel(plan.month)}</span>
                  {progress !== null && (
                    <span className="ml-2 text-sm text-muted">· {progress}%</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
