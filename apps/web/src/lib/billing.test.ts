import { createHmac } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { schema, type DbHandle } from '@viola/db';
import { createTestDb, truncateAll } from '@viola/db/testing';
import { grantDevelopmentPlus, upsertSubscription, verifyStripeSignature } from './billing';
import { getTier } from './entitlements';

let handle: DbHandle;

beforeEach(async () => {
  handle ??= await createTestDb();
  await truncateAll(handle);
});

afterAll(async () => {
  await handle?.close();
});

const db = () => handle.db;

async function makeUser() {
  const [user] = await db()
    .insert(schema.users)
    .values({ email: `b${Math.random()}@x.com` })
    .returning();
  return user!.id;
}

const SECRET = 'whsec_test_secret';

function sign(payload: string, secret = SECRET, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

describe('stripe webhook signature', () => {
  const payload = JSON.stringify({ type: 'customer.subscription.created' });

  it('accepts a correctly signed payload', async () => {
    expect(await verifyStripeSignature(payload, sign(payload), SECRET)).toBe(true);
  });

  it('rejects a missing signature header', async () => {
    // An unverified webhook endpoint lets anyone on the internet grant
    // themselves a subscription.
    expect(await verifyStripeSignature(payload, null, SECRET)).toBe(false);
  });

  it('rejects a signature made with the wrong secret', async () => {
    const forged = sign(payload, 'whsec_attacker');
    expect(await verifyStripeSignature(payload, forged, SECRET)).toBe(false);
  });

  it('rejects a tampered payload', async () => {
    const header = sign(payload);
    const tampered = JSON.stringify({ type: 'customer.subscription.created', hacked: true });
    expect(await verifyStripeSignature(tampered, header, SECRET)).toBe(false);
  });

  it('rejects a replayed signature outside the tolerance window', async () => {
    const old = Math.floor(Date.now() / 1000) - 4000;
    expect(await verifyStripeSignature(payload, sign(payload, SECRET, old), SECRET)).toBe(false);
  });

  it('rejects a malformed header', async () => {
    expect(await verifyStripeSignature(payload, 'garbage', SECRET)).toBe(false);
    expect(await verifyStripeSignature(payload, 't=abc,v1=def', SECRET)).toBe(false);
  });
});

describe('subscription state', () => {
  it('grants Plus on an active subscription', async () => {
    const userId = await makeUser();
    await upsertSubscription(db(), {
      userId,
      platform: 'stripe',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
    });
    expect(await getTier(db(), userId)).toBe('plus');
  });

  it('keeps access while a payment is retrying', async () => {
    // Cutting someone off the instant a card retry fails turns a payment
    // hiccup into a cancellation.
    const userId = await makeUser();
    await upsertSubscription(db(), {
      userId,
      platform: 'stripe',
      status: 'past_due',
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
    });
    expect(await getTier(db(), userId)).toBe('plus');
  });

  it('revokes on cancellation', async () => {
    const userId = await makeUser();
    await upsertSubscription(db(), {
      userId,
      platform: 'stripe',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
    });
    await upsertSubscription(db(), { userId, platform: 'stripe', status: 'canceled' });
    expect(await getTier(db(), userId)).toBe('free');
  });

  it('updates in place rather than accumulating rows', async () => {
    const userId = await makeUser();
    for (const status of ['active', 'past_due', 'active']) {
      await upsertSubscription(db(), {
        userId,
        platform: 'stripe',
        status,
        currentPeriodEnd: new Date(Date.now() + 86_400_000),
      });
    }
    expect(await db().select().from(schema.subscriptions)).toHaveLength(1);
  });

  it('treats Apple and Stripe as separate records resolving to one entitlement', async () => {
    // Apple requires IAP for in-app digital features, so an account can
    // plausibly hold both. Either being active should entitle them.
    const userId = await makeUser();
    await upsertSubscription(db(), { userId, platform: 'stripe', status: 'canceled' });
    await upsertSubscription(db(), {
      userId,
      platform: 'apple',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
    });

    expect(await db().select().from(schema.subscriptions)).toHaveLength(2);
    expect(await getTier(db(), userId)).toBe('plus');
  });
});

describe('development upgrade', () => {
  it('grants Plus when no Stripe keys are present', async () => {
    const userId = await makeUser();
    await grantDevelopmentPlus(db(), userId);
    expect(await getTier(db(), userId)).toBe('plus');
  });

  it('refuses once live billing credentials are present', async () => {
    const userId = await makeUser();
    process.env.WHOP_API_KEY = 'whop_live_pretend';
    try {
      await expect(grantDevelopmentPlus(db(), userId)).rejects.toThrow();
    } finally {
      delete process.env.WHOP_API_KEY;
    }
  });
});
