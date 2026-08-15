import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { upsertSubscription, verifyStripeSignature } from '@/lib/billing';

export const runtime = 'nodejs';

/**
 * Stripe webhook.
 *
 * The signature is verified before the body is trusted for anything. An
 * unverified webhook endpoint is a way for anyone on the internet to grant
 * themselves a subscription.
 *
 * Note for anyone porting this to Supabase Edge Functions later: those need
 * verify_jwt = false in the function's own config.toml, in the
 * [function-name] form rather than [functions.function-name]. As a Next route
 * handler none of that applies — the signature check is the whole gate.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 503 });

  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!(await verifyStripeSignature(payload, signature, secret))) {
    return NextResponse.json({ error: 'bad signature' }, { status: 400 });
  }

  const event = JSON.parse(payload) as {
    type: string;
    data: { object: Record<string, unknown> };
  };

  const object = event.data.object;
  const userId =
    (object.metadata as Record<string, string> | undefined)?.userId ??
    (object.subscription_details as { metadata?: Record<string, string> } | undefined)?.metadata
      ?.userId ??
    null;

  if (!userId) {
    // Nothing to attribute this to. Acknowledge so Stripe stops retrying.
    return NextResponse.json({ received: true, ignored: 'no userId in metadata' });
  }

  const database = await db();

  switch (event.type) {
    case 'checkout.session.completed':
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const periodEnd = object.current_period_end as number | undefined;
      await upsertSubscription(database, {
        userId,
        platform: 'stripe',
        status:
          event.type === 'customer.subscription.deleted'
            ? 'canceled'
            : ((object.status as string) ?? 'active'),
        externalCustomerId: (object.customer as string) ?? null,
        externalSubscriptionId: (object.subscription as string) ?? (object.id as string) ?? null,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        cancelAtPeriodEnd: Boolean(object.cancel_at_period_end),
        raw: object,
      });
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
