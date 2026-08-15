'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Tag a piece yourself.
 *
 * Only the owner of a look sees this. It exists because the person who wore
 * the thing knows what it is, and asking them is both free and more accurate
 * than any model.
 *
 * The friction budget here is tiny. Nobody fills in a form to help our margins,
 * so it is three fields, no modal ceremony, and it explains the one thing that
 * makes it worth their time: the link is theirs to share, and it works.
 */
export function IdentifyItem({
  slug,
  itemId,
  initialBrand,
  initialTitle,
  hasLink,
}: {
  slug: string;
  itemId: string;
  initialBrand: string | null;
  initialTitle: string | null;
  hasLink: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [brand, setBrand] = useState(initialBrand ?? '');
  const [title, setTitle] = useState(initialTitle ?? '');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/looks/${slug}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brand, title, url: url || undefined }),
      });

      const data = (await response.json()) as {
        seededCache?: boolean;
        error?: { message?: string };
      };

      if (response.status === 401) {
        router.push(`/signin?next=/l/${slug}`);
        return;
      }
      if (!response.ok) throw new Error(data.error?.message ?? 'Could not save that');

      if (data.seededCache) setSeeded(true);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[12px] text-[var(--color-text-tertiary)] underline-offset-2 transition-colors hover:text-[var(--color-viola-text)] hover:underline"
      >
        {hasLink ? 'Fix this' : 'Add the link'}
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-raised)] p-3.5">
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Brand"
            className="w-1/3 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-white placeholder:text-[var(--color-text-tertiary)]"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What is it?"
            className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-white placeholder:text-[var(--color-text-tertiary)]"
          />
        </div>

        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void save()}
          inputMode="url"
          placeholder="Paste the shop link"
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-white placeholder:text-[var(--color-text-tertiary)]"
        />
      </div>

      {error && <p className="mt-2 text-[12px] text-[var(--color-danger)]">{error}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || (!brand.trim() && !title.trim() && !url.trim())}
          className="rounded-full bg-[var(--color-viola)] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-45"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12px] text-[var(--color-text-tertiary)] hover:text-white"
        >
          Cancel
        </button>
      </div>

      <p className="mt-2.5 text-[11px] leading-relaxed text-[var(--color-text-tertiary)]">
        You know what you wore better than we do. Adding it makes the link work for everyone who
        shares your look.
      </p>

      {seeded && (
        <p className="mt-1.5 text-[11px] text-[var(--color-viola-text)]">
          Nice — that piece is now findable for everyone.
        </p>
      )}
    </div>
  );
}
