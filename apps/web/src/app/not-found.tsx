import Link from 'next/link';
import { Wordmark } from '@/components/app-shell';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col items-center justify-center px-6 text-center">
      <Wordmark size={26} />
      <p className="display mt-8 text-[30px] text-white">Nothing here</p>
      <p className="mt-2 text-[14px] text-[var(--color-text-secondary)]">
        This look may have been deleted or made private.
      </p>
      <Link
        href="/"
        className="mt-7 rounded-full bg-[var(--color-viola)] px-5 py-3 text-[14px] font-semibold text-white"
      >
        Back to the feed
      </Link>
    </div>
  );
}
