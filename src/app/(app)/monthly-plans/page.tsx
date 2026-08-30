import Link from 'next/link';
import { listMonthlyPlans } from './actions';
import MonthlyPlanForm from './MonthlyPlanForm';
import { listGoals } from '@/app/(app)/goals/actions';
import { getMonthlyPlanProgress } from '@/lib/progress';
import ProgressRing from '@/components/ui/ProgressRing';
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
    <main className="mx-auto max-w-2xl p-6 sm:p-8">
      <MonthlyPlanForm goals={goals} existingMonths={plans.map((plan) => plan.month)} />

      {plans.length === 0 ? (
        <p className="mt-8 text-muted">아직 등록된 월간 계획이 없습니다.</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-2.5">
          {plans.map((plan, index) => {
            const progress = progresses[index];
            return (
              <li key={plan._id}>
                <Link
                  href={`/monthly-plans/${plan._id}`}
                  className="flex items-center gap-4 rounded-card border border-hairline bg-canvas p-4 transition-shadow hover:shadow-float"
                >
                  <ProgressRing value={progress} size={44} stroke={5} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{plan.title}</p>
                    <p className="text-sm text-muted-soft">{monthLabel(plan.month)}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
