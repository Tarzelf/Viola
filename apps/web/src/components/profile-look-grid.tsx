'use client';

import Link from 'next/link';
import { mediaUrl } from '@/lib/media';
import { formatCount } from '@/lib/format';
import { BloomButton } from './bloom-button';
import { GalleryGrid, type GalleryLook } from './look-gallery';

/**
 * Profile / collection grid that opens the immersive gallery on photo tap,
 * while keeping Bloom and the handle link as first-class actions.
 */
export function ProfileLookGrid({ looks }: { looks: GalleryLook[] }) {
  return (
    <GalleryGrid
      looks={looks}
      renderCard={(look, open) => (
        <article className="group">
          <button
            type="button"
            onClick={open}
            className="relative block aspect-[4/5] w-full overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-surface)] text-left"
            aria-label={`Browse ${look.archetypeName ?? 'look'} by @${look.handle}`}
          >
            <img
              src={mediaUrl(look.photoPath)}
              alt={look.caption ?? `A look by @${look.handle}`}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-[rgba(11,10,15,0.9)]" />

            {look.score !== null && look.archetypeName && (
              <div className="absolute bottom-3 left-3 flex items-baseline gap-2 rounded-full bg-[var(--color-viola)] px-3 py-1.5">
                <span className="display text-[14px] leading-none text-white">
                  {look.archetypeName}
                </span>
                <span className="stat text-[12px] leading-none text-white/70">{look.score}</span>
              </div>
            )}

            {look.itemCount > 0 && (
              <div className="absolute top-3 right-3 rounded-full border border-white/15 bg-black/35 px-2.5 py-1 backdrop-blur-sm">
                <span className="label-caps text-[10px] tracking-[0.16em] text-white/85">
                  {look.itemCount} pieces
                </span>
              </div>
            )}
          </button>

          <div className="mt-2.5 flex items-center justify-between gap-3 px-0.5">
            <Link
              href={`/l/${look.slug}`}
              className="text-[13px] font-medium text-[var(--color-text-secondary)] transition-colors hover:text-white"
            >
              Open look
            </Link>
            <div className="flex items-center gap-2">
              <span className="stat text-[12px] text-[var(--color-text-tertiary)]">
                {formatCount(look.viewCount)} views
              </span>
              <BloomButton
                slug={look.slug}
                initialCount={look.bloomCount}
                initialBloomed={look.bloomedByViewer ?? false}
              />
            </div>
          </div>
        </article>
      )}
    />
  );
}
