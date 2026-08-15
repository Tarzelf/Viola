'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { mediaUrl } from '@/lib/media';
import { formatCount } from '@/lib/format';

/**
 * Immersive look gallery.
 *
 * Inspired by the CollectUI gallery references the user shared: one large
 * focal image, a thumbnail rail for orientation, a calm metadata pill, and
 * quiet prev/next controls. Adapted to Viola's near-black canvas and violet
 * accent — no floating white chrome, no EXIF clutter.
 *
 * Used as a lightbox over a profile or vault grid. Opening a look here is
 * for browsing; tapping through still lands on the share page for Bloom /
 * Shop / Share.
 */

export interface GalleryLook {
  id: string;
  slug: string;
  photoPath: string;
  score: number | null;
  archetypeName: string | null;
  caption: string | null;
  handle: string;
  bloomCount: number;
  viewCount: number;
  itemCount: number;
  bloomedByViewer?: boolean;
}

interface LookGalleryProps {
  looks: GalleryLook[];
  /** Index to open on. Null means closed. */
  openIndex: number | null;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
}

export function LookGallery({ looks, openIndex, onClose, onIndexChange }: LookGalleryProps) {
  const titleId = useId();
  const thumbRailRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [opening, setOpening] = useState(false);
  const [closing, setClosing] = useState(false);
  const [index, setIndex] = useState(0);

  const wantOpen = openIndex !== null && looks.length > 0;

  useEffect(() => {
    if (wantOpen && openIndex !== null) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setIndex(openIndex);
      setClosing(false);
      if (!mountedRef.current) {
        mountedRef.current = true;
        setMounted(true);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setOpening(true));
        });
      } else {
        setOpening(true);
      }
      return;
    }

    if (!mountedRef.current) return;
    setOpening(false);
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      mountedRef.current = false;
      setMounted(false);
      setClosing(false);
    }, 160);

    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [wantOpen, openIndex]);

  // Sync index while open when parent arrows via props.
  useEffect(() => {
    if (openIndex !== null) setIndex(openIndex);
  }, [openIndex]);

  const go = useCallback(
    (next: number) => {
      if (looks.length === 0) return;
      const wrapped = ((next % looks.length) + looks.length) % looks.length;
      setIndex(wrapped);
      onIndexChange?.(wrapped);
    },
    [looks.length, onIndexChange],
  );

  useEffect(() => {
    if (!mounted || closing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        go(index + 1);
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        go(index - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [mounted, closing, index, go, onClose]);

  useEffect(() => {
    if (!mounted || !thumbRailRef.current) return;
    const active = thumbRailRef.current.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [mounted, index]);

  const look = looks[index];
  if (!mounted || !look) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={[
        't-modal fixed inset-0 z-[500] flex flex-col bg-[rgba(11,10,15,0.94)] backdrop-blur-xl',
        opening ? 'is-open' : '',
        closing ? 'is-closing' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <p id={titleId} className="min-w-0 truncate text-[14px] text-[var(--color-text-secondary)]">
          <span className="font-semibold text-white">@{look.handle}</span>
          {look.archetypeName && (
            <>
              <span className="mx-2 text-white/25">·</span>
              <span className="display text-[16px] text-white">{look.archetypeName}</span>
              {look.score != null && (
                <span className="stat ml-2 text-[13px] text-white/55">{look.score}</span>
              )}
            </>
          )}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close gallery"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[var(--color-hairline)] text-white/70 transition-colors hover:border-white/25 hover:text-white"
        >
          <CloseIcon />
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Desktop: vertical thumbnail rail — CollectUI pattern. */}
        <div
          ref={thumbRailRef}
          className="no-scrollbar hidden w-[72px] shrink-0 flex-col gap-2 overflow-y-auto py-2 pl-4 sm:flex"
        >
          {looks.map((entry, i) => (
            <button
              key={entry.id}
              type="button"
              data-active={i === index ? 'true' : 'false'}
              onClick={() => onIndexChange?.(i)}
              aria-label={`Look ${i + 1} of ${looks.length}`}
              aria-current={i === index ? 'true' : undefined}
              className={[
                'relative aspect-[4/5] w-full overflow-hidden rounded-[10px] transition-all',
                i === index
                  ? 'ring-2 ring-[var(--color-viola)] ring-offset-2 ring-offset-[var(--color-ink)]'
                  : 'opacity-55 hover:opacity-90',
              ].join(' ')}
            >
              <img
                src={mediaUrl(entry.photoPath)}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>

        <div className="relative flex min-w-0 flex-1 flex-col items-center justify-center px-3 pb-4 sm:px-8">
          <div className="relative w-full max-w-[min(92vw,520px)]">
            <Link
              href={`/l/${look.slug}`}
              className="group relative block aspect-[4/5] w-full overflow-hidden rounded-[22px] bg-[var(--color-surface)] shadow-[0_40px_80px_rgba(0,0,0,0.45)]"
            >
              <img
                src={mediaUrl(look.photoPath)}
                alt={look.caption ?? `A look by @${look.handle}`}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-b from-transparent to-[rgba(11,10,15,0.88)]" />

              {look.score !== null && look.archetypeName && (
                <div className="absolute bottom-4 left-4 flex items-baseline gap-2 rounded-full bg-[var(--color-viola)] px-3.5 py-1.5">
                  <span className="display text-[15px] leading-none text-white">
                    {look.archetypeName}
                  </span>
                  <span className="stat text-[12px] leading-none text-white/70">{look.score}</span>
                </div>
              )}
            </Link>

            {/* Vertical nav pill — CollectUI right-rail pattern. */}
            {looks.length > 1 && (
              <div className="absolute top-1/2 -right-3 hidden -translate-y-1/2 flex-col overflow-hidden rounded-full border border-[var(--color-hairline)] bg-[rgba(20,18,32,0.92)] sm:flex">
                <NavButton label="Previous look" onClick={() => go(index - 1)}>
                  <Chevron direction="up" />
                </NavButton>
                <NavButton label="Next look" onClick={() => go(index + 1)}>
                  <Chevron direction="down" />
                </NavButton>
              </div>
            )}
          </div>

          {/* Metadata pill — CollectUI EXIF bar, adapted for social proof. */}
          <div className="mt-5 flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-full border border-[var(--color-hairline)] bg-[rgba(20,18,32,0.85)] px-4 py-2.5 backdrop-blur-md">
            <MetaStat label="pieces" value={String(look.itemCount)} />
            <Dot />
            <MetaStat label="blooms" value={formatCount(look.bloomCount)} />
            <Dot />
            <MetaStat label="views" value={formatCount(look.viewCount)} />
            <Dot />
            <Link
              href={`/l/${look.slug}`}
              className="text-[12px] font-semibold text-[var(--color-viola-text)] hover:underline"
            >
              Open look
            </Link>
          </div>

          {/* Mobile: horizontal thumb rail. */}
          <div className="no-scrollbar mt-5 flex w-full max-w-[520px] gap-2 overflow-x-auto px-1 sm:hidden">
            {looks.map((entry, i) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => onIndexChange?.(i)}
                aria-label={`Look ${i + 1}`}
                aria-current={i === index ? 'true' : undefined}
                className={[
                  'relative h-16 w-12 shrink-0 overflow-hidden rounded-[8px]',
                  i === index ? 'ring-2 ring-[var(--color-viola)]' : 'opacity-50',
                ].join(' ')}
              >
                <img
                  src={mediaUrl(entry.photoPath)}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>

          <p className="mt-3 text-[12px] text-[var(--color-text-tertiary)]">
            {index + 1} / {looks.length}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Grid that opens the gallery on click. Keeps FeedCard chrome for the grid. */
export function GalleryGrid({
  looks,
  renderCard,
}: {
  looks: GalleryLook[];
  renderCard: (look: GalleryLook, open: () => void) => React.ReactNode;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {looks.map((look, i) => (
          <div key={look.id}>{renderCard(look, () => setOpenIndex(i))}</div>
        ))}
      </div>
      <LookGallery
        looks={looks}
        openIndex={openIndex}
        onClose={() => setOpenIndex(null)}
        onIndexChange={setOpenIndex}
      />
    </>
  );
}

function MetaStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="stat text-[13px] text-white">{value}</span>
      <span className="text-[11px] tracking-[0.04em] text-[var(--color-text-tertiary)]">
        {label}
      </span>
    </span>
  );
}

function Dot() {
  return <span className="h-1 w-1 rounded-full bg-white/20" aria-hidden="true" />;
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center text-white/70 transition-colors hover:bg-white/5 hover:text-white"
    >
      {children}
    </button>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Chevron({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d={direction === 'up' ? 'M3.5 8.5L7 5l3.5 3.5' : 'M3.5 5.5L7 9l3.5-3.5'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
