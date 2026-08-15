import { Fragment } from 'react';
import Link from 'next/link';
import { getFeed, getSponsoredPlacements, type FeedTab } from '@/lib/queries';
import { db } from '@/lib/db';
import { showsSponsored } from '@/lib/entitlements';
import { SponsoredCard } from '@/components/sponsored-card';
import { getViewer } from '@/lib/identity';
import { FeedCard } from '@/components/look-card';
import { LookSlider } from '@/components/look-slider';
import { FoldTeaser } from '@/components/fold/fold-teaser';
import { AppShell } from '@/components/app-shell';

export const dynamic = 'force-dynamic';

const TABS: Array<{ id: FeedTab; label: string }> = [
  { id: 'for-you', label: 'For you' },
  { id: 'fresh', label: 'Fresh' },
  { id: 'top', label: 'Top of the week' },
];

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab = (TABS.find((t) => t.id === params.tab)?.id ?? 'for-you') as FeedTab;
  const viewer = await getViewer();

  const [looks, featured] = await Promise.all([
    getFeed({
      tab,
      viewerUserId: viewer.userId,
      viewerGuestId: viewer.guestId,
    }),
    // Featured runway only on For you — Top of the week already IS that list,
    // and Fresh should feel chronological, not curated.
    tab === 'for-you'
      ? getFeed({
          tab: 'top',
          limit: 8,
          viewerUserId: viewer.userId,
          viewerGuestId: viewer.guestId,
        })
      : Promise.resolve([]),
  ]);

  // Free accounts and signed-out visitors see sponsored placements; Plus does
  // not. The entitlement is applied at the query, not at the render site.
  const placements = await getSponsoredPlacements(await showsSponsored(await db(), viewer.userId));
  const every = placements[0]?.frequency ?? 7;

  return (
    <AppShell>
      <div className="no-scrollbar mb-6 flex items-center gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <Link
              key={t.id}
              href={t.id === 'for-you' ? '/' : `/?tab=${t.id}`}
              className={[
                'rounded-full px-4 py-2 text-[13px] font-medium whitespace-nowrap transition-colors',
                active
                  ? 'bg-white text-[var(--color-ink)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-white/5 hover:text-white',
              ].join(' ')}
            >
              {/* Gold is reserved for Top of the Week and nothing else. */}
              {t.id === 'top' && !active && (
                <span className="mr-1.5 text-[var(--color-gold)]">✦</span>
              )}
              {t.label}
            </Link>
          );
        })}
      </div>

      <FoldTeaser />

      {featured.length > 0 && <LookSlider looks={featured} title="This week" />}

      {looks.length === 0 ? (
        <EmptyFeed />
      ) : (
        <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {looks.map((look, index) => {
            // Slot a sponsored card in after every Nth organic look rather
            // than reserving a fixed position, so the feed keeps its rhythm.
            const slotIndex = Math.floor(index / every) - 1;
            const showAd = placements.length > 0 && index > 0 && index % every === 0;
            const placement = showAd ? placements[slotIndex % placements.length] : null;

            return (
              <Fragment key={look.id}>
                {placement && <SponsoredCard placement={placement} />}
                <FeedCard look={look} />
              </Fragment>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function EmptyFeed() {
  return (
    <div className="surface flex flex-col items-center justify-center px-6 py-20 text-center">
      <h2 className="display text-[26px] text-white">Nothing here yet</h2>
      <p className="mt-2 max-w-sm text-[14px] text-[var(--color-text-secondary)]">
        Post a fit and Viola will name every piece, score the look, and show you where to buy it.
      </p>
      <Link
        href="/new"
        className="mt-6 rounded-full bg-[var(--color-viola)] px-5 py-3 text-[14px] font-semibold text-white transition-transform active:scale-[0.97]"
      >
        Post your first look
      </Link>
    </div>
  );
}
