import { afterEach, describe, expect, it } from 'vitest';
import {
  NoopAnalyticsClient,
  VIRAL_FUNNEL,
  funnelConversions,
  kFactor,
  type ViralFunnelStep,
} from '@viola/core';
import { setAnalyticsClient, track } from './analytics';

afterEach(() => {
  setAnalyticsClient(undefined);
});

function capture() {
  const client = new NoopAnalyticsClient();
  setAnalyticsClient(client);
  return client;
}

describe('analytics transport', () => {
  it('captures an event', () => {
    const client = capture();
    track('bloom_given', { surface: 'web', lookId: 'l1', isGuest: true });
    expect(client.events).toHaveLength(1);
    expect(client.events[0]!.event).toBe('bloom_given');
  });

  it('never throws, whatever the client does', () => {
    // Instrumentation must not be able to break a request. A share that fails
    // because telemetry failed is an absurd way to lose a user.
    setAnalyticsClient({
      capture() {
        throw new Error('analytics vendor is down');
      },
      identify() {},
      alias() {},
    });

    expect(() =>
      track('bloom_given', { surface: 'web', lookId: 'l', isGuest: false }),
    ).not.toThrow();
  });
});

/**
 * The plan's acceptance criterion for this phase: every step of the viral
 * funnel must actually emit. Growth loops die at whichever step nobody is
 * watching, so a step that exists in the catalogue but is never fired is worse
 * than useless — it looks instrumented while being blind.
 *
 * These assert the emit sites exist in the code paths that own them, which is
 * the part that rots silently when a route is refactored.
 */
describe('viral funnel coverage', () => {
  const EMIT_SITES: Record<ViralFunnelStep, string> = {
    share_trigger_reached: 'src/components/share-row.tsx',
    share_opened: 'src/components/share-row.tsx',
    share_sent: 'src/app/api/looks/[slug]/share/route.ts',
    share_link_opened: 'src/app/api/looks/[slug]/view/route.ts',
    guest_activated: 'src/app/api/looks/[slug]/bloom/route.ts',
    referred_signup_completed: 'src/app/api/auth/verify/route.ts',
  };

  it('has an emit site for all six steps', async () => {
    const { readFileSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

    for (const step of VIRAL_FUNNEL) {
      const source = readFileSync(join(appRoot, EMIT_SITES[step]), 'utf8');
      expect(source, `${step} is never emitted from ${EMIT_SITES[step]}`).toContain(step);
    }
  });

  it('covers the funnel with no gaps', () => {
    expect(Object.keys(EMIT_SITES).sort()).toEqual([...VIRAL_FUNNEL].sort());
  });

  it('emits each step with the shape the catalogue declares', () => {
    const client = capture();

    track('share_trigger_reached', { surface: 'web', lookId: 'l1', guestId: 'g1' });
    track('share_opened', { surface: 'web', lookId: 'l1', entry: 'look_page', guestId: 'g1' });
    track('share_sent', { surface: 'web', lookId: 'l1', channel: 'messages', guestId: 'g1' });
    track('share_link_opened', { surface: 'web', lookId: 'l1', hasAccount: false, guestId: 'g2' });
    track('guest_activated', { surface: 'web', lookId: 'l1', action: 'bloom', guestId: 'g2' });
    track('referred_signup_completed', { surface: 'web', userId: 'u1', guestId: 'g2' });

    expect(client.events.map((e) => e.event)).toEqual([...VIRAL_FUNNEL]);
  });

  it('distinguishes opening a share sheet from completing one', () => {
    // The gap between these two is where most loops quietly die. Inferring one
    // from the other cannot tell a bad CTA from a bad sheet.
    const client = capture();
    track('share_opened', { surface: 'web', lookId: 'l1', entry: 'reveal', guestId: 'g' });

    const names = client.events.map((e) => e.event);
    expect(names).toContain('share_opened');
    expect(names).not.toContain('share_sent');
  });
});

describe('funnel maths', () => {
  it('computes step-to-step conversion', () => {
    const counts = {
      share_trigger_reached: 1000,
      share_opened: 380,
      share_sent: 290,
      share_link_opened: 200,
      guest_activated: 70,
      referred_signup_completed: 18,
    } satisfies Record<ViralFunnelStep, number>;

    const conversions = funnelConversions(counts);
    expect(conversions).toHaveLength(5);

    // Optimise the weakest link, not the average — these multiply.
    const weakest = conversions.reduce((a, b) => (a.rate < b.rate ? a : b));
    expect(weakest.from).toBe('guest_activated');
  });

  it('derives K from shares and conversion', () => {
    expect(kFactor(1.4, 0.25)).toBeCloseTo(0.35);
  });
});
