/**
 * Plans and entitlements.
 *
 * The free/paid line follows the brief directly: saving into your own folders
 * is the paid feature, and free users see clean sponsored placements instead.
 *
 * Everything social stays free — posting, blooming, sharing, being seen. Gating
 * any of that would throttle the viral loop, which is the growth engine. We
 * only ever charge for *accumulation* (vaults, unlimited tagging) and for
 * *removing* the sponsored unit.
 */

export type Tier = 'free' | 'plus';

export interface Entitlements {
  tier: Tier;
  /** Named vaults a user may own. Free gets one, called "Saved". */
  maxVaults: number;
  /** Total items saveable across all vaults. */
  maxSavedItems: number;
  /** AI look-taggings per week. The main cost control. */
  weeklyLookQuota: number;
  showsSponsored: boolean;
  canCreatePrivateLooks: boolean;
  canCustomiseShareCard: boolean;
  seesFullScoreBreakdown: boolean;
}

export const FREE: Entitlements = {
  tier: 'free',
  maxVaults: 1,
  maxSavedItems: 20,
  weeklyLookQuota: 5,
  showsSponsored: true,
  canCreatePrivateLooks: false,
  canCustomiseShareCard: false,
  seesFullScoreBreakdown: false,
};

export const PLUS: Entitlements = {
  tier: 'plus',
  maxVaults: Number.POSITIVE_INFINITY,
  maxSavedItems: Number.POSITIVE_INFINITY,
  weeklyLookQuota: Number.POSITIVE_INFINITY,
  showsSponsored: false,
  canCreatePrivateLooks: true,
  canCustomiseShareCard: true,
  seesFullScoreBreakdown: true,
};

export function entitlementsFor(tier: Tier): Entitlements {
  return tier === 'plus' ? PLUS : FREE;
}

export const DEFAULT_VAULT_NAME = 'Saved';

export interface PlanPrice {
  id: 'monthly' | 'annual';
  label: string;
  cents: number;
  /** Shown as the per-month equivalent on the annual option. */
  perMonthCents: number;
  savingsPercent: number;
}

export const PRICES: readonly PlanPrice[] = [
  { id: 'monthly', label: 'Monthly', cents: 699, perMonthCents: 699, savingsPercent: 0 },
  { id: 'annual', label: 'Yearly', cents: 3999, perMonthCents: 333, savingsPercent: 52 },
] as const;

export function formatPrice(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/**
 * Where a subscription came from. Apple requires in-app digital features to be
 * sold through StoreKit, so iOS purchases are IAP and web purchases are Stripe;
 * both resolve to the same entitlement.
 */
export type SubscriptionPlatform = 'stripe' | 'apple';

export interface SubscriptionState {
  tier: Tier;
  platform: SubscriptionPlatform | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export function resolveTier(state: SubscriptionState | null, now = new Date()): Tier {
  if (!state || state.tier !== 'plus') return 'free';
  // Access runs to the end of the paid period even after cancellation.
  if (state.currentPeriodEnd && state.currentPeriodEnd < now) return 'free';
  return 'plus';
}
