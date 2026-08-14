'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Paywall } from './paywall';

/**
 * Save to a vault.
 *
 * Three outcomes the UI has to handle distinctly, because collapsing them into
 * one generic error is how a paywall becomes infuriating:
 *
 *   401 — signed out, so send them to sign in and come back
 *   402 — over the free limit, so show the paywall with the specific reason
 *   ok  — saved, with a quiet confirmation
 */
export function SaveButton({
  lookId,
  lookItemId,
  label = 'Save',
  compact = false,
}: {
  lookId?: string;
  lookItemId?: string;
  label?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paywall, setPaywall] = useState<{ title: string; body: string } | null>(null);

  async function handleSave() {
    if (saved || busy) return;
    setBusy(true);

    try {
      const response = await fetch('/api/saves', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lookId, lookItemId }),
      });

      if (response.status === 401) {
        router.push(`/signin?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      const data = (await response.json()) as { error?: { message?: string } };

      if (response.status === 402) {
        setPaywall({
          title: 'Your vault is full',
          body: data.error?.message ?? 'Viola Plus makes saving unlimited.',
        });
        return;
      }

      if (!response.ok) throw new Error(data.error?.message ?? 'Could not save');
      setSaved(true);
    } catch {
      /* transient — leave the button in its unsaved state so they can retry */
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleSave}
        disabled={saved}
        aria-label={saved ? 'Saved to your vault' : label}
        className={[
          'inline-flex items-center gap-2 rounded-full border transition-all active:scale-[0.96]',
          compact ? 'px-3 py-2 text-[12px]' : 'px-4 py-3 text-[14px]',
          saved
            ? 'border-transparent bg-[var(--color-viola-soft)] text-[var(--color-viola)]'
            : 'border-[var(--color-hairline)] text-[var(--color-text-secondary)] hover:border-[rgba(124,92,252,0.4)] hover:text-white',
        ].join(' ')}
      >
        <svg
          width={compact ? 13 : 15}
          height={compact ? 13 : 15}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1Z"
            fill={saved ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
        {saved ? 'Saved' : label}
      </button>

      <Paywall
        open={paywall !== null}
        onClose={() => setPaywall(null)}
        title={paywall?.title ?? ''}
        body={paywall?.body ?? ''}
      />
    </>
  );
}
