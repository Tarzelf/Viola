import 'server-only';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { schema, type Database } from '@viola/db';
import type { AffiliateTransaction, AffiliateTransactionSource } from '@viola/pipeline';

/**
 * Matching revenue back to looks.
 *
 * Every outbound tap is recorded with a tracking id we minted and handed to the
 * affiliate network. Days or weeks later the network reports a commission
 * carrying that same id, and this joins the two — which is what turns "we made
 * $340 last month" into "this look made $340, and these three items drove it".
 *
 * Three properties matter here more than throughput:
 *
 *  - **Idempotent.** The job runs on a schedule over overlapping windows, so
 *    the same transaction will be seen many times.
 *  - **Mutable status.** A transaction sits pending for weeks and can later
 *    flip to reversed on a return. First write is not final.
 *  - **Never destructive.** An unmatched transaction is stored anyway. Losing
 *    a revenue record because we could not attribute it would be far worse
 *    than storing it with a null click.
 */

export interface ReconcileResult {
  fetched: number;
  matched: number;
  unmatched: number;
  updated: number;
  inserted: number;
}

export async function reconcile(
  db: Database,
  source: AffiliateTransactionSource,
  options: { since?: Date } = {},
): Promise<ReconcileResult> {
  // Default window overlaps deliberately: a transaction can appear late or be
  // restated, and re-seeing one is free because ingestion is idempotent.
  const since = options.since ?? new Date(Date.now() - 30 * 86_400_000);
  const transactions = await source.fetchTransactions({ since });

  const result: ReconcileResult = {
    fetched: transactions.length,
    matched: 0,
    unmatched: 0,
    updated: 0,
    inserted: 0,
  };

  if (transactions.length === 0) return result;

  const trackingIds = transactions
    .map((t) => t.trackingId)
    .filter((id): id is string => Boolean(id));

  const clicks =
    trackingIds.length > 0
      ? await db
          .select({ id: schema.affiliateClicks.id, trackingId: schema.affiliateClicks.trackingId })
          .from(schema.affiliateClicks)
          .where(inArray(schema.affiliateClicks.trackingId, trackingIds))
      : [];

  const clickByTracking = new Map(clicks.map((c) => [c.trackingId, c.id]));

  for (const transaction of transactions) {
    const clickId = transaction.trackingId
      ? (clickByTracking.get(transaction.trackingId) ?? null)
      : null;

    if (clickId) result.matched++;
    else result.unmatched++;

    const written = await upsertTransaction(db, source.name, transaction, clickId);
    if (written === 'inserted') result.inserted++;
    else if (written === 'updated') result.updated++;
  }

  return result;
}

async function upsertTransaction(
  db: Database,
  provider: string,
  transaction: AffiliateTransaction,
  clickId: string | null,
): Promise<'inserted' | 'updated' | 'unchanged'> {
  const [existing] = await db
    .select({
      id: schema.affiliateTransactions.id,
      status: schema.affiliateTransactions.status,
      commissionCents: schema.affiliateTransactions.commissionCents,
    })
    .from(schema.affiliateTransactions)
    .where(
      and(
        eq(schema.affiliateTransactions.provider, provider),
        eq(schema.affiliateTransactions.providerTransactionId, transaction.providerTransactionId),
      ),
    )
    .limit(1);

  if (!existing) {
    await db.insert(schema.affiliateTransactions).values({
      provider,
      providerTransactionId: transaction.providerTransactionId,
      clickId,
      merchant: transaction.merchant,
      orderValueCents: transaction.orderValueCents,
      commissionCents: transaction.commissionCents,
      currency: transaction.currency,
      status: transaction.status,
      occurredAt: transaction.occurredAt,
      raw: transaction.raw ?? null,
    });
    return 'inserted';
  }

  const changed =
    existing.status !== transaction.status ||
    existing.commissionCents !== transaction.commissionCents;

  if (!changed) return 'unchanged';

  await db
    .update(schema.affiliateTransactions)
    .set({
      status: transaction.status,
      commissionCents: transaction.commissionCents,
      orderValueCents: transaction.orderValueCents,
      // A late match is still worth recording, but never overwrite a match we
      // already have with a null.
      ...(clickId ? { clickId } : {}),
      raw: transaction.raw ?? null,
    })
    .where(eq(schema.affiliateTransactions.id, existing.id));

  return 'updated';
}

