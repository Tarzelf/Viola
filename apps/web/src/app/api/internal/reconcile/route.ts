import { NextResponse } from 'next/server';
import { MockTransactionSource, resolveTransactionSource } from '@viola/pipeline';
import { schema } from '@viola/db';
import { desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { reconcile } from '@/lib/reconciliation';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * The reconciliation job.
 *
 * Meant to be hit by a scheduler — daily is plenty, since affiliate networks
 * report on their own cadence and payouts are net-90 anyway.
 *
 * Protected by a shared secret rather than a user session: a cron caller has no
 * account. Fails closed, so an unset secret means nobody can trigger it.
 */
export async function POST(request: Request) {
  const secret = process.env.VIOLA_CRON_SECRET;
  const provided = request.headers.get('authorization')?.replace(/^Bearer /, '');

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  }

  const database = await db();

  // With no live affiliate account, run against recent real clicks so the
  // matching path is exercised end to end rather than shipping untested.
  const live = resolveTransactionSource();
  let source = live;

  if (!source) {
    const recent = await database
      .select({ trackingId: schema.affiliateClicks.trackingId })
      .from(schema.affiliateClicks)
      .orderBy(desc(schema.affiliateClicks.clickedAt))
      .limit(25);
    source = new MockTransactionSource(recent.map((r) => r.trackingId));
  }

  const result = await reconcile(database, source);

  return NextResponse.json({
    provider: source.name,
    simulated: live === null,
    ...result,
  });
}
