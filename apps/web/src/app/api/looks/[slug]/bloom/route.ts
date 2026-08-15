import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { schema } from '@viola/db';
import { db } from '@/lib/db';
import { attachGuestCookie, getViewer } from '@/lib/identity';
import { track } from '@/lib/analytics';

export const runtime = 'nodejs';

/**
 * Give a look a Bloom.
 *
 * Deliberately available to signed-out visitors. A share recipient must be able
 * to react without an account — every step between landing and acting costs a
 * large share of conversions, and an auth wall is the most expensive one. Guest
 * blooms are attributed to a signed device id and claimed onto a real account
 * later if the visitor signs up.
 *
 * There is no unbloom and no downvote. Both would introduce the negative public
 * signal this product is specifically designed to avoid.
 */
export async function POST(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const viewer = await getViewer();
  const database = await db();

  const [look] = await database
    .select({ id: schema.looks.id, status: schema.looks.status, userId: schema.looks.userId })
    .from(schema.looks)
    .where(eq(schema.looks.slug, slug))
    .limit(1);

  if (!look || look.status === 'quarantined') {
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  }

  // Unique indexes cover one-per-account and one-per-device; onConflictDoNothing
  // makes a repeat tap a no-op rather than an error the client has to interpret.
  const inserted = await database
    .insert(schema.blooms)
    .values(
      viewer.userId
        ? { lookId: look.id, userId: viewer.userId }
        : { lookId: look.id, guestId: viewer.guestId },
    )
    .onConflictDoNothing()
    .returning();

  if (inserted.length > 0) {
    await database
      .update(schema.looks)
      .set({ bloomCount: sql`${schema.looks.bloomCount} + 1` })
      .where(eq(schema.looks.id, look.id));

    await database
      .update(schema.profiles)
      .set({ totalBloomsReceived: sql`${schema.profiles.totalBloomsReceived} + 1` })
      .where(eq(schema.profiles.userId, look.userId));
  }

  if (inserted.length > 0) {
    track('bloom_given', {
      surface: 'web',
      lookId: slug,
      isGuest: !viewer.isAuthenticated,
      ...(viewer.userId ? { userId: viewer.userId } : { guestId: viewer.guestId }),
    });

    // A guest reacting to a shared look is step five of the funnel — the
    // moment a recipient stops being a passive viewer.
    if (!viewer.isAuthenticated) {
      track('guest_activated', {
        surface: 'web',
        lookId: slug,
        action: 'bloom',
        guestId: viewer.guestId,
      });
    }
  }

  const [current] = await database
    .select({ bloomCount: schema.looks.bloomCount })
    .from(schema.looks)
    .where(eq(schema.looks.id, look.id))
    .limit(1);

  const response = NextResponse.json({
    bloomCount: current?.bloomCount ?? 0,
    bloomed: true,
    isGuest: !viewer.isAuthenticated,
  });

  return attachGuestCookie(response, viewer);
}

/** Whether the current viewer has already bloomed this look. */
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const viewer = await getViewer();
  const database = await db();

  const [look] = await database
    .select({ id: schema.looks.id, bloomCount: schema.looks.bloomCount })
    .from(schema.looks)
    .where(eq(schema.looks.slug, slug))
    .limit(1);

  if (!look) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });

  const predicate = viewer.userId
    ? eq(schema.blooms.userId, viewer.userId)
    : eq(schema.blooms.guestId, viewer.guestId);

  const existing = await database
    .select({ id: schema.blooms.id })
    .from(schema.blooms)
    .where(and(eq(schema.blooms.lookId, look.id), predicate))
    .limit(1);

  return NextResponse.json({ bloomCount: look.bloomCount, bloomed: existing.length > 0 });
}
