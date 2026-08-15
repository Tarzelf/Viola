'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ModerationActions({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: 'remove' | 'dismiss') {
    setBusy(true);
    await fetch('/api/moderation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reportId, action }),
    });
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex shrink-0 gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => act('dismiss')}
        className="rounded-full border border-[var(--color-hairline)] px-3 py-2 text-[12px] text-[var(--color-text-secondary)] transition-colors hover:text-white"
      >
        Dismiss
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => act('remove')}
        className="rounded-full bg-[var(--color-danger)] px-3 py-2 text-[12px] font-semibold text-white"
      >
        Remove
      </button>
    </div>
  );
}
