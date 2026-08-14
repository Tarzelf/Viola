import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatItemLabel, formatPrice } from '@viola/core';
import { getLookBySlug } from '@/lib/queries';
import { getViewer } from '@/lib/identity';
import { mediaUrl } from '@/lib/media';
import { LookCard } from '@/components/look-card';
import { BloomButton } from '@/components/bloom-button';
import { formatCount } from '@/lib/format';
import { ShareRow } from '@/components/share-row';
import { ViewPing } from '@/components/view-ping';
import { Wordmark } from '@/components/app-shell';

export const dynamic = 'force-dynamic';

/**
 * The public share page.
 *
 * This is where the viral loop either works or dies, so it follows the
 * evidence closely:
 *
 *   - No authentication wall. The recipient sees the entire look immediately.
 *     Value before account, every time.
 *   - Referrer context in the header ("Maya wants you to rate this fit"), which
 *     measurably lifts conversion versus a cold landing.
 *   - The primary action is Bloom, and it works signed-out.
 *   - The signup prompt appears *after* they act, never before.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ r?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const look = await getLookBySlug(slug);
  if (!look) return { title: 'Look not found' };

  const title = look.archetypeName ? `${look.archetypeName} · ${look.score}` : 'A look on Viola';
  const description =
    look.items.length > 0
      ? `${look.items
          .slice(0, 3)
          .map((i) => formatItemLabel(i).brand || formatItemLabel(i).name)
          .join(' · ')} — shop the look on Viola.`
      : 'Every piece identified, scored, and shoppable.';

  return {
    title,
    description,
    openGraph: {
      title: `${title} — @${look.handle}`,
      description,
      // The generated card is the link preview. This is what renders in a
      // message thread, so it carries most of the click-through weight.
      images: [{ url: `/l/${slug}/opengraph-image`, width: 1200, height: 630 }],
      type: 'article',
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function SharePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { r: referrer } = await searchParams;

  const viewer = await getViewer();
  const look = await getLookBySlug(slug, {
    viewerUserId: viewer.userId,
    viewerGuestId: viewer.guestId,
  });

  if (!look) notFound();

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/l/${slug}`;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[560px] px-4 pt-5 pb-24">
      <ViewPing slug={slug} source="share_link" referrerHandle={referrer ?? look.handle} />

      <header className="mb-5 flex items-center justify-between">
        <Link href="/" aria-label="Viola home">
          <Wordmark size={20} />
        </Link>
        <Link
          href="/new"
          className="rounded-full border border-[var(--color-hairline)] px-3.5 py-2 text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[rgba(124,92,252,0.4)] hover:text-white"
        >
          Make yours
        </Link>
      </header>

      {/* Referrer context. A shared link that says who sent it and why
          converts considerably better than a cold landing. */}
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-viola-soft)] text-[13px] font-semibold text-[var(--color-viola)]">
          {look.handle.slice(0, 1).toUpperCase()}
        </div>
        <p className="text-[14px] text-[var(--color-text-secondary)]">
          <Link href={`/@${look.handle}`} className="font-semibold text-white hover:underline">
            @{look.handle}
          </Link>{' '}
          wants you to rate this fit
        </p>
      </div>

      <LookCard look={look} priority />

      {look.caption && (
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          {look.caption}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <BloomButton
          slug={slug}
          initialCount={look.bloomCount}
          initialBloomed={look.bloomedByViewer}
          size="lg"
        />
        <span className="stat text-[13px] text-[var(--color-text-tertiary)]">
          {formatCount(look.viewCount)} views
        </span>
      </div>

      <ShareRow
        slug={slug}
        url={shareUrl}
        handle={look.handle}
        archetype={look.archetypeName}
        score={look.score}
      />

      {look.items.length > 0 && (
        <section className="mt-9">
          <h2 className="label-caps mb-4 text-[var(--color-text-tertiary)]">Shop the look</h2>
          <ul className="flex flex-col gap-2.5">
            {look.items.map((item) => (
              <ShopRow key={item.id} item={item} lookSlug={slug} />
            ))}
          </ul>
        </section>
      )}

      {/* The prompt comes after they have seen the value, not before it. */}
      <section className="surface mt-9 px-5 py-6 text-center">
        <p className="display text-[24px] text-white">Post your own fit</p>
        <p className="mx-auto mt-1.5 max-w-[300px] text-[14px] text-[var(--color-text-secondary)]">
          Viola names every piece, scores the look, and finds where to buy it.
        </p>
        <Link
          href="/new"
          className="mt-5 inline-block rounded-full bg-[var(--color-viola)] px-6 py-3 text-[14px] font-semibold text-white transition-transform active:scale-[0.97]"
        >
          Try it — it&rsquo;s free
        </Link>
      </section>
    </div>
  );
}

function ShopRow({
  item,
  lookSlug,
}: {
  item: Awaited<ReturnType<typeof getLookBySlug>> extends infer T
    ? T extends { items: Array<infer I> }
      ? I
      : never
    : never;
  lookSlug: string;
}) {
  const label = formatItemLabel(item);
  const shoppable = Boolean(item.merchantUrl);

  return (
    <li>
      <div className="flex items-center gap-3.5 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface)] p-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-white/[0.04]">
          {item.imagePath ? (
            <img
              src={mediaUrl(item.imagePath)}
              alt=""
              className="h-[78%] w-[78%] object-contain"
              loading="lazy"
            />
          ) : (
            <div className="h-3 w-3 rounded-full bg-white/15" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {label.brand && <p className="label-caps truncate text-white">{label.brand}</p>}
          <p className="label-caps-sub truncate">{label.name}</p>
          {item.source && (
            <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">at {item.source}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {item.priceCents != null && (
            <span className="stat text-[14px] text-white">
              {formatPrice(item.priceCents, item.currency)}
            </span>
          )}
          {shoppable ? (
            <a
              href={`/go/${item.id}?l=${lookSlug}`}
              target="_blank"
              rel="noopener noreferrer nofollow sponsored"
              className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[var(--color-ink)] transition-transform active:scale-[0.96]"
            >
              Shop
            </a>
          ) : (
            /* We would rather say nothing than send someone to the wrong
               product. An unresolved item still gets its label. */
            <span className="text-[12px] text-[var(--color-text-tertiary)]">Not found</span>
          )}
        </div>
      </div>
    </li>
  );
}
