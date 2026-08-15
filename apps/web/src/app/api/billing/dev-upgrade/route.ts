import { NextResponse } from 'next/server';
import { isViolaError } from '@viola/core';
import { db } from '@/lib/db';
import { getViewer } from '@/lib/identity';
import { cancelDevelopmentPlus, grantDevelopmentPlus, isStripeConfigured } from '@/lib/billing';

export const runtime = 'nodejs';

/**
 * Grants or revokes Plus without payment.
 *
 * Exists so the paid tier is demoable on a fresh clone with no Stripe account.
 * Refuses outright once Stripe is configured or NODE_ENV is production —
 * guarded here AND inside grantDevelopmentPlus, because a dev backdoor that
 * survives into production is a catastrophe rather than an inconvenience.
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer.userId)
    return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });

  if (process.env.WHOP_API_KEY || isStripeConfigured() || process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: { code: 'forbidden' } }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { cancel?: boolean };

  try {
    if (body.cancel) {
      await cancelDevelopmentPlus(await db(), viewer.userId);
      return NextResponse.json({ tier: 'free' });
    }
    await grantDevelopmentPlus(await db(), viewer.userId);
    return NextResponse.json({ tier: 'plus' });
  } catch (error) {
    if (isViolaError(error)) return NextResponse.json(error.toJSON(), { status: error.status });
    throw error;
  }
}
