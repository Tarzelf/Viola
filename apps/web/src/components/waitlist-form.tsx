'use client';

import { useState, useTransition, type FormEvent } from 'react';
import Link from 'next/link';
import { Wordmark } from '@/components/wordmark';

/**
 * Early-access waitlist.
 *
 * Soft-launch surface: capture email, confirm, done. No password, no friction.
 * When VIOLA_INVITE_ONLY is on, ungated visitors land here.
 */
export function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          throw new Error(body?.error?.message ?? 'Could not join the list.');
        }
        setDone(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not join the list.');
      }
    });
  }

  if (done) {
    return (
      <div className="t-stagger is-shown mx-auto max-w-md text-center">
        <strong className="t-stagger-line t-stagger-line--1 display text-[28px] text-white">
          You&rsquo;re on the list
        </strong>
        <span className="t-stagger-line t-stagger-line--2 mt-3 block text-[15px] text-[var(--color-text-secondary)]">
          We&rsquo;ll email {email} when a spot opens. Until then, if someone shared a look with you,
          that link still works — no account required.
        </span>
        <Link
          href="/"
          className="mt-8 inline-block rounded-full border border-[var(--color-hairline)] px-5 py-3 text-[14px] font-medium text-white"
        >
          Peek at the feed
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-md">
      <label
        className="block text-[13px] font-medium text-[var(--color-text-secondary)]"
        htmlFor="waitlist-email"
      >
        Email
      </label>
      <input
        id="waitlist-email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        className={[
          'mt-2 w-full rounded-[14px] border bg-[var(--color-surface)] px-4 py-3.5 text-[16px] text-white outline-none',
          error
            ? 't-shake border-[var(--color-danger)]'
            : 'border-[var(--color-hairline)] focus:border-[rgba(124,92,252,0.5)]',
        ].join(' ')}
      />
      {error && <p className="mt-2 text-[13px] text-[var(--color-danger)]">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 w-full rounded-full bg-[var(--color-viola)] px-5 py-3.5 text-[15px] font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? 'Joining…' : 'Request early access'}
      </button>
      <p className="mt-3 text-center text-[12px] text-[var(--color-text-tertiary)]">
        By joining you agree to our{' '}
        <Link href="/terms" className="text-[var(--color-viola-text)] hover:underline">
          Terms
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="text-[var(--color-viola-text)] hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}

export function InviteRedeem() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/invite', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          throw new Error(body?.error?.message ?? 'Invalid invite.');
        }
        window.location.href = '/';
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid invite.');
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-10 w-full max-w-md border-t border-[var(--color-hairline)] pt-8"
    >
      <p className="text-center text-[13px] text-[var(--color-text-secondary)]">
        Already have an invite?
      </p>
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="INVITE CODE"
        autoCapitalize="characters"
        className={[
          'mt-3 w-full rounded-[14px] border bg-[var(--color-surface)] px-4 py-3.5 text-center font-mono text-[15px] tracking-[0.2em] text-white outline-none',
          error
            ? 't-shake border-[var(--color-danger)]'
            : 'border-[var(--color-hairline)] focus:border-[rgba(124,92,252,0.5)]',
        ].join(' ')}
      />
      {error && <p className="mt-2 text-center text-[13px] text-[var(--color-danger)]">{error}</p>}
      <button
        type="submit"
        disabled={pending || code.length < 4}
        className="mt-3 w-full rounded-full border border-[var(--color-hairline)] px-5 py-3 text-[14px] font-semibold text-white transition-colors hover:border-[rgba(124,92,252,0.4)] disabled:opacity-50"
      >
        {pending ? 'Checking…' : 'Enter Viola'}
      </button>
    </form>
  );
}

export function EarlyHero() {
  return (
    <header className="mx-auto flex w-full max-w-[720px] flex-col items-center px-4 pt-16 pb-10 text-center">
      <Link href="/" aria-label="Viola home">
        <Wordmark size={28} />
      </Link>
      <div className="t-stagger is-shown mt-10">
        <strong className="t-stagger-line t-stagger-line--1 display text-[42px] leading-[1.05] text-white sm:text-[52px]">
          Post your fit.
          <br />
          Voilà.
        </strong>
        <span className="t-stagger-line t-stagger-line--2 mx-auto mt-4 block max-w-md text-[16px] leading-relaxed text-[var(--color-text-secondary)]">
          Every piece named, scored, and shoppable — then one tap into iMessage. Early access is
          invite-first so the room stays good.
        </span>
      </div>
    </header>
  );
}
