'use client';

import { useState } from 'react';
import type { YearlyGoal } from '@/lib/schemas';

type Props = {
  goals: YearlyGoal[];
  name?: string;
};

const NONE_ID = '';

export default function YearlyGoalSlider({ goals, name = 'yearlyGoalId' }: Props) {
  const [selected, setSelected] = useState<string>(NONE_ID);

  return (
    <div>
      <input type="hidden" name={name} value={selected} />
      <div
        role="radiogroup"
        aria-label="연결할 연간 계획"
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2"
      >
        <button
          type="button"
          role="radio"
          aria-checked={selected === NONE_ID}
          onClick={() => setSelected(NONE_ID)}
          className={`shrink-0 snap-start rounded-lg border px-4 py-3 text-left transition-colors ${
            selected === NONE_ID
              ? 'border-black bg-black text-white'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <p className="text-sm font-medium">없음</p>
        </button>

        {goals.map((goal) => {
          const isSelected = selected === goal._id;
          return (
            <button
              key={goal._id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelected(goal._id)}
              className={`shrink-0 snap-start rounded-lg border px-4 py-3 text-left transition-colors ${
                isSelected
                  ? 'border-black bg-black text-white'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <p className="max-w-40 truncate text-sm font-medium">{goal.title}</p>
              <p className={`text-xs ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
                {goal.year}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
