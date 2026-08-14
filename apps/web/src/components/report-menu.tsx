'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Report and block.
 *
 * Two of the four things App Store guideline 1.2 requires of a UGC app, and
 * both need to be reachable from the content itself rather than buried in
 * settings — a reporting flow nobody can find does not count.
 */

const REASONS = [
  { id: 'nudity', label: 'Nudity or sexual content' },
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'violence', label: 'Violence or hate' },
  { id: 'impersonation', label: 'Impersonation' },
  { id: 'spam', label: 'Spam' },
  { id: 'other', label: 'Something else' },
] as const;

export function ReportMenu({ lookId, handle }: { lookId: string; handle: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'reasons' | 'done'>('menu');
  const [busy, setBusy] = useState(false);

  async function report(reason: string) {
    setBusy(true);
    await fetch('/api/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetType: 'look', targetId: lookId, reason }),
    }).catch(() => {});
    setBusy(false);
    setView('done');
  }

  async function block() {
    setBusy(true);
    const response = await fetch('/api/blocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handle }),
    });
    setBusy(false);

    if (response.status === 401) {
      router.push('/signin');
      return;
    }
    close();
    router.push('/');
    router.refresh();
  }

  function close() {
    setOpen(false);
    setView('menu');
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="More options"
        className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-tertiary)] transition-colors hover:bg-white/5 hover:text-white"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[400] flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="absolute inset-0 cursor-default bg-[rgba(11,10,15,0.72)] backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="animate-rise relative w-full max-w-[380px] overflow-hidden rounded-t-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-surface)] pt-2 pb-6 sm:rounded-[var(--radius-xl)]"
          >
            {view === 'menu' && (
              <div className="flex flex-col py-2">
                <button
                  type="button"
                  onClick={() => setView('reasons')}
                  className="px-5 py-3.5 text-left text-[15px] text-white transition-colors hover:bg-white/5"
                >
                  Report this look
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={block}
                  className="px-5 py-3.5 text-left text-[15px] text-[var(--color-danger)] transition-colors hover:bg-white/5"
                >
                  Block @{handle}
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="px-5 py-3.5 text-left text-[15px] text-[var(--color-text-secondary)] transition-colors hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            )}

            {view === 'reasons' && (
              <div className="flex flex-col py-2">
                <p className="label-caps px-5 py-3 text-[var(--color-text-tertiary)]">
                  Why are you reporting this?
                </p>
                {REASONS.map((reason) => (
                  <button
                    key={reason.id}
                    type="button"
                    disabled={busy}
                    onClick={() => report(reason.id)}
                    className="px-5 py-3.5 text-left text-[15px] text-white transition-colors hover:bg-white/5"
                  >
                    {reason.label}
                  </button>
                ))}
              </div>
            )}

            {view === 'done' && (
              <div className="px-6 py-9 text-center">
                <h2 className="display text-[22px] text-white">Thanks for telling us</h2>
                <p className="mt-2 text-[14px] text-[var(--color-text-secondary)]">
                  A person reviews every report. We usually get to them within a day.
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-5 rounded-full bg-[var(--color-viola)] px-5 py-2.5 text-[14px] font-semibold text-white"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
