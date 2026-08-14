'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Paywall } from './paywall';

/**
 * Creating a vault — the paid action from the brief.
 *
 * When the account is already at its limit we do not even attempt the request:
 * showing the paywall immediately is faster and more honest than a round trip
 * that is certain to fail. The server still enforces it, of course.
 */
export function NewVaultButton({ atLimit, limit }: { atLimit: boolean; limit: number | null }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/vaults', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as { error?: { message?: string } };

      if (response.status === 402) {
        setCreating(false);
        setPaywall(true);
        return;
      }
      if (!response.ok) throw new Error(data.error?.message ?? 'Could not create that');

      setCreating(false);
      setName('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (atLimit ? setPaywall(true) : setCreating(true))}
        className="shrink-0 rounded-full border border-[var(--color-hairline)] px-4 py-2.5 text-[13px] font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[rgba(124,92,252,0.4)] hover:text-white"
      >
        New vault
      </button>

      {creating && (
        <div className="fixed inset-0 z-[400] flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setCreating(false)}
            className="absolute inset-0 cursor-default bg-[rgba(11,10,15,0.72)] backdrop-blur-sm"
          />
          <div className="animate-rise relative w-full max-w-[380px] rounded-t-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-6 pt-6 pb-7 sm:rounded-[var(--radius-xl)]">
            <h2 className="display text-[24px] text-white">New vault</h2>
            <input
              autoFocus
              value={name}
              maxLength={48}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && name.trim() && void create()}
              placeholder="Summer, going out, wishlist…"
              className="mt-4 w-full rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-raised)] px-4 py-3 text-[15px] text-white placeholder:text-[var(--color-text-tertiary)]"
            />
            {error && <p className="mt-3 text-[13px] text-[var(--color-danger)]">{error}</p>}
            <button
              type="button"
              disabled={busy || name.trim().length === 0}
              onClick={create}
              className="mt-4 w-full rounded-full bg-[var(--color-viola)] px-5 py-3 text-[15px] font-semibold text-white disabled:opacity-45"
            >
              {busy ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      )}

      <Paywall
        open={paywall}
        onClose={() => setPaywall(false)}
        title="Room for more"
        body={
          limit === 1
            ? 'Saved is your free vault. Viola Plus lets you make as many as you like — by season, by mood, by whatever.'
            : 'Viola Plus unlocks unlimited vaults.'
        }
      />
    </>
  );
}
