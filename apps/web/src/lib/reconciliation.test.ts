import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MockTransactionSource, type AffiliateTransactionSource } from '@viola/pipeline';
import { schema, type DbHandle } from '@viola/db';
import { createTestDb, truncateAll } from '@viola/db/testing';
import { getEarnings, reconcile, topEarningLooks } from './reconciliation';

let handle: DbHandle;

beforeEach(async () => {
  handle ??= await createTestDb();
  await truncateAll(handle);
});

afterAll(async () => {
  await handle?.close();
});

const db = () => handle.db;

async function makeClick(trackingId: string, userId?: string) {
  const [user] = await db()
    .insert(schema.users)
    .values({ email: `c${Math.random()}@x.com` })
    .returning();
  await db()
    .insert(schema.profiles)
    .values({ userId: user!.id, handle: `h${Math.random().toString(36).slice(2, 10)}` });
  const [look] = await db()
    .insert(schema.looks)
    .values({
      userId: user!.id,
      slug: Math.random().toString(36).slice(2, 12).padEnd(10, 'a'),
      photoPath: 'p.jpg',
      status: 'ready',
    })
    .returning();

  await db()
    .insert(schema.affiliateClicks)
    .values({
      lookId: look!.id,
      userId: userId ?? user!.id,
      provider: 'noop',
      targetUrl: 'https://shop.example/p',
      merchantUrl: 'https://shop.example/p',
      trackingId,
    });

  return { userId: userId ?? user!.id, lookId: look!.id };
}

/** A source returning exactly what the test asks for. */
function fixedSource(rows: Parameters<typeof buildTxn>[0][]): AffiliateTransactionSource {
  return {
    name: 'fixture',
    fetchTransactions: async () => rows.map(buildTxn),
  };
}

function buildTxn(input: {
  id: string;
  trackingId: string | null;
  status: 'pending' | 'confirmed' | 'reversed';
  commissionCents: number;
}) {
  return {
    providerTransactionId: input.id,
    trackingId: input.trackingId,
    merchant: 'adidas',
    orderValueCents: input.commissionCents * 12,
    commissionCents: input.commissionCents,
    currency: 'USD',
    status: input.status,
    occurredAt: new Date(),
    raw: {},
  };
}

