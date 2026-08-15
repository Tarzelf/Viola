import 'server-only';
import { and, count, eq, sql } from 'drizzle-orm';
import {
  DEFAULT_VAULT_NAME,
  ViolaError,
  entitlementsFor,
  resolveTier,
  type Entitlements,
  type Tier,
} from '@viola/core';
import { schema, type Database } from '@viola/db';

/**
 * Entitlements and gating.
 *
 * The paywall sits on *accumulation* — vaults, saved items, weekly AI taggings
 * — and never on the social loop. Posting, blooming, viewing and sharing stay
 * free for everyone, because throttling those would throttle the growth engine
 * the whole product depends on.
 *
 * Gate checks live here rather than in route handlers so both platforms enforce
 * identical rules, and so there is one place to audit when pricing changes.
 */

export async function getTier(db: Database, userId: string): Promise<Tier> {
  const [subscription] = await db
    .select()
    .from(schema.subscriptions)
    .where(and(eq(schema.subscriptions.userId, userId), eq(schema.subscriptions.tier, 'plus')))
    .limit(1);

  if (!subscription) return 'free';

  return resolveTier({
    tier: subscription.tier as Tier,
    platform: subscription.platform as 'stripe' | 'apple' | 'whop',
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  });
}

export async function getEntitlements(db: Database, userId: string): Promise<Entitlements> {
  return entitlementsFor(await getTier(db, userId));
}

export interface VaultUsage {
  vaultCount: number;
  savedItemCount: number;
}

export async function getVaultUsage(db: Database, userId: string): Promise<VaultUsage> {
  const [vaultRow] = await db
    .select({ n: count() })
    .from(schema.vaults)
    .where(eq(schema.vaults.userId, userId));

  const [itemRow] = await db
    .select({ n: count() })
    .from(schema.vaultItems)
    .innerJoin(schema.vaults, eq(schema.vaults.id, schema.vaultItems.vaultId))
    .where(eq(schema.vaults.userId, userId));

  return { vaultCount: Number(vaultRow?.n ?? 0), savedItemCount: Number(itemRow?.n ?? 0) };
}

/**
 * Can this account create another vault?
 *
 * This is the brief's paid feature verbatim: "saving stuff in their own folders
 * should cost money". Free gets exactly one, called Saved.
 */
export async function assertCanCreateVault(db: Database, userId: string): Promise<void> {
  const entitlements = await getEntitlements(db, userId);
  const { vaultCount } = await getVaultUsage(db, userId);

  if (vaultCount >= entitlements.maxVaults) {
    throw new ViolaError('payment_required', 'vault limit reached', {
      publicMessage: `${DEFAULT_VAULT_NAME} is your free vault. Viola Plus unlocks as many as you like.`,
      details: { trigger: 'second_vault', vaultCount, limit: entitlements.maxVaults },
    });
  }
}

export async function assertCanSaveItem(db: Database, userId: string): Promise<void> {
  const entitlements = await getEntitlements(db, userId);
  const { savedItemCount } = await getVaultUsage(db, userId);

  if (savedItemCount >= entitlements.maxSavedItems) {
    throw new ViolaError('payment_required', 'saved item limit reached', {
      publicMessage: `You've saved ${entitlements.maxSavedItems} pieces. Viola Plus makes it unlimited.`,
      details: { trigger: 'vault_limit', savedItemCount, limit: entitlements.maxSavedItems },
    });
  }
}

// ---------------------------------------------------------------------------
// Weekly tagging quota — the cost control
// ---------------------------------------------------------------------------

/** ISO week key, e.g. 2026-W33. Bucketed rather than rolling so the reset is
 *  legible to a user: "you get five a week". */
export function isoWeek(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export interface QuotaState {
  used: number;
  limit: number;
  remaining: number;
  period: string;
}

export async function getQuota(db: Database, userId: string): Promise<QuotaState> {
  const entitlements = await getEntitlements(db, userId);
  const period = isoWeek();

  const [row] = await db
    .select({ looksTagged: schema.usageQuota.looksTagged })
    .from(schema.usageQuota)
    .where(and(eq(schema.usageQuota.userId, userId), eq(schema.usageQuota.period, period)))
    .limit(1);

  const used = row?.looksTagged ?? 0;
  const limit = entitlements.weeklyLookQuota;

  return {
    used,
    limit,
    remaining: Number.isFinite(limit) ? Math.max(0, limit - used) : Number.POSITIVE_INFINITY,
    period,
  };
}

/**
 * Each look costs roughly one vision call plus a few product searches. Without
 * a ceiling one enthusiastic user can run up real money, so the free tier is
 * capped and the cap is enforced before any paid API is touched.
 */
export async function assertWithinQuota(db: Database, userId: string): Promise<QuotaState> {
  const quota = await getQuota(db, userId);

  if (quota.remaining <= 0) {
    throw new ViolaError('quota_exceeded', 'weekly look quota exhausted', {
      publicMessage: `That's your ${quota.limit} looks for this week. Viola Plus removes the limit.`,
      details: { trigger: 'tagging_quota', ...quota },
    });
  }

  return quota;
}

export async function recordLookTagged(db: Database, userId: string): Promise<void> {
  const period = isoWeek();

  await db
    .insert(schema.usageQuota)
    .values({ userId, period, looksTagged: 1 })
    .onConflictDoUpdate({
      target: [schema.usageQuota.userId, schema.usageQuota.period],
      set: { looksTagged: sql`${schema.usageQuota.looksTagged} + 1`, updatedAt: new Date() },
    });
}

/** Whether to show sponsored placements. Free users see them; Plus does not. */
export async function showsSponsored(db: Database, userId: string | null): Promise<boolean> {
  if (!userId) return true;
  return (await getEntitlements(db, userId)).showsSponsored;
}
