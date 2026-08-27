import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { safeNextPath } from '@/lib/session-cookie';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  if (await getSessionUser()) {
    redirect(safeNextPath(next));
  }

  const target = safeNextPath(next);
  const href = target === '/' ? '/auth/github' : `/auth/github?next=${encodeURIComponent(target)}`;

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-5 p-6 pt-32">
      <h1 className="text-2xl font-semibold text-ink">할 일 관리</h1>
      <p className="text-sm text-body">
        계속하려면 GitHub 계정으로 로그인하세요.
      </p>

      <a
        href={href}
        className="inline-flex w-full items-center justify-center gap-2 rounded-btn border border-ink bg-canvas px-4 py-3 text-sm font-medium text-ink transition-colors hover:bg-surface-soft"
      >
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        GitHub로 로그인
      </a>

      {error && (
        <p className="text-sm text-error">
          로그인에 실패했습니다. 다시 시도해 주세요.
        </p>
      )}
    </main>
  );
}