describe('reconciliation', () => {
  it('matches a transaction back to the click that produced it', async () => {
    // This is what turns "we made $340 last month" into "this look made $340".
    await makeClick('vc_abc');

    const result = await reconcile(
      db(),
      fixedSource([{ id: 't1', trackingId: 'vc_abc', status: 'confirmed', commissionCents: 800 }]),
    );

    expect(result).toMatchObject({ fetched: 1, matched: 1, unmatched: 0, inserted: 1 });

    const [row] = await db().select().from(schema.affiliateTransactions);
    expect(row!.clickId).not.toBeNull();
    expect(row!.commissionCents).toBe(800);
  });

  it('is idempotent — the job runs on overlapping windows', async () => {
    await makeClick('vc_dupe');
    const source = fixedSource([
      { id: 't1', trackingId: 'vc_dupe', status: 'pending', commissionCents: 500 },
    ]);

    await reconcile(db(), source);
    const second = await reconcile(db(), source);

    expect(second.inserted).toBe(0);
    expect(second.updated).toBe(0);
    expect(await db().select().from(schema.affiliateTransactions)).toHaveLength(1);
  });

  it('follows a status change — pending today, reversed after a return', async () => {
    // First write is not final. A transaction can sit pending for weeks and
    // then flip when the customer sends the item back.
    await makeClick('vc_return');

    await reconcile(
      db(),
      fixedSource([{ id: 't1', trackingId: 'vc_return', status: 'pending', commissionCents: 900 }]),
    );

    const result = await reconcile(
      db(),
      fixedSource([{ id: 't1', trackingId: 'vc_return', status: 'reversed', commissionCents: 0 }]),
    );

    expect(result.updated).toBe(1);
    const [row] = await db().select().from(schema.affiliateTransactions);
    expect(row!.status).toBe('reversed');
    expect(row!.commissionCents).toBe(0);
  });

  it('stores a transaction it cannot attribute rather than dropping it', async () => {
    // Losing a revenue record because we could not match it would be far worse
    // than keeping it with a null click.
    const result = await reconcile(
      db(),
      fixedSource([
        { id: 't1', trackingId: 'vc_unknown', status: 'confirmed', commissionCents: 400 },
      ]),
    );

    expect(result.unmatched).toBe(1);
    const [row] = await db().select().from(schema.affiliateTransactions);
    expect(row).toBeDefined();
    expect(row!.clickId).toBeNull();
    expect(row!.commissionCents).toBe(400);
  });

  it('handles a network that returns no tracking id at all', async () => {
    const result = await reconcile(
      db(),
      fixedSource([{ id: 't1', trackingId: null, status: 'pending', commissionCents: 100 }]),
    );
    expect(result.unmatched).toBe(1);
    expect(result.inserted).toBe(1);
  });

  it('never overwrites an existing match with a null', async () => {
    await makeClick('vc_keep');
    await reconcile(
      db(),
      fixedSource([{ id: 't1', trackingId: 'vc_keep', status: 'pending', commissionCents: 300 }]),
    );

    // The network restates the transaction without the tracking id.
    await reconcile(
      db(),
      fixedSource([{ id: 't1', trackingId: null, status: 'confirmed', commissionCents: 300 }]),
    );

    const [row] = await db().select().from(schema.affiliateTransactions);
    expect(row!.status).toBe('confirmed');
    expect(row!.clickId).not.toBeNull();
  });

  it('does nothing gracefully when the network reports no activity', async () => {
    const result = await reconcile(db(), fixedSource([]));
    expect(result).toMatchObject({ fetched: 0, matched: 0, inserted: 0 });
  });

  it('works against the mock source used when there is no live account', async () => {
    await makeClick('vc_m1');
    await makeClick('vc_m2');

    const result = await reconcile(db(), new MockTransactionSource(['vc_m1', 'vc_m2']));
    expect(result.fetched).toBe(2);
    expect(result.matched).toBe(2);
  });
});

describe('earnings', () => {
  async function seedRevenue() {
    const a = await makeClick('vc_1');
    await makeClick('vc_2');
    await makeClick('vc_3');

    await reconcile(
      db(),
      fixedSource([
        { id: 't1', trackingId: 'vc_1', status: 'confirmed', commissionCents: 1000 },
        { id: 't2', trackingId: 'vc_2', status: 'pending', commissionCents: 600 },
        { id: 't3', trackingId: 'vc_3', status: 'reversed', commissionCents: 250 },
      ]),
    );

    return a;
  }

  it('separates confirmed, pending and reversed', async () => {
    await seedRevenue();
    const earnings = await getEarnings(db());

    expect(earnings.confirmedCents).toBe(1000);
    expect(earnings.pendingCents).toBe(600);
    expect(earnings.reversedCents).toBe(250);
    expect(earnings.orderCount).toBe(3);
  });

  it('computes EPC from confirmed revenue only', async () => {
    // Counting pending commission as earnings is how you talk yourself into a
    // business that does not exist.
    await seedRevenue();
    const earnings = await getEarnings(db());

    expect(earnings.clickCount).toBe(3);
    expect(earnings.epcCents).toBe(Math.round((1000 / 3) * 100));
  });

  it('does not divide by zero with no clicks', async () => {
    const earnings = await getEarnings(db());
    expect(earnings.epcCents).toBe(0);
    expect(earnings.clickCount).toBe(0);
  });

  it('can scope to a single account', async () => {
    const first = await seedRevenue();
    const scoped = await getEarnings(db(), { userId: first.userId });
    expect(scoped.confirmedCents).toBe(1000);
    expect(scoped.orderCount).toBe(1);
  });

  it('ranks the looks that actually drive revenue', async () => {
    await seedRevenue();
    const top = await topEarningLooks(db(), 5);

    expect(top.length).toBeGreaterThan(0);
    expect(Number(top[0]!.commissionCents)).toBeGreaterThanOrEqual(
      Number(top[top.length - 1]!.commissionCents),
    );
  });
});
