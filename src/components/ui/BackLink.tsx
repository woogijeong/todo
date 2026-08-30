import Link from 'next/link';

/** "‹ label" back link with a drawn chevron. Server Component. */
export default function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mb-5 inline-flex items-center gap-1 text-sm text-muted hover:text-primary"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
      >
        <path d="m15 6-6 6 6 6" />
      </svg>
      {label}
    </Link>
  );
}
