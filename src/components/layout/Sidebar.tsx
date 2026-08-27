'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/auth/actions';

const NAV_LINKS = [
  { href: '/', label: '대시보드', icon: '🏠' },
  { href: '/goals', label: '연간 계획', icon: '🎯' },
  { href: '/monthly-plans', label: '월간 계획', icon: '📅' },
  { href: '/plans', label: '주간 계획', icon: '✅' },
  { href: '/stats', label: '통계', icon: '📊' },
] as const;

type Props = {
  login: string;
  avatarUrl: string;
};

export default function Sidebar({ login, avatarUrl }: Props) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-hairline bg-surface-soft">
      <div className="shrink-0 px-4 py-5">
        <span className="text-lg font-semibold text-ink">할 일 관리</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2">
        {NAV_LINKS.map((link) => {
          const active =
            link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2.5 rounded-btn px-3 py-2 text-sm ${
                active ? 'bg-surface-strong font-semibold text-ink' : 'text-muted hover:bg-surface-strong'
              }`}
            >
              <span aria-hidden className="text-base leading-none">
                {link.icon}
              </span>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-hairline p-3">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl}
            alt=""
            width={24}
            height={24}
            className="h-6 w-6 shrink-0 rounded-full bg-surface-strong"
          />
          <span className="min-w-0 flex-1 truncate text-sm text-body">{login}</span>
        </div>
        <form action={logout} className="mt-2">
          <button
            type="submit"
            className="w-full rounded-btn border border-hairline px-3 py-1.5 text-xs text-muted hover:bg-surface-strong"
          >
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  );
}
