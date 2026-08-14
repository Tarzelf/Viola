'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Account deletion.
 *
 * Apple requires this to be reachable in-app, not only via a support email.
 *
 * The confirmation asks the user to type DELETE rather than tapping a second
 * button. Two taps in a row is how people delete accounts by accident, and
 * this is not recoverable.
 */
export function DangerZone() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      });
      if (!response.ok) throw new Error('Could not delete the account');

      router.push('/');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 rounded-[var(--radius-xl)] border border-[rgba(242,112,127,0.25)] bg-[rgba(242,112,127,0.04)] px-5 py-5">
      <p className="label-caps text-[var(--color-danger)]">Danger zone</p>

      {!open ? (
        <>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
            Deleting removes your looks, vaults and profile. It cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-4 rounded-full border border-[rgba(242,112,127,0.4)] px-4 py-2.5 text-[13px] font-medium text-[var(--color-danger)] transition-colors hover:bg-[rgba(242,112,127,0.08)]"
          >
            Delete my account
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
            Type <span className="stat text-white">DELETE</span> to confirm.
          </p>
          <input
            autoFocus
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-3 w-full rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface-raised)] px-4 py-3 text-[15px] text-white"
            placeholder="DELETE"
          />
          {error && <p className="mt-3 text-[13px] text-[var(--color-danger)]">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy || confirm.trim().toUpperCase() !== 'DELETE'}
              onClick={remove}
              className="rounded-full bg-[var(--color-danger)] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
            >
              {busy ? 'Deleting…' : 'Delete permanently'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirm('');
              }}
              className="rounded-full px-4 py-2.5 text-[13px] text-[var(--color-text-secondary)] hover:text-white"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </section>
  );
}
