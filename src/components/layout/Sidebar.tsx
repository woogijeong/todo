'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { logout } from '@/app/auth/actions';

type NavItem = { href: string; label: string; icon: ReactNode };

const NAV_LINKS: NavItem[] = [
  {
    href: '/',
    label: '대시보드',
    icon: (
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-4v-6H8v6H4a1 1 0 0 1-1-1z" />
    ),
  },
  {
    href: '/goals',
    label: '연간 목표',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="3.5" />
      </>
    ),
  },
  {
    href: '/plans',
    label: '주간 계획',
    icon: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="m8 13 2.5 2.5L16 10" />
      </>
    ),
  },
  {
    href: '/stats',
    label: '통계',
    icon: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  },
];

type Props = {
  login: string;
  avatarUrl: string;
  topGoal: { title: string; progress: number | null; year: number } | null;
};

export default function Sidebar({ login, avatarUrl, topGoal }: Props) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col gap-8 border-r border-hairline bg-canvas px-5 py-7">
      <div className="flex items-center gap-2.5">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 4h13a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5z" />
          <path d="M5 4a2 2 0 0 0-2 2v13" />
          <path d="m9 11 2 2 4-4" stroke="var(--color-accent-sage)" />
        </svg>
        <span className="text-xl font-bold tracking-tight text-ink">차곡</span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV_LINKS.map((link) => {
          const active =
            link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-btn px-3 py-2.5 text-sm transition-colors ${
                active
                  ? 'bg-surface-strong font-semibold text-primary'
                  : 'text-muted hover:bg-surface-soft'
              }`}
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                {link.icon}
              </svg>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-4">
        {topGoal && (
          <div className="border-t border-hairline pt-4">
            <p className="mb-1.5 text-xs text-muted-soft">{topGoal.year}년 목표</p>
            <p className="mb-2.5 line-clamp-2 text-sm font-semibold leading-snug text-ink">
              {topGoal.title}
            </p>
            <div className="flex items-center gap-2.5">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-strong">
                <div
                  className="h-full rounded-full bg-[color:var(--color-accent-sage)]"
                  style={{ width: `${topGoal.progress ?? 0}%` }}
                />
              </div>
              <span className="text-xs font-semibold tabular-nums text-body">
                {topGoal.progress === null ? '–' : `${topGoal.progress}%`}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2.5 border-t border-hairline pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl}
            alt=""
            width={30}
            height={30}
            className="h-[30px] w-[30px] shrink-0 rounded-full border border-hairline bg-surface-strong"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{login}</p>
            <p className="flex items-center gap-1.5 text-[11px] text-[color:var(--color-accent-sage)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-accent-sage)]" />
              GitHub 연결됨
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              aria-label="로그아웃"
              className="flex rounded-btn p-1.5 text-muted-soft transition-colors hover:bg-surface-soft hover:text-ink"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
