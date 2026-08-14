'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/** Account avatar with sign-out. Deliberately plain — chrome stays quiet. */
export function AccountMenu({ handle }: { handle: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await fetch('/api/auth/signout', { method: 'POST' });
    setOpen(false);
    router.push('/');
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for @${handle}`}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-viola-soft)] text-[13px] font-semibold text-[var(--color-viola-text)] transition-transform active:scale-[0.94]"
      >
        {handle.slice(0, 1).toUpperCase()}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            className="fixed inset-0 z-[300] cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-[400] mt-2 w-52 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-raised)] py-1.5 shadow-[var(--shadow-lift)]"
          >
            <p className="px-4 py-2 text-[13px] text-[var(--color-text-tertiary)]">@{handle}</p>
            <Link
              href={`/@${handle}`}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-[14px] text-white transition-colors hover:bg-white/5"
            >
              Your profile
            </Link>
            <Link
              href="/vaults"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-[14px] text-white transition-colors hover:bg-white/5"
            >
              Vaults
            </Link>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-[14px] text-white transition-colors hover:bg-white/5"
            >
              Settings
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="block w-full px-4 py-2.5 text-left text-[14px] text-[var(--color-text-secondary)] transition-colors hover:bg-white/5 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
