import { describe, expect, it } from 'vitest';
import {
  NoopAnalyticsClient,
  VIRAL_FUNNEL,
  funnelConversions,
  kFactor,
  K_FACTOR_TARGET,
  type ViralFunnelStep,
} from './analytics';
import { ViolaError, isViolaError, notFound } from './errors';
import {
  FREE,
  PLUS,
  PRICES,
  entitlementsFor,
  formatPrice,
  resolveTier,
  type SubscriptionState,
} from './plans';
import { SLUG_LENGTH, generateSlug, isValidSlug, suggestHandle } from './slug';
import { bboxSchema, createLookSchema, handleSchema, visionItemSchema } from './schemas';

describe('slugs', () => {
  it('generates valid slugs of the expected length', () => {
    for (let i = 0; i < 200; i++) {
      const s = generateSlug();
      expect(s).toHaveLength(SLUG_LENGTH);
      expect(isValidSlug(s)).toBe(true);
    }
  });

  it('excludes glyphs that are ambiguous when read aloud or retyped', () => {
    // These links get pasted into group chats and read out. i/l/o/u/0/1 are out.
    const alphabet = new Set<string>();
    for (let i = 0; i < 500; i++) for (const ch of generateSlug()) alphabet.add(ch);
    for (const bad of ['i', 'l', 'o', 'u', '0', '1']) {
      expect(alphabet.has(bad)).toBe(false);
    }
  });

  it('is deterministic given a seeded source', () => {
    const seeded = () => 0.5;
    expect(generateSlug(seeded)).toBe(generateSlug(seeded));
  });

  it('rejects malformed slugs', () => {
    expect(isValidSlug('')).toBe(false);
    expect(isValidSlug('short')).toBe(false);
    expect(isValidSlug('AAAAAAAAAA')).toBe(false);
    expect(isValidSlug('abcdefghi0')).toBe(false);
  });

  it('suggests usable handles from display names', () => {
    expect(suggestHandle('Maya Rodríguez')).toBe('maya_rodriguez');
    expect(suggestHandle('  ✨ zoë ✨ ')).toBe('zoe');
    expect(suggestHandle('!')).toBe('viola_user');
    expect(handleSchema.safeParse(suggestHandle('Maya Rodríguez')).success).toBe(true);
  });
});

describe('plans and entitlements', () => {
  it('gates accumulation, never the social loop', () => {
    // Posting, blooming and sharing must stay free — they are the growth engine.
    expect(FREE.maxVaults).toBe(1);
    expect(FREE.maxSavedItems).toBe(20);
    expect(FREE.showsSponsored).toBe(true);
    expect(PLUS.showsSponsored).toBe(false);
    expect(PLUS.maxVaults).toBe(Number.POSITIVE_INFINITY);
  });

  it('resolves the tier from subscription state', () => {
    expect(resolveTier(null)).toBe('free');
    const active: SubscriptionState = {
      tier: 'plus',
      platform: 'stripe',
      currentPeriodEnd: new Date('2030-01-01'),
      cancelAtPeriodEnd: false,
    };
    expect(resolveTier(active)).toBe('plus');
  });

  it('honours the paid period even after cancellation', () => {
    const cancelled: SubscriptionState = {
      tier: 'plus',
      platform: 'apple',
      currentPeriodEnd: new Date('2030-01-01'),
      cancelAtPeriodEnd: true,
    };
    expect(resolveTier(cancelled, new Date('2029-06-01'))).toBe('plus');
  });

  it('drops to free once the period has lapsed', () => {
    const lapsed: SubscriptionState = {
      tier: 'plus',
      platform: 'stripe',
      currentPeriodEnd: new Date('2020-01-01'),
      cancelAtPeriodEnd: true,
    };
    expect(resolveTier(lapsed, new Date('2026-01-01'))).toBe('free');
  });

  it('formats prices without trailing zeroes on round amounts', () => {
    expect(formatPrice(699)).toBe('$6.99');
    expect(formatPrice(3999)).toBe('$39.99');
    expect(formatPrice(0)).toBe('$0');
  });

  it('offers a meaningfully cheaper annual plan', () => {
    const monthly = PRICES.find((p) => p.id === 'monthly')!;
    const annual = PRICES.find((p) => p.id === 'annual')!;
    expect(annual.perMonthCents).toBeLessThan(monthly.perMonthCents);
    expect(annual.savingsPercent).toBeGreaterThan(40);
  });

  it('maps tiers to entitlements', () => {
    expect(entitlementsFor('free')).toEqual(FREE);
    expect(entitlementsFor('plus')).toEqual(PLUS);
  });
});

