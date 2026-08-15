'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { mediaUrl } from '@/lib/media';
import { formatCount } from '@/lib/format';

/**
 * Horizontal snap slider for featured looks.
 *
 * CollectUI image-slider energy, translated into Viola: full-bleed photo
 * slides, archetype + score as the only overlay, soft progress dots, and
 * keyboard/drag navigation. Lives above the feed grid as a "this week"
 * runway — one job, one composition.
 */

export interface SliderLook {
  id: string;
  slug: string;
  photoPath: string;
  score: number | null;
  archetypeName: string | null;
  handle: string;
  bloomCount: number;
  viewCount: number;
  itemCount: number;
}

export function LookSlider({
  looks,
  title = 'This week',
}: {
  looks: SliderLook[];
  title?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const syncActive = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    setActive(Math.max(0, Math.min(looks.length - 1, next)));
  }, [looks.length]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    syncActive();
    el.addEventListener('scroll', syncActive, { passive: true });
    return () => el.removeEventListener('scroll', syncActive);
  }, [syncActive]);

  const goTo = (index: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
  };

  if (looks.length === 0) return null;

  return (
    <section className="mb-8" aria-label={title}>
      <div className="mb-3 flex items-end justify-between gap-3 px-0.5">
        <div>
          <p className="label-caps text-[var(--color-gold)]">✦ {title}</p>
          <h2 className="display mt-1 text-[22px] leading-tight text-white sm:text-[26px]">
            Looks earning the room
          </h2>
        </div>
        <p className="stat text-[12px] text-[var(--color-text-tertiary)]">
          {active + 1} / {looks.length}
        </p>
      </div>

      <div className="relative overflow-hidden rounded-[22px] border border-[var(--color-hairline)] bg-[var(--color-surface)]">
        <div
          ref={scrollerRef}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {looks.map((look) => (
            <Link
              key={look.id}
              href={`/l/${look.slug}`}
              className="relative aspect-[4/5] w-full shrink-0 snap-center sm:aspect-[16/10]"
            >
              <img
                src={mediaUrl(look.photoPath)}
                alt={look.archetypeName ? `${look.archetypeName} by @${look.handle}` : `Look by @${look.handle}`}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,10,15,0.18)_0%,transparent_38%,rgba(11,10,15,0.82)_100%)]" />

              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-white/70">@{look.handle}</p>
                  {look.archetypeName && (
                    <p className="display mt-1 truncate text-[28px] leading-none text-white sm:text-[34px]">
                      {look.archetypeName}
                      {look.score != null && (
                        <span className="stat ml-2.5 text-[18px] text-white/60">{look.score}</span>
                      )}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-white/10 bg-black/30 px-3.5 py-2 backdrop-blur-md">
                  <span className="stat text-[12px] text-white">{look.itemCount} pcs</span>
                  <span className="h-1 w-1 rounded-full bg-white/25" aria-hidden="true" />
                  <span className="stat text-[12px] text-white">
                    {formatCount(look.bloomCount)} blooms
                  </span>
                  <span className="h-1 w-1 rounded-full bg-white/25" aria-hidden="true" />
                  <span className="stat text-[12px] text-white">
                    {formatCount(look.viewCount)} views
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {looks.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => goTo(Math.max(0, active - 1))}
              className="absolute top-1/2 left-3 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-md transition-colors hover:bg-black/50 sm:flex"
            >
              <Arrow direction="left" />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => goTo(Math.min(looks.length - 1, active + 1))}
              className="absolute top-1/2 right-3 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-md transition-colors hover:bg-black/50 sm:flex"
            >
              <Arrow direction="right" />
            </button>
          </>
        )}
      </div>

      {looks.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5" role="tablist" aria-label="Slides">
          {looks.map((look, i) => (
            <button
              key={look.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Slide ${i + 1}`}
              onClick={() => goTo(i)}
              className={[
                'h-1.5 rounded-full transition-all',
                i === active
                  ? 'w-6 bg-[var(--color-viola)]'
                  : 'w-1.5 bg-white/25 hover:bg-white/45',
              ].join(' ')}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Arrow({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d={direction === 'left' ? 'M10 3.5L5.5 8 10 12.5' : 'M6 3.5L10.5 8 6 12.5'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
