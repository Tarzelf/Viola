import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { isViolaError } from '@viola/core';
import { schema } from '@viola/db';
import { db } from '@/lib/db';
import { getViewer } from '@/lib/identity';
import { createCheckoutSession, isLiveWebBilling } from '@/lib/billing';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer.userId)
    return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });

  if (!isLiveWebBilling()) {
    return NextResponse.json(
      { error: { code: 'provider_failed', message: 'Checkout is not set up yet.' } },
      { status: 502 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { plan?: 'monthly' | 'annual' };
  const database = await db();

  const [user] = await database
    .select({ email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, viewer.userId))
    .limit(1);

  try {
    const { url } = await createCheckoutSession({
      userId: viewer.userId,
      email: user?.email ?? '',
      plan: body.plan === 'annual' ? 'annual' : 'monthly',
      origin: new URL(request.url).origin,
    });
    return NextResponse.json({ url });
  } catch (error) {
    if (isViolaError(error)) return NextResponse.json(error.toJSON(), { status: error.status });
    throw error;
  }
}
