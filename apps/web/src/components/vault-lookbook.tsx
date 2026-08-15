'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatPrice } from '@viola/core';
import { mediaUrl } from '@/lib/media';
import { LookGallery, type GalleryLook } from './look-gallery';

/**
 * Vault lookbook — CollectUI gallery energy on a dark canvas.
 *
 * One large focal piece, a thumbnail rail, and a shop CTA. Saving to a vault
 * is the paid accumulation feature; browsing that vault should feel like a
 * curated lookbook, not a shopping-cart dump.
 */

export interface VaultGalleryItem {
  id: string;
  lookItemId: string | null;
  brand: string | null;
  title: string | null;
  priceCents: number | null;
  currency: string | null;
  imagePath: string | null;
  photoPath: string | null;
  merchantUrl: string | null;
  lookSlug: string | null;
  lookHandle: string | null;
  lookScore: number | null;
  lookArchetype: string | null;
}

export function VaultLookbook({
  vaultName,
  items,
}: {
  vaultName: string;
  items: VaultGalleryItem[];
}) {
  const initial = Math.max(
    0,
    items.findIndex((item) => Boolean(item.imagePath || item.photoPath)),
  );
  const [active, setActive] = useState(initial === -1 ? 0 : initial);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const current = items[active] ?? items[0];

  const lookEntries: GalleryLook[] = items
    .filter((item): item is VaultGalleryItem & { lookSlug: string; photoPath: string } =>
      Boolean(item.lookSlug && item.photoPath),
    )
    .map((item) => ({
      id: item.id,
      slug: item.lookSlug!,
      photoPath: item.photoPath!,
      score: item.lookScore,
      archetypeName: item.lookArchetype,
      caption: null,
      handle: item.lookHandle ?? 'viola',
      bloomCount: 0,
      viewCount: 0,
      itemCount: 1,
    }));

  if (!current) return null;

  return (
    <div>
      {/* On large screens the thumb rail sits beside the stage; on small it
          becomes a horizontal strip under the stage so the title stays clean. */}
      <div className="grid gap-6 lg:grid-cols-[72px_minmax(0,1fr)] lg:items-start">
        <div className="no-scrollbar hidden max-h-[min(70vh,640px)] flex-col gap-2 overflow-y-auto lg:flex">
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(i)}
              aria-label={item.title ?? `Piece ${i + 1}`}
              aria-current={i === active ? 'true' : undefined}
              className={[
                'relative aspect-square w-full overflow-hidden rounded-[10px] bg-[var(--color-surface)] transition-all',
                i === active
                  ? 'ring-2 ring-[var(--color-viola)] ring-offset-2 ring-offset-[var(--color-ink)]'
                  : 'opacity-55 hover:opacity-90',
              ].join(' ')}
            >
              <VaultThumb item={item} />
            </button>
          ))}
        </div>

        <div>
          <div className="relative overflow-hidden rounded-[22px] border border-[var(--color-hairline)] bg-[var(--color-surface)]">
            <button
              type="button"
              onClick={() => {
                if (lookEntries.length > 0) setGalleryOpen(true);
              }}
              className="relative flex aspect-[4/3] max-h-[min(56vh,520px)] w-full items-center justify-center overflow-hidden bg-[rgba(255,255,255,0.03)]"
              aria-label={
                lookEntries.length > 0 ? 'Open lookbook gallery' : (current.title ?? vaultName)
              }
            >
              {/* Prefer the product cutout; fall back to the look photo so a
                  look-only save never lands as an empty slab. */}
              {current.imagePath ? (
                <img
                  src={mediaUrl(current.imagePath)}
                  alt=""
                  className="relative z-[1] h-[72%] w-[72%] object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.35)]"
                />
              ) : current.photoPath ? (
                <img
                  src={mediaUrl(current.photoPath)}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-white/15" />
                  <span className="text-[12px] text-[var(--color-text-tertiary)]">No image yet</span>
                </div>
              )}
            </button>

            <div className="flex flex-wrap items-end justify-between gap-4 border-t border-[var(--color-hairline)] px-5 py-4">
              <div className="min-w-0">
                {current.brand && (
                  <p className="label-caps truncate text-white">{current.brand}</p>
                )}
                <p className="label-caps-sub truncate">{current.title}</p>
                {current.lookHandle && (
                  <p className="mt-1.5 text-[12px] text-[var(--color-text-tertiary)]">
                    from @{current.lookHandle}
                    {current.lookArchetype ? ` · ${current.lookArchetype}` : ''}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {current.priceCents != null && (
                  <span className="stat text-[15px] text-white">
                    {formatPrice(current.priceCents, current.currency ?? undefined)}
                  </span>
                )}
                {current.lookItemId && current.merchantUrl && (
                  <a
                    href={`/go/${current.lookItemId}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow sponsored"
                    className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[var(--color-ink)] transition-transform active:scale-[0.97]"
                  >
                    Shop
                  </a>
                )}
                {current.lookSlug && (
                  <Link
                    href={`/l/${current.lookSlug}`}
                    className="rounded-full border border-[var(--color-hairline)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-text-secondary)] transition-colors hover:text-white"
                  >
                    Look
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto lg:hidden">
            {items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(i)}
                aria-current={i === active ? 'true' : undefined}
                className={[
                  'relative h-16 w-16 shrink-0 overflow-hidden rounded-[10px] bg-[var(--color-surface)]',
                  i === active ? 'ring-2 ring-[var(--color-viola)]' : 'opacity-50',
                ].join(' ')}
              >
                <VaultThumb item={item} />
              </button>
            ))}
          </div>

          <p className="mt-3 text-[12px] text-[var(--color-text-tertiary)]">
            {active + 1} / {items.length} in {vaultName}
          </p>
        </div>
      </div>

      <LookGallery
        looks={lookEntries}
        openIndex={galleryOpen ? Math.min(active, Math.max(0, lookEntries.length - 1)) : null}
        onClose={() => setGalleryOpen(false)}
        onIndexChange={(i) => {
          setActive(i);
        }}
      />
    </div>
  );
}

function VaultThumb({ item }: { item: VaultGalleryItem }) {
  if (item.imagePath) {
    return (
      <img
        src={mediaUrl(item.imagePath)}
        alt=""
        className="h-full w-full object-contain p-1.5"
        loading="lazy"
      />
    );
  }
  if (item.photoPath) {
    return (
      <img
        src={mediaUrl(item.photoPath)}
        alt=""
        className="h-full w-full object-cover"
        loading="lazy"
      />
    );
  }
  return <div className="absolute inset-0 bg-white/5" />;
}
