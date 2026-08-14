'use client';

import { useEffect } from 'react';
import { emit } from '@/lib/client-analytics';
import Link from 'next/link';

/**
 * The paywall sheet.
 *
 * Shown only at the moment someone hits a limit, never pre-emptively. A paywall
 * that interrupts before the user has felt the value is the fastest way to lose
 * them, and the free tier is deliberately generous enough that reaching this
 * means they are already invested.
 *
 * The copy names the specific thing they were trying to do, because a generic
 * "upgrade to Pro" converts far worse than "you've filled your vault".
 */

export interface PaywallProps {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
}

const BENEFITS = [
  'Unlimited vaults, unlimited saves',
  'No sponsored posts',
  'Unlimited AI look tagging',
  'Private looks',
  'Your full score breakdown',
] as const;

export function Paywall({ open, onClose, title, body }: PaywallProps) {
  useEffect(() => {
    if (!open) return;
    emit('paywall_shown', { trigger: title });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose, title]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[rgba(11,10,15,0.72)] backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
        className="animate-rise relative w-full max-w-[420px] rounded-t-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-6 pt-7 pb-8 sm:rounded-[var(--radius-xl)]"
      >
        <p className="label-caps text-[var(--color-viola-text)]">Viola Plus</p>
        <h2 id="paywall-title" className="display mt-2 text-[28px] leading-tight text-white">
          {title}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
          {body}
        </p>

        <ul className="mt-5 flex flex-col gap-2.5">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-center gap-2.5">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--color-viola-soft)]">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M5 12.5 10 17.5 19 7"
                    stroke="var(--color-viola)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="text-[14px] text-white">{benefit}</span>
            </li>
          ))}
        </ul>

        <Link
          href="/plus"
          className="mt-6 block rounded-full bg-[var(--color-viola)] px-5 py-3.5 text-center text-[15px] font-semibold text-white transition-transform active:scale-[0.98]"
        >
          See Viola Plus
        </Link>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full text-[13px] text-[var(--color-text-tertiary)] transition-colors hover:text-white"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
