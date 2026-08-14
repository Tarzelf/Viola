import 'server-only';
import { eq } from 'drizzle-orm';
import { PRICES, ViolaError } from '@viola/core';
import { schema, type Database } from '@viola/db';

/**
 * Billing.
 *
 * Web purchases go through Stripe. iOS purchases must go through StoreKit —
 * Apple requires in-app purchase for digital features consumed in the app, and
 * Viola Plus plainly is one. Both write to the same subscriptions table and
 * resolve through the same entitlement code, so the rest of the product never
 * has to care which platform paid.
 *
 * Affiliate commerce is unaffected by any of this: physical goods consumed
 * outside the app must NOT use IAP (guideline 3.1.3(e)), so outbound shop links
 * stay exactly as they are.
 *
 * Stripe is reached over plain fetch rather than the SDK. The two calls we need
 * are simple form posts, and it keeps a heavyweight dependency out of the
 * serverless bundle.
 */

const STRIPE_API = 'https://api.stripe.com/v1';

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export type PlanId = 'monthly' | 'annual';

function priceIdFor(plan: PlanId): string | undefined {
  return plan === 'annual'
    ? process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL
    : process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY;
}

async function stripe(path: string, body: Record<string, string>): Promise<unknown> {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  });

  if (!response.ok) {
    throw new ViolaError('provider_failed', `stripe ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

export async function createCheckoutSession(input: {
  userId: string;
  email: string;
  plan: PlanId;
  origin: string;
}): Promise<{ url: string }> {
  const price = priceIdFor(input.plan);
  if (!price) {
    throw new ViolaError('provider_failed', 'stripe price id not configured', {
      publicMessage: 'Checkout is not set up yet.',
    });
  }

  const session = (await stripe('/checkout/sessions', {
    mode: 'subscription',
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1',
    customer_email: input.email,
    // The user id rides along so the webhook can attribute the subscription
    // without trusting anything from the browser.
    'metadata[userId]': input.userId,
    'subscription_data[metadata][userId]': input.userId,
    success_url: `${input.origin}/plus?welcome=1`,
    cancel_url: `${input.origin}/plus`,
    allow_promotion_codes: 'true',
  })) as { url?: string };

  if (!session.url) throw new ViolaError('provider_failed', 'stripe returned no checkout url');
  return { url: session.url };
}

export interface SubscriptionUpdate {
  userId: string;
  platform: 'stripe' | 'apple';
  status: string;
  plan?: string | null;
  externalCustomerId?: string | null;
  externalSubscriptionId?: string | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  raw?: unknown;
}

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

/**
 * Applies a subscription change from either platform.
 *
 * `past_due` still counts as entitled: cutting someone off the instant a card
 * retry fails is a good way to turn a payment hiccup into a cancellation.
 */
export async function upsertSubscription(db: Database, update: SubscriptionUpdate): Promise<void> {
  const tier = ACTIVE_STATUSES.has(update.status) ? 'plus' : 'free';

  await db
    .insert(schema.subscriptions)
    .values({
      userId: update.userId,
      platform: update.platform,
      tier,
      status: update.status,
      plan: update.plan ?? null,
      externalCustomerId: update.externalCustomerId ?? null,
      externalSubscriptionId: update.externalSubscriptionId ?? null,
      currentPeriodEnd: update.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: update.cancelAtPeriodEnd ?? false,
      raw: update.raw ?? null,
    })
    .onConflictDoUpdate({
      target: [schema.subscriptions.userId, schema.subscriptions.platform],
      set: {
        tier,
        status: update.status,
        plan: update.plan ?? null,
        externalCustomerId: update.externalCustomerId ?? null,
        externalSubscriptionId: update.externalSubscriptionId ?? null,
        currentPeriodEnd: update.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: update.cancelAtPeriodEnd ?? false,
        raw: update.raw ?? null,
        updatedAt: new Date(),
      },
    });
}

/**
 * Verifies a Stripe webhook signature.
 *
 * Implemented directly rather than via the SDK so the webhook route stays
 * dependency-free. Constant-time comparison and a timestamp tolerance, because
 * a webhook that merely *looks* verified is worse than none at all.
 */
export async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!header) return false;

  const parts = Object.fromEntries(
    header.split(',').map((part) => {
      const [k, ...rest] = part.split('=');
      return [k?.trim() ?? '', rest.join('=')];
    }),
  ) as { t?: string; v1?: string };

  if (!parts.t || !parts.v1) return false;

  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;

  const { createHmac, timingSafeEqual } = await import('node:crypto');
  const expected = createHmac('sha256', secret).update(`${parts.t}.${payload}`).digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Grants Plus without payment.
 *
 * Only available when Stripe is not configured, so the paid tier can be
 * exercised end to end on a fresh clone. Guarded twice — here and at the route
 * — because a dev backdoor that survives into production is a catastrophe.
 */
export async function grantDevelopmentPlus(db: Database, userId: string): Promise<void> {
  if (isStripeConfigured() || process.env.NODE_ENV === 'production') {
    throw new ViolaError('forbidden', 'development upgrade is disabled');
  }

  await upsertSubscription(db, {
    userId,
    platform: 'stripe',
    status: 'active',
    plan: 'monthly',
    currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
    externalSubscriptionId: `dev_${userId.slice(0, 8)}`,
  });
}

export async function cancelDevelopmentPlus(db: Database, userId: string): Promise<void> {
  await db
    .update(schema.subscriptions)
    .set({ tier: 'free', status: 'canceled', currentPeriodEnd: new Date(), updatedAt: new Date() })
    .where(eq(schema.subscriptions.userId, userId));
}

export { PRICES };
