import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { schema } from '@viola/db';
import { db } from '@/lib/db';
import { upsertSubscription } from '@/lib/billing';

export const dynamic = 'force-dynamic';

/**
 * Whop webhook → subscriptions table.
 *
 * Configure in Whop dashboard to POST membership / payment events here.
 * We attribute Plus via metadata.userId when present, otherwise by email.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  const header =
    request.headers.get('webhook-secret') ??
    request.headers.get('x-whop-signature') ??
    request.headers.get('authorization');

  if (secret) {
    const ok =
      header === secret ||
      header === `Bearer ${secret}` ||
      (header?.startsWith('sha256=') && header.slice(7) === secret);
    if (!ok && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    }
  }

  let event: {
    action?: string;
    type?: string;
    data?: Record<string, unknown>;
  };
  try {
    event = JSON.parse(raw) as typeof event;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const action = event.action ?? event.type ?? '';
  const data = (event.data ?? event) as Record<string, unknown>;
  const membership = (data.membership ?? data) as Record<string, unknown>;
  const metadata = (membership.metadata ?? data.metadata ?? {}) as Record<string, string>;
  const userId = metadata.userId ?? metadata.user_id;
  const email =
    (membership.email as string | undefined) ??
    ((data.user as { email?: string } | undefined)?.email);

  const database = await db();
  let resolvedUserId = userId;

  if (!resolvedUserId && email) {
    const [user] = await database
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()))
      .limit(1);
    resolvedUserId = user?.id;
  }

  if (!resolvedUserId) {
    console.warn('[viola] whop webhook: no userId/email match', action);
    return NextResponse.json({ ok: true, matched: false });
  }

  const statusRaw = String(membership.status ?? data.status ?? action).toLowerCase();
  const active =
    statusRaw.includes('active') ||
    statusRaw.includes('valid') ||
    statusRaw.includes('completed') ||
    action.includes('membership.went_valid') ||
    action.includes('payment.succeeded') ||
    action.includes('membership_activated');

  const canceled =
    statusRaw.includes('cancel') ||
    statusRaw.includes('expired') ||
    action.includes('membership.went_invalid') ||
    action.includes('membership_deactivated');

  await upsertSubscription(database, {
    userId: resolvedUserId,
    platform: 'whop',
    status: canceled ? 'canceled' : active ? 'active' : statusRaw || 'unknown',
    plan: metadata.plan ?? null,
    externalCustomerId: (membership.user_id as string) ?? null,
    externalSubscriptionId: (membership.id as string) ?? (data.id as string) ?? null,
    currentPeriodEnd: membership.renewal_period_end
      ? new Date(String(membership.renewal_period_end))
      : null,
    cancelAtPeriodEnd: Boolean(membership.cancel_at_period_end),
    raw: event,
  });

  return NextResponse.json({ ok: true, matched: true });
}
