import 'server-only';
import {
  NoopAnalyticsClient,
  VIRAL_FUNNEL,
  type AnalyticsClient,
  type EventMap,
  type EventName,
} from '@viola/core';

/**
 * Server-side analytics.
 *
 * The event catalogue lives in `@viola/core` and is shared with the mobile app,
 * so both platforms emit identically-shaped events. This is the transport.
 *
 * With no PostHog key configured, events go to the log in development and are
 * dropped in production. That keeps the zero-key promise intact while still
 * making the funnel visible while you work.
 *
 * Nothing here is ever awaited by a request path. An analytics outage must not
 * slow down — let alone fail — a share, a bloom, or a checkout.
 */

class PostHogClient implements AnalyticsClient {
  constructor(
    private readonly key: string,
    private readonly host: string,
  ) {}

  private send(payload: Record<string, unknown>): void {
    void fetch(`${this.host}/i/v0/e/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: this.key, ...payload }),
      keepalive: true,
    }).catch(() => {
      // Deliberately swallowed. Losing an event is acceptable; making a user
      // wait on our telemetry is not.
    });
  }

  capture<E extends EventName>(event: E, props: EventMap[E]): void {
    const identity = props as { userId?: string; guestId?: string };
    this.send({
      event,
      // Guests are identified by device so their pre-signup journey stitches
      // to the account they eventually create.
      distinct_id: identity.userId ?? identity.guestId ?? 'anonymous',
      properties: { ...props, $lib: 'viola-web' },
      timestamp: new Date().toISOString(),
    });
  }

  identify(userId: string, traits: Record<string, unknown> = {}): void {
    this.send({
      event: '$identify',
      distinct_id: userId,
      properties: { $set: traits },
    });
  }

  alias(guestId: string, userId: string): void {
    this.send({
      event: '$create_alias',
      distinct_id: userId,
      properties: { alias: guestId },
    });
  }
}

/** Logs to the console. Used in development so the funnel is visible. */
class ConsoleAnalyticsClient implements AnalyticsClient {
  capture<E extends EventName>(event: E, props: EventMap[E]): void {
    const funnelStep = (VIRAL_FUNNEL as readonly string[]).includes(event);
    const marker = funnelStep ? '◆' : '·';
    const identity = props as { userId?: string; guestId?: string };
    console.info(
      `[viola] ${marker} ${event}`,
      JSON.stringify({ ...props, userId: identity.userId ? 'set' : undefined }),
    );
  }
  identify(): void {}
  alias(): void {}
}

const globalForAnalytics = globalThis as unknown as { violaAnalytics?: AnalyticsClient };

export function analytics(): AnalyticsClient {
  if (globalForAnalytics.violaAnalytics) return globalForAnalytics.violaAnalytics;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

  globalForAnalytics.violaAnalytics = key
    ? new PostHogClient(key, host)
    : process.env.NODE_ENV === 'production'
      ? new NoopAnalyticsClient()
      : new ConsoleAnalyticsClient();

  return globalForAnalytics.violaAnalytics;
}

/**
 * Emits a funnel event.
 *
 * A thin wrapper that exists purely so the six steps are grepable as a set and
 * cannot be emitted with the wrong shape. Growth loops die at whichever step
 * nobody is watching, so the whole point is that no step is optional.
 */
export function track<E extends EventName>(event: E, props: EventMap[E]): void {
  try {
    analytics().capture(event, props);
  } catch {
    // Never let instrumentation break a request.
  }
}

/** Overrides the client. Tests only. */
export function setAnalyticsClient(client: AnalyticsClient | undefined): void {
  globalForAnalytics.violaAnalytics = client;
}
