'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * Account avatar with sign-out.
 *
 * Opens with the transitions.dev **menu-dropdown** recipe (origin-aware scale
 * from the top-right). Close plays `.is-closing` before unmount so the menu
 * doesn't just vanish.
 */
export function AccountMenu({ handle }: { handle: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  function openMenu() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setClosing(false);
    setOpen(true);
  }

  function closeMenu() {
    if (!open || closing) return;
    setClosing(true);
    setOpen(false);
    closeTimer.current = setTimeout(() => setClosing(false), 160);
  }

  async function signOut() {
    await fetch('/api/auth/signout', { method: 'POST' });
    closeMenu();
    router.push('/');
    router.refresh();
  }

  const visible = open || closing;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (open ? closeMenu() : openMenu())}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for @${handle}`}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-viola-soft)] text-[13px] font-semibold text-[var(--color-viola-text)] transition-transform active:scale-[0.94]"
      >
        {handle.slice(0, 1).toUpperCase()}
      </button>

      {visible && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            className="fixed inset-0 z-[300] cursor-default"
            onClick={closeMenu}
          />
          <div
            role="menu"
            data-origin="top-right"
            className={[
              't-dropdown absolute right-0 z-[400] mt-2 w-52 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-raised)] py-1.5 shadow-[var(--shadow-lift)]',
              open ? 'is-open' : '',
              closing ? 'is-closing' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <p className="px-4 py-2 text-[13px] text-[var(--color-text-tertiary)]">@{handle}</p>
            <Link
              href={`/@${handle}`}
              onClick={closeMenu}
              className="block px-4 py-2.5 text-[14px] text-white transition-colors hover:bg-white/5"
            >
              Your profile
            </Link>
            <Link
              href="/vaults"
              onClick={closeMenu}
              className="block px-4 py-2.5 text-[14px] text-white transition-colors hover:bg-white/5"
            >
              Vaults
            </Link>
            <Link
              href="/earnings"
              onClick={closeMenu}
              className="block px-4 py-2.5 text-[14px] text-white transition-colors hover:bg-white/5"
            >
              Earnings
            </Link>
            <Link
              href="/settings"
              onClick={closeMenu}
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
