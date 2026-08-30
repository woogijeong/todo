'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Fades each screen in on navigation. The pathname keys the wrapper, so React
 * remounts it on every route change and the `page-in` CSS animation replays
 * from the start. Disabled under `prefers-reduced-motion` (see globals.css).
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-in">
      {children}
    </div>
  );
}
