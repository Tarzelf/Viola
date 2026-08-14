import { productCandidateSchema, type ProductCandidate } from '@viola/core';
import type { ProductSearchProvider, ProductSearchRequest } from '../types.js';

/**
 * SerpApi Google Shopping provider.
 *
 * Answers "where do I buy this". Returns the retailer, price, product link and
 * — most importantly for us — the clean catalogue thumbnail. That thumbnail is
 * what makes a look card resemble the reference: floated product cutouts on a
 * transparent background, not crops of a blurry mirror selfie.
 *
 * The thumbnail is hotlinked from Google's CDN, so the imagery stage re-hosts
 * it before anything renders. See `imagery.ts`.
 */

const ENDPOINT = 'https://serpapi.com/search.json';

interface SerpShoppingResult {
  title?: string;
  product_link?: string;
  link?: string;
  source?: string;
  price?: string;
  extracted_price?: number;
  thumbnail?: string;
  rating?: number;
  reviews?: number;
  second_hand_condition?: string;
  extensions?: string[];
}

export interface SerpApiOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Marketplace locale. */
  gl?: string;
  hl?: string;
}

export class SerpApiProductSearchProvider implements ProductSearchProvider {
  readonly name = 'serpapi';
  /** ~$0.005 per search on the entry tier. */
  readonly costCents = 0.5;

  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: SerpApiOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 20_000;
  }

  async search(request: ProductSearchRequest): Promise<ProductCandidate[]> {
    const params = new URLSearchParams({
      engine: 'google_shopping',
      q: request.query,
      api_key: this.options.apiKey,
      gl: this.options.gl ?? 'us',
      hl: this.options.hl ?? 'en',
      num: String(request.limit ?? 10),
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(`${ENDPOINT}?${params}`, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`serpapi ${response.status}: ${detail.slice(0, 200)}`);
    }

    const payload = (await response.json()) as { shopping_results?: SerpShoppingResult[] };
    const results = payload.shopping_results ?? [];

    return results.flatMap((r) => {
      const url = r.product_link ?? r.link;
      if (!url || !r.title || !r.source) return [];

      const secondHand =
        Boolean(r.second_hand_condition) ||
        (r.extensions ?? []).some((e) => /used|pre-?owned|refurb/i.test(e));

      const parsed = productCandidateSchema.safeParse({
        title: r.title,
        // Google Shopping does not return a structured brand field; the ranking
        // stage infers agreement from the title instead of us guessing here.
        brand: null,
        source: r.source,
        priceCents:
          typeof r.extracted_price === 'number' ? Math.round(r.extracted_price * 100) : null,
        currency: 'USD',
        merchantUrl: url,
        imageUrl: r.thumbnail ?? null,
        rating: typeof r.rating === 'number' ? r.rating : null,
        reviewCount: typeof r.reviews === 'number' ? r.reviews : null,
        isSecondhand: secondHand,
      });

      // Skip malformed rows rather than failing the whole resolution — one bad
      // listing should never cost the user their entire look.
      return parsed.success ? [parsed.data] : [];
    });
  }
}
