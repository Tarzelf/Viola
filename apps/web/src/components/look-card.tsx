import Link from 'next/link';
import { formatItemLabel, formatPrice } from '@viola/core';
import type { LookItemView, LookView } from '@/lib/queries';
import { mediaUrl } from '@/lib/media';
import { formatCount } from '@/lib/format';
import { BloomButton } from './bloom-button';

/**
 * The annotated look card, in the browser.
 *
 * Mirrors the server-rendered share card so what a user sees on the page and
 * what lands in a group chat are the same composition. Positions come straight
 * from the layout engine's normalised coordinates, expressed as percentages, so
 * the card is fully responsive without recomputing anything client-side.
 */

interface LookCardProps {
  look: LookView;
  /** Staggered reveal on first publish; off in the feed. */
  animate?: boolean;
  priority?: boolean;
}

export function LookCard({ look, animate = false, priority = false }: LookCardProps) {
  const layout = look.layout;
  const itemsByIndex = new Map(look.items.map((item, index) => [index, item]));

  return (
    <div className="relative w-full overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-surface)]">
      <div className="relative aspect-[4/5] w-full">
        <img
          src={mediaUrl(look.photoPath)}
          alt={look.caption ?? `A look by @${look.handle}`}
          className="absolute inset-0 h-full w-full object-cover"
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
        />

        {/* Scrim, kept light so the photograph still reads as a photograph. */}
        <div className="absolute inset-0 bg-[var(--color-scrim)]" />
        <div className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-b from-transparent to-[rgba(11,10,15,0.88)]" />

        {layout?.slots.map((slot, i) => {
          const item = itemsByIndex.get(slot.itemIndex);
          if (!item) return null;
          return (
            <ItemAnnotation key={item.id} item={item} slot={slot} index={i} animate={animate} />
          );
        })}

        {/* The score pill. Archetype first, number second — a name invites
            identity, a number invites ranking. */}
        {look.score !== null && look.archetypeName && (
          <div
            className="absolute inset-x-0 bottom-[13%] flex justify-center"
            style={
              animate ? { animation: `viola-pop 420ms var(--ease-bouncy) 620ms both` } : undefined
            }
          >
            <div className="flex items-baseline gap-2.5 rounded-full bg-[var(--color-viola)] px-5 py-2.5 shadow-[var(--shadow-glow)]">
              <span className="display text-[19px] leading-none text-white">
                {look.archetypeName}
              </span>
              <span className="stat text-[16px] leading-none text-white/70">{look.score}</span>
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-[5%] flex justify-center">
          <span className="text-[11px] font-medium tracking-[0.08em] text-white/45">
            viola.app/@{look.handle}
          </span>
        </div>
      </div>
    </div>
  );
}

function ItemAnnotation({
  item,
  slot,
  index,
  animate,
}: {
  item: LookItemView;
  slot: NonNullable<LookView['layout']>['slots'][number];
  index: number;
  animate: boolean;
}) {
  const label = formatItemLabel(item);
  const left = slot.rect.x0 * 100;
  const top = slot.rect.y0 * 100;
  const width = (slot.rect.x1 - slot.rect.x0) * 100;

  // L-shaped leader: horizontal out from the card, then vertical to the
  // garment. A single horizontal rule leaves a visible gap whenever the safe
  // zone lifts a card away from the piece it labels.
  const startX = slot.side === 'left' ? slot.rect.x1 : slot.rect.x0;
  const lineLeft = Math.min(startX, slot.anchor.x) * 100;
  const lineWidth = Math.abs(slot.anchor.x - startX) * 100;
  const lineTop = ((slot.rect.y0 + slot.rect.y1) / 2) * 100;
  const dropTop = Math.min((slot.rect.y0 + slot.rect.y1) / 2, slot.anchor.y) * 100;
  const dropHeight = Math.abs(slot.anchor.y - (slot.rect.y0 + slot.rect.y1) / 2) * 100;

  const delay = animate ? 180 + index * 90 : 0;
  const style = animate
    ? { animation: `viola-rise 420ms var(--ease-gentle) ${delay}ms both` }
    : undefined;

  return (
    <>
      {lineWidth > 0.5 && (
        <div
          /* Visual QA flagged these as too faint to trace against a busy
             photo. Lifted the opacity and added a dark hairline shadow so the
             line survives on both light and dark backgrounds. */
          className="absolute h-px bg-white/55 shadow-[0_1px_0_rgba(11,10,15,0.45)]"
          style={{ left: `${lineLeft}%`, top: `${lineTop}%`, width: `${lineWidth}%`, ...style }}
        />
      )}
      {dropHeight > 0.5 && (
        <div
          className="absolute w-px bg-white/55 shadow-[1px_0_0_rgba(11,10,15,0.45)]"
          style={{
            left: `${slot.anchor.x * 100}%`,
            top: `${dropTop}%`,
            height: `${dropHeight}%`,
            ...style,
          }}
        />
      )}
      <div
        className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-viola)] ring-2 ring-[rgba(11,10,15,0.35)]"
        style={{ left: `${slot.anchor.x * 100}%`, top: `${slot.anchor.y * 100}%`, ...style }}
      />

      <div
        className="absolute flex flex-col items-center overflow-hidden"
        style={{
          left: `${left}%`,
          top: `${top}%`,
          width: `${width}%`,
          height: `${(slot.rect.y1 - slot.rect.y0) * 100}%`,
          ...style,
        }}
      >
        {item.imagePath && (
          <img
            src={mediaUrl(item.imagePath)}
            alt=""
            /* Height is capped as well as width. Sizing by width alone let a
               tall cutout push its label into the block beneath it — visible
               in the demo recording as the price of one item nearly touching
               the brand line of the next. */
            className="mb-1.5 max-h-[58%] w-[70%] object-contain drop-shadow-[0_6px_18px_rgba(11,10,15,0.5)]"
            loading="lazy"
          />
        )}
        <span className="label-caps text-center text-white">{label.brand}</span>
        <span className="label-caps-sub text-center">{label.name}</span>
        {item.priceCents != null && (
          <span className="stat mt-0.5 text-[11px] text-white/55">
            {formatPrice(item.priceCents, item.currency)}
          </span>
        )}
      </div>
    </>
  );
}

/** Compact card for the feed grid. */
export function FeedCard({
  look,
}: {
  look: {
    slug: string;
    photoPath: string;
    score: number | null;
    archetypeName: string | null;
    caption: string | null;
    handle: string;
    bloomCount: number;
    viewCount: number;
    itemCount: number;
    bloomedByViewer: boolean;
  };
}) {
  return (
    <article className="group">
      <Link href={`/l/${look.slug}`} className="block">
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-surface)]">
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
        </div>
      </Link>

      <div className="mt-2.5 flex items-center justify-between gap-3 px-0.5">
        <Link
          href={`/@${look.handle}`}
          className="text-[13px] font-medium text-[var(--color-text-secondary)] transition-colors hover:text-white"
        >
          @{look.handle}
        </Link>
        <div className="flex items-center gap-2">
          <span className="stat text-[12px] text-[var(--color-text-tertiary)]">
            {formatCount(look.viewCount)} views
          </span>
          <BloomButton
            slug={look.slug}
            initialCount={look.bloomCount}
            initialBloomed={look.bloomedByViewer}
          />
        </div>
      </div>
    </article>
  );
}
