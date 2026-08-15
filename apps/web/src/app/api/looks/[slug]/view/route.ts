import { and, eq, gt, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { schema } from '@viola/db';
import { db } from '@/lib/db';
import { attachGuestCookie, getViewer, viewerHash } from '@/lib/identity';
import { track } from '@/lib/analytics';

export const runtime = 'nodejs';

/**
 * Records a view.
 *
 * The brief asked for view tracking explicitly, and views are safe to show
 * publicly precisely because they only ever go up — there is no way to read a
 * view count as a judgement.
 *
 * Deduped inside a rolling window rather than counting raw hits, so the number
 * a creator sees means something. The viewer key is an HMAC of their user or
 * guest id; raw IP addresses are never stored.
 */

const DEDUPE_WINDOW_MS = 6 * 60 * 60 * 1000;

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const viewer = await getViewer();
  const database = await db();

  const body = (await request.json().catch(() => ({}))) as {
    source?: string;
    referrerHandle?: string;
  };

  const [look] = await database
    .select({ id: schema.looks.id, userId: schema.looks.userId, status: schema.looks.status })
    .from(schema.looks)
    .where(eq(schema.looks.slug, slug))
    .limit(1);

  if (!look || look.status === 'quarantined') {
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  }

  // A creator refreshing their own look should not inflate their numbers.
  const isOwner = viewer.userId !== null && viewer.userId === look.userId;
  if (isOwner) {
    return attachGuestCookie(NextResponse.json({ counted: false, reason: 'owner' }), viewer);
  }

  const hash = viewerHash(viewer);
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS);

  const recent = await database
    .select({ id: schema.lookViews.id })
    .from(schema.lookViews)
    .where(
      and(
        eq(schema.lookViews.lookId, look.id),
        eq(schema.lookViews.viewerHash, hash),
        gt(schema.lookViews.createdAt, since),
      ),
    )
    .limit(1);

  if (recent.length > 0) {
    return attachGuestCookie(NextResponse.json({ counted: false, reason: 'deduped' }), viewer);
  }

  await database.insert(schema.lookViews).values({
    lookId: look.id,
    viewerHash: hash,
    source: body.source ?? 'feed',
    referrerHandle: body.referrerHandle ?? null,
  });

  await database
    .update(schema.looks)
    .set({ viewCount: sql`${schema.looks.viewCount} + 1` })
    .where(eq(schema.looks.id, look.id));

  const identity = viewer.userId ? { userId: viewer.userId } : { guestId: viewer.guestId };

  track('look_viewed', {
    surface: 'web',
    lookId: slug,
    isOwner: false,
    source: body.source ?? 'feed',
    ...identity,
  });

  // Step four: a recipient actually opened the link someone sent them.
  if (body.source === 'share_link') {
    track('share_link_opened', {
      surface: 'web',
      lookId: slug,
      hasAccount: viewer.isAuthenticated,
      ...(body.referrerHandle ? { referrerHandle: body.referrerHandle } : {}),
      ...identity,
    });
  }

  return attachGuestCookie(NextResponse.json({ counted: true }), viewer);
}
