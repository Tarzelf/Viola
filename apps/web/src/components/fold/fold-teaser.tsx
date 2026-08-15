import Link from 'next/link';

/** Editorial door into the Fold, used on the feed. */
export function FoldTeaser() {
  return (
    <Link
      href="/fold"
      className="mb-7 flex items-end justify-between gap-4 rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-5 py-5 transition-colors hover:border-[rgba(124,92,252,0.4)]"
    >
      <div>
        <p className="label-caps text-[var(--color-text-tertiary)]">The fold</p>
        <h2 className="display mt-1 text-[26px] leading-tight text-white">
          Every look, every path, in one room.
        </h2>
        <p className="mt-1.5 max-w-md text-[13px] text-[var(--color-text-secondary)]">
          Walk the moments. Follow a piece through closets. Find the way back.
        </p>
      </div>
      <span className="hidden shrink-0 rounded-full bg-[var(--color-viola)] px-4 py-2 text-[13px] font-semibold text-white sm:inline">
        Walk it
      </span>
    </Link>
  );
}
