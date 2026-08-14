import type { AffiliateProvider, AffiliateWrapRequest } from '../types.js';

/**
 * Affiliate link wrapping.
 *
 * Context from the brief: "we have to build a lot of integration for the
 * cookies and go actually apply for them — maybe find an individualized
 * solution that would include everything. It's okay for launch without it."
 *
 * Both halves of that are handled here.
 *
 * The "one solution" is **Sovrn //Commerce** (formerly VigLink): a single
 * account covering 50,000+ merchants with no per-merchant applications, and
 * crucially a *server-side* redirect API. That last part is the reason it beats
 * Skimlinks for us — Skimlinks monetises by rewriting links with JavaScript in
 * a page, which does nothing for a native iOS app or a server-rendered product
 * card.
 *
 * The "okay for launch without it" is `NoopAffiliateProvider`: links go direct
 * to the retailer, clicks are still recorded in our own tables, and nothing
 * about the product experience changes. Swapping to Sovrn later is one
 * environment variable.
 *
 * Every outbound tap routes through our own `/go/:id` redirector regardless of
 * provider, so we own the click analytics and attribution survives iOS
 * stripping client-side URL parameters.
 */

export class NoopAffiliateProvider implements AffiliateProvider {
  readonly name = 'noop';
  readonly costCents = 0;

  async wrap(request: AffiliateWrapRequest): Promise<string> {
    return request.merchantUrl;
  }
}

export interface SovrnOptions {
  apiKey: string;
  /**
   * If Sovrn cannot meet this bid floor the shopper is sent to the unwrapped
   * merchant URL instead. Optional.
   */
  bidFloor?: number;
}

export class SovrnAffiliateProvider implements AffiliateProvider {
  readonly name = 'sovrn';
  readonly costCents = 0;

  constructor(private readonly options: SovrnOptions) {}

  async wrap(request: AffiliateWrapRequest): Promise<string> {
    // Pure string construction — no network call on the hot path, so a shop tap
    // never waits on an API. This is the documented Redirect API shape.
    const params = new URLSearchParams({
      key: this.options.apiKey,
      u: request.merchantUrl,
      // Echoed back on the Transactions API so commission attributes to the
      // exact look and item that produced the sale.
      cuid: request.trackingId,
    });

    if (this.options.bidFloor !== undefined) {
      params.set('bf', String(this.options.bidFloor));
      params.set('fbu', request.merchantUrl);
    }

    return `https://sovrn.co?${params.toString()}`;
  }
}

/**
 * Wraps another provider and falls back to the bare merchant URL on any
 * failure. A shop button that 500s is far worse than one that simply doesn't
 * earn commission, so this is applied to every live provider.
 */
export class ResilientAffiliateProvider implements AffiliateProvider {
  readonly name: string;
  readonly costCents = 0;

  constructor(private readonly inner: AffiliateProvider) {
    this.name = inner.name;
  }

  async wrap(request: AffiliateWrapRequest): Promise<string> {
    try {
      const url = await this.inner.wrap(request);
      return url || request.merchantUrl;
    } catch {
      return request.merchantUrl;
    }
  }
}
