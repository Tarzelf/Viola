import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { FeedCard } from '@/components/look-card';
import { BlockToggle } from '@/components/block-toggle';
import { getViewer } from '@/lib/identity';
import { getProfile, getProfileLooks } from '@/lib/queries';
import { formatCount } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * A profile.
 *
 * Note what is deliberately absent: there is no follower count on the header.
 * It is stored, and it is used for ranking, but showing it turns every profile
 * into a scoreboard — which is precisely the comparison dynamic the ICP
 * research warns about. Blooms received and looks posted are shown instead,
 * because both only ever go up.
 *
 * Routed from /[handle] so URLs read viola.app/@maya, matching the watermark
 * printed on every share card.
 */

function normalise(raw: string): string | null {
  const decoded = decodeURIComponent(raw);
  return decoded.startsWith('@') ? decoded.slice(1) : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const handle = normalise((await params).handle);
  if (!handle) return {};
  return { title: `@${handle}` };
}

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const handle = normalise((await params).handle);
  // Anything not prefixed with @ is not a profile, so let it 404 normally.
  if (!handle) notFound();

  const profile = await getProfile(handle);
  if (!profile) notFound();

  const viewer = await getViewer();
  const looks = await getProfileLooks(handle, {
    viewerUserId: viewer.userId,
    viewerGuestId: viewer.guestId,
  });

  const isSelf = viewer.userId === profile.userId;

  return (
    <AppShell>
      <header className="mb-8 flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--color-viola-soft)] text-[22px] font-semibold text-[var(--color-viola-text)]">
          {handle.slice(0, 1).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="display text-[28px] leading-tight text-white">
            {profile.displayName ?? `@${handle}`}
          </h1>
          <p className="text-[14px] text-[var(--color-text-secondary)]">@{handle}</p>
          {profile.bio && (
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
              {profile.bio}
            </p>
          )}

          {/* Only monotonically positive counters are public. */}
          <div className="mt-3 flex items-center gap-4">
            <span className="stat text-[13px] text-[var(--color-text-tertiary)]">
              {formatCount(looks.length)} looks
            </span>
            <span className="stat text-[13px] text-[var(--color-text-tertiary)]">
              {formatCount(profile.totalBloomsReceived)} blooms
            </span>
          </div>
        </div>

        {!isSelf && viewer.isAuthenticated && <BlockToggle handle={handle} />}
      </header>

      {looks.length === 0 ? (
        <div className="surface px-6 py-16 text-center">
          <h2 className="display text-[22px] text-white">No looks yet</h2>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {looks.map((look) => (
            <FeedCard key={look.id} look={look} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
