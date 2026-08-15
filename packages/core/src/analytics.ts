/**
 * The typed analytics catalogue.
 *
 * Growth research is blunt about this: you cannot improve a loop you have not
 * instrumented, and the loop dies at whichever step you are not watching. Most
 * teams discover far too late that their share rate among activated users is
 * 4%. So the funnel is defined here, in types, before any UI exists — and every
 * step of it is mandatory rather than best-effort.
 *
 * Event names are `noun_verb_past_tense`, lower snake case, and never renamed
 * once shipped (renaming breaks every historical funnel).
 */

// ---------------------------------------------------------------------------
// The viral funnel — the six steps that decide whether this app grows
// ---------------------------------------------------------------------------

export const VIRAL_FUNNEL = [
  /** The reveal finished — the user is now looking at something shareable. */
  'share_trigger_reached',
  /** They opened the share sheet. If this is low, the CTA is wrong. */
  'share_opened',
  /** A share actually left the device. If this is low, the sheet is wrong. */
  'share_sent',
  /** A recipient opened the link. If this is low, the preview is wrong. */
  'share_link_opened',
  /** The recipient did something — bloomed, saved, scrolled deep. */
  'guest_activated',
  /** The recipient became a user. */
  'referred_signup_completed',
] as const;

export type ViralFunnelStep = (typeof VIRAL_FUNNEL)[number];

// ---------------------------------------------------------------------------
// Event payloads
// ---------------------------------------------------------------------------

interface BaseProps {
  /** Set for logged-in actors; absent for guests. */
  userId?: string;
  /** Stable per-device id, so guest journeys can be stitched to a later signup. */
  guestId?: string;
  surface: 'web' | 'ios';
}

export interface EventMap {
  // --- the Voilà ---
  look_upload_started: BaseProps & { source: 'camera' | 'library' | 'drop' };
  look_upload_completed: BaseProps & { lookId: string; bytes: number; ms: number };
  look_pipeline_stage_completed: BaseProps & {
    lookId: string;
    stage: string;
    ms: number;
    ok: boolean;
  };
  look_reveal_played: BaseProps & { lookId: string; itemCount: number; ms: number };
  look_published: BaseProps & {
    lookId: string;
    itemCount: number;
    score: number;
    archetype: string;
    visibility: string;
  };
  look_item_corrected: BaseProps & { lookId: string; itemIndex: number; field: string };

  // --- the funnel ---
  share_trigger_reached: BaseProps & { lookId: string };
  share_opened: BaseProps & { lookId: string; entry: 'reveal' | 'look_page' | 'profile' };
  share_sent: BaseProps & { lookId: string; channel: ShareChannel };
  share_link_opened: BaseProps & { lookId: string; referrerHandle?: string; hasAccount: boolean };
  guest_activated: BaseProps & { lookId: string; action: 'bloom' | 'save_intent' | 'deep_scroll' };
  referred_signup_completed: BaseProps & { lookId?: string; referrerUserId?: string };

  // --- validation loop ---
  bloom_given: BaseProps & { lookId: string; isGuest: boolean };
  look_viewed: BaseProps & { lookId: string; isOwner: boolean; source: string };

  // --- commerce ---
  shop_tapped: BaseProps & {
    lookId: string;
    lookItemId: string;
    brand?: string;
    retailer?: string;
    priceCents?: number;
    affiliateProvider: string;
  };
  vault_save_attempted: BaseProps & { lookId?: string; productId?: string; gated: boolean };
  vault_created: BaseProps & { vaultId: string };

  // --- monetization ---
  paywall_shown: BaseProps & { trigger: PaywallTrigger };
  checkout_started: BaseProps & { plan: 'monthly' | 'annual'; platform: 'stripe' | 'apple' };
  subscription_activated: BaseProps & { plan: 'monthly' | 'annual'; platform: 'stripe' | 'apple' };

  // --- safety ---
  content_reported: BaseProps & { targetType: string; reason: string };
  user_blocked: BaseProps & { targetUserId: string };
  upload_quarantined: BaseProps & { lookId: string; reasons: string[] };
}

export type EventName = keyof EventMap;

export const SHARE_CHANNELS = [
  /** The dedicated one-tap button. iOS share sheets are high friction, so
   *  Messages gets its own path rather than hiding behind the generic sheet. */
  'messages',
  'system_sheet',
  'copy_link',
  'instagram_story',
  'download_card',
] as const;

export type ShareChannel = (typeof SHARE_CHANNELS)[number];

export const PAYWALL_TRIGGERS = [
  'vault_limit',
  'second_vault',
  'tagging_quota',
  'private_look',
  'remove_sponsored',
] as const;

export type PaywallTrigger = (typeof PAYWALL_TRIGGERS)[number];

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export interface AnalyticsClient {
  capture<E extends EventName>(event: E, props: EventMap[E]): void;
  identify(userId: string, traits?: Record<string, unknown>): void;
  /** Stitches a guest's pre-signup activity onto their new account. */
  alias(guestId: string, userId: string): void;
}

/** Used in tests and whenever no key is configured. */
export class NoopAnalyticsClient implements AnalyticsClient {
  public readonly events: Array<{ event: EventName; props: unknown }> = [];

  capture<E extends EventName>(event: E, props: EventMap[E]): void {
    this.events.push({ event, props });
  }
  identify(): void {}
  alias(): void {}
}

/**
 * Conversion between consecutive funnel steps. Optimise the weakest link —
 * a 10% improvement at the worst step beats a 10% improvement at the average
 * one, because these multiply.
 */
export function funnelConversions(counts: Record<ViralFunnelStep, number>): Array<{
  from: ViralFunnelStep;
  to: ViralFunnelStep;
  rate: number;
}> {
  const out: Array<{ from: ViralFunnelStep; to: ViralFunnelStep; rate: number }> = [];
  for (let i = 0; i < VIRAL_FUNNEL.length - 1; i++) {
    const from = VIRAL_FUNNEL[i]!;
    const to = VIRAL_FUNNEL[i + 1]!;
    const denominator = counts[from];
    out.push({ from, to, rate: denominator > 0 ? counts[to] / denominator : 0 });
  }
  return out;
}

/**
 * K = shares per activated user × conversion per share.
 *
 * Benchmarks for consumer apps: 0.15 is the floor worth measuring, 0.25 is
 * acceptable, 0.4 is good, 0.7 is excellent. Sustained K above 1.0 essentially
 * does not happen. Launch target is 0.35.
 */
export function kFactor(sharesPerUser: number, conversionPerShare: number): number {
  return sharesPerUser * conversionPerShare;
}

export const K_FACTOR_TARGET = 0.35;