describe('analytics catalogue', () => {
  it('defines the six-step viral funnel in order', () => {
    expect(VIRAL_FUNNEL).toEqual([
      'share_trigger_reached',
      'share_opened',
      'share_sent',
      'share_link_opened',
      'guest_activated',
      'referred_signup_completed',
    ]);
  });

  it('computes step-to-step conversion', () => {
    const counts: Record<ViralFunnelStep, number> = {
      share_trigger_reached: 1000,
      share_opened: 400,
      share_sent: 300,
      share_link_opened: 210,
      guest_activated: 84,
      referred_signup_completed: 21,
    };
    const conv = funnelConversions(counts);
    expect(conv).toHaveLength(5);
    expect(conv[0]!.rate).toBeCloseTo(0.4);
    expect(conv[1]!.rate).toBeCloseTo(0.75);
  });

  it('does not divide by zero on an empty funnel', () => {
    const empty = Object.fromEntries(VIRAL_FUNNEL.map((s) => [s, 0])) as Record<
      ViralFunnelStep,
      number
    >;
    for (const step of funnelConversions(empty)) {
      expect(step.rate).toBe(0);
    }
  });

  it('computes K and knows the launch target', () => {
    expect(kFactor(2, 0.25)).toBeCloseTo(0.5);
    expect(K_FACTOR_TARGET).toBe(0.35);
  });

  it('records events through the noop client for assertions in tests', () => {
    const client = new NoopAnalyticsClient();
    client.capture('bloom_given', { surface: 'web', lookId: 'l1', isGuest: true });
    expect(client.events).toHaveLength(1);
    expect(client.events[0]!.event).toBe('bloom_given');
  });
});

describe('errors', () => {
  it('maps codes to status and safe public copy', () => {
    const e = notFound('look 123 missing');
    expect(e.status).toBe(404);
    expect(e.publicMessage).toBe("We couldn't find that.");
    expect(e.message).toBe('look 123 missing');
  });

  it('never leaks the internal message into the public payload', () => {
    const e = new ViolaError('internal', 'postgres connection string invalid');
    expect(JSON.stringify(e.toJSON())).not.toContain('postgres');
  });

  it('is detectable across module boundaries', () => {
    expect(isViolaError(notFound())).toBe(true);
    expect(isViolaError(new Error('nope'))).toBe(false);
  });

  it('uses 402 for the paywall and 429 for quota', () => {
    expect(new ViolaError('payment_required', '').status).toBe(402);
    expect(new ViolaError('quota_exceeded', '').status).toBe(429);
  });
});

describe('schemas', () => {
  it('accepts a well-formed bbox', () => {
    expect(bboxSchema.safeParse([0.1, 0.2, 0.5, 0.9]).success).toBe(true);
  });

  it('rejects inverted or degenerate boxes', () => {
    expect(bboxSchema.safeParse([0.5, 0.2, 0.1, 0.9]).success).toBe(false);
    expect(bboxSchema.safeParse([0.3, 0.3, 0.3, 0.3]).success).toBe(false);
  });

  it('rejects boxes outside normalised space', () => {
    expect(bboxSchema.safeParse([0, 0, 1.2, 1]).success).toBe(false);
    expect(bboxSchema.safeParse([-0.1, 0, 1, 1]).success).toBe(false);
  });

  it('allows a null brand — a guess is worse than an absence', () => {
    const item = {
      category: 'footwear',
      subtype: 'running shoe',
      brand: null,
      colors: ['blue'],
      pattern: 'solid',
      material: 'mesh',
      styleTags: ['athletic'],
      description: 'A cushioned blue running shoe.',
      searchQuery: 'blue mesh running shoe',
      bbox: [0.3, 0.8, 0.5, 0.95],
      confidence: 0.72,
      isPrimary: true,
    };
    expect(visionItemSchema.safeParse(item).success).toBe(true);
  });

  it('defaults look visibility to public', () => {
    const parsed = createLookSchema.parse({ photoPath: 'uploads/a.jpg' });
    expect(parsed.visibility).toBe('public');
  });

  it('enforces handle format', () => {
    expect(handleSchema.safeParse('maya_r').success).toBe(true);
    expect(handleSchema.safeParse('Maya').success).toBe(false);
    expect(handleSchema.safeParse('a').success).toBe(false);
    expect(handleSchema.safeParse('has spaces').success).toBe(false);
  });
});