// ---------------------------------------------------------------------------
// Earnings
// ---------------------------------------------------------------------------

export interface EarningsSummary {
  confirmedCents: number;
  pendingCents: number;
  reversedCents: number;
  orderCount: number;
  clickCount: number;
  /** Confirmed commission per hundred clicks. The number that matters. */
  epcCents: number;
}

export async function getEarnings(
  db: Database,
  options: { userId?: string; since?: Date } = {},
): Promise<EarningsSummary> {
  const since = options.since ?? new Date(Date.now() - 90 * 86_400_000);

  const rows = await db
    .select({
      status: schema.affiliateTransactions.status,
      commissionCents: schema.affiliateTransactions.commissionCents,
      clickUserId: schema.affiliateClicks.userId,
    })
    .from(schema.affiliateTransactions)
    .leftJoin(
      schema.affiliateClicks,
      eq(schema.affiliateClicks.id, schema.affiliateTransactions.clickId),
    )
    .where(gte(schema.affiliateTransactions.createdAt, since));

  const relevant = options.userId ? rows.filter((r) => r.clickUserId === options.userId) : rows;

  const summary: EarningsSummary = {
    confirmedCents: 0,
    pendingCents: 0,
    reversedCents: 0,
    orderCount: relevant.length,
    clickCount: 0,
    epcCents: 0,
  };

  for (const row of relevant) {
    const cents = row.commissionCents ?? 0;
    if (row.status === 'confirmed') summary.confirmedCents += cents;
    else if (row.status === 'reversed') summary.reversedCents += cents;
    else summary.pendingCents += cents;
  }

  const [clicks] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.affiliateClicks)
    .where(
      options.userId
        ? and(
            gte(schema.affiliateClicks.clickedAt, since),
            eq(schema.affiliateClicks.userId, options.userId),
          )
        : gte(schema.affiliateClicks.clickedAt, since),
    );

  summary.clickCount = Number(clicks?.n ?? 0);
  summary.epcCents =
    summary.clickCount > 0 ? Math.round((summary.confirmedCents / summary.clickCount) * 100) : 0;

  return summary;
}

/** Which looks actually drive revenue. */
export async function topEarningLooks(
  db: Database,
  options: { limit?: number; userId?: string } = {},
) {
  const limit = options.limit ?? 10;
  const rows = await db
    .select({
      lookId: schema.affiliateClicks.lookId,
      slug: schema.looks.slug,
      handle: schema.profiles.handle,
      photoPath: schema.looks.photoPath,
      lookUserId: schema.looks.userId,
      clicks: sql<number>`count(distinct ${schema.affiliateClicks.id})::int`,
      commissionCents: sql<number>`coalesce(sum(${schema.affiliateTransactions.commissionCents}), 0)::int`,
    })
    .from(schema.affiliateClicks)
    .leftJoin(
      schema.affiliateTransactions,
      eq(schema.affiliateTransactions.clickId, schema.affiliateClicks.id),
    )
    .leftJoin(schema.looks, eq(schema.looks.id, schema.affiliateClicks.lookId))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.looks.userId))
    .groupBy(
      schema.affiliateClicks.lookId,
      schema.looks.slug,
      schema.profiles.handle,
      schema.looks.photoPath,
      schema.looks.userId,
    )
    .orderBy(desc(sql`coalesce(sum(${schema.affiliateTransactions.commissionCents}), 0)`))
    .limit(options.userId ? limit * 4 : limit);

  const filtered = options.userId
    ? rows.filter((r) => r.lookUserId === options.userId).slice(0, limit)
    : rows;

  return filtered.map(({ lookUserId: _uid, ...rest }) => rest);
}
