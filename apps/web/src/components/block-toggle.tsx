'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Blocking from a profile — the other half of the guideline 1.2 requirement. */
export function BlockToggle({ handle }: { handle: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function block() {
    setBusy(true);
    await fetch('/api/blocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handle }),
    });
    setBusy(false);
    router.push('/');
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="shrink-0 rounded-full border border-[var(--color-hairline)] px-3.5 py-2 text-[12px] font-medium text-[var(--color-text-tertiary)] transition-colors hover:border-[rgba(242,112,127,0.4)] hover:text-[var(--color-danger)]"
      >
        Block
      </button>
    );
  }

  return (
    <div className="flex shrink-0 gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={block}
        className="rounded-full bg-[var(--color-danger)] px-3.5 py-2 text-[12px] font-semibold text-white"
      >
        {busy ? '…' : 'Confirm'}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-full px-2 py-2 text-[12px] text-[var(--color-text-tertiary)] hover:text-white"
      >
        Cancel
      </button>
    </div>
  );
}
