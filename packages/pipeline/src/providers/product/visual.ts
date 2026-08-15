import { productCandidateSchema, type ProductCandidate } from '@viola/core';

/**
 * Visual product search — "where do I buy this" when nobody can name it.
 *
 * Text search only works when the vision stage saw a logo. That covers a
 * minority of real outfits: most clothing is unbranded in the photo, and
 * searching "white crop top" returns a thousand generic results that are not
 * the garment in the picture.
 *
 * Visual search answers a different question — "find things that look like
 * THIS" — and it is the only way to handle the unbranded majority, plus the
 * only way to surface look-alikes and cheaper dupes.
 *
 * The two are complementary and the pipeline uses both:
 *
 *   brand visible  -> text search for the exact product, visual for dupes
 *   no brand       -> visual search for everything
 *
 * Note what this unlocks. The garment cutouts from the segmentation work are
 * close to the ideal query image: one item, isolated, no background, no other
 * clothing in frame. Feeding the whole photo to a reverse image search returns
 * "woman standing in front of a green wall"; feeding a clean cutout of the
 * trousers returns trousers.
 */

export interface VisualSearchRequest {
  /** A publicly reachable image URL. */
  imageUrl?: string;
  /** Raw bytes, uploaded directly. Preferred — our cutouts are local. */
  image?: Buffer;
  /** Narrows results, e.g. "striped wide leg trousers". */
  hint?: string;
  limit?: number;
}

export interface VisualSearchResult {
  /** Listings the provider believes are the SAME item. */
  exact: ProductCandidate[];
  /** Visually similar items — look-alikes and dupes. */
  similar: ProductCandidate[];
}

export interface VisualSearchProvider {
  readonly name: string;
  readonly costCents: number;
  search(request: VisualSearchRequest): Promise<VisualSearchResult>;
}

// ---------------------------------------------------------------------------
// SerpApi Google Lens
// ---------------------------------------------------------------------------

interface LensMatch {
  title?: string;
  link?: string;
  source?: string;
  thumbnail?: string;
  rating?: number;
  reviews?: number;
  in_stock?: boolean;
  condition?: string;
  price?: string | { value?: string; extracted_value?: number; currency?: string };
  extracted_price?: number;
}

const SERPAPI = 'https://serpapi.com';

export interface SerpApiLensOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  country?: string;
}

export class SerpApiLensProvider implements VisualSearchProvider {
  readonly name = 'serpapi-lens';
  /** Same per-search cost as the text engine on the same account. */
  readonly costCents = 0.5;

  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: SerpApiLensOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 25_000;
  }

  /**
   * Uploads bytes and returns the id Lens accepts.
   *
   * Without this a cutout would have to be published to a public URL before it
   * could be searched, which means a round trip through our own storage and a
   * publicly readable copy of a crop of someone's photo. Direct upload avoids
   * both.
   */
  private async uploadImage(image: Buffer): Promise<string> {
    const form = new FormData();
    form.append('api_key', this.options.apiKey);
    form.append('file', new Blob([new Uint8Array(image)], { type: 'image/png' }), 'garment.png');

    const response = await this.fetchImpl(`${SERPAPI}/image_upload`, {
      method: 'POST',
      body: form,
    });

    if (!response.ok) {
      throw new Error(`serpapi image upload ${response.status}: ${await response.text()}`);
    }

    const payload = (await response.json()) as { image_id?: string };
    if (!payload.image_id) throw new Error('serpapi image upload returned no image_id');
    return payload.image_id;
  }

  async search(request: VisualSearchRequest): Promise<VisualSearchResult> {
    if (!request.imageUrl && !request.image) {
      throw new Error('visual search needs an image or an image URL');
    }

    const params = new URLSearchParams({
      engine: 'google_lens',
      api_key: this.options.apiKey,
      country: this.options.country ?? 'us',
      // `all` returns exact matches and visual matches in one call rather than
      // billing us twice for the two halves of the same question.
      type: 'all',
    });

    if (request.image) {
      params.set('image_id', await this.uploadImage(request.image));
    } else {
      params.set('url', request.imageUrl!);
    }

    if (request.hint) params.set('q', request.hint);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(`${SERPAPI}/search.json?${params}`, {
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new Error(`serpapi lens ${response.status}: ${(await response.text()).slice(0, 200)}`);
    }

    const payload = (await response.json()) as {
      exact_matches?: LensMatch[];
      visual_matches?: LensMatch[];
    };

    const limit = request.limit ?? 8;

    return {
      exact: (payload.exact_matches ?? []).flatMap(toCandidate).slice(0, limit),
      similar: (payload.visual_matches ?? []).flatMap(toCandidate).slice(0, limit),
    };
  }
}

/** Lens reports price in two shapes depending on the section. */
function priceCents(match: LensMatch): number | null {
  if (typeof match.extracted_price === 'number') return Math.round(match.extracted_price * 100);
  if (
    match.price &&
    typeof match.price === 'object' &&
    typeof match.price.extracted_value === 'number'
  ) {
    return Math.round(match.price.extracted_value * 100);
  }
  if (typeof match.price === 'string') {
    const parsed = Number.parseFloat(match.price.replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
  }
  return null;
}

function toCandidate(match: LensMatch): ProductCandidate[] {
  if (!match.link || !match.title || !match.source) return [];

  const secondhand =
    /used|pre-?owned|refurb/i.test(match.condition ?? '') ||
    /depop|poshmark|thredup|vinted|ebay|grailed|vestiaire/i.test(match.source);

  const parsed = productCandidateSchema.safeParse({
    title: match.title,
    // Lens returns a merchant, not a structured brand. Ranking infers brand
    // agreement from the title rather than us inventing one here.
    brand: null,
    source: match.source,
    priceCents: priceCents(match),
    currency:
      match.price && typeof match.price === 'object' ? (match.price.currency ?? 'USD') : 'USD',
    merchantUrl: match.link,
    imageUrl: match.thumbnail ?? null,
    rating: typeof match.rating === 'number' ? match.rating : null,
    reviewCount: typeof match.reviews === 'number' ? match.reviews : null,
    isSecondhand: secondhand,
  });

  // Drop a malformed row rather than failing the whole lookup.
  return parsed.success ? [parsed.data] : [];
}

// ---------------------------------------------------------------------------
// Mock
// ---------------------------------------------------------------------------

/**
 * Deterministic visual results.
 *
 * Keyed off the hint so the same garment always returns the same look-alikes,
 * which keeps the offline demo and any golden tests stable.
 */
export class MockVisualSearchProvider implements VisualSearchProvider {
  readonly name = 'mock';
  readonly costCents = 0;

  public readonly calls: string[] = [];

  async search(request: VisualSearchRequest): Promise<VisualSearchResult> {
    this.calls.push(request.hint ?? 'image');

    const seed = (request.hint ?? 'garment').length;
    const make = (
      title: string,
      source: string,
      price: number,
      secondhand = false,
    ): ProductCandidate =>
      productCandidateSchema.parse({
        title,
        brand: null,
        source,
        priceCents: price,
        currency: 'USD',
        merchantUrl: `https://${source.toLowerCase().replace(/[^a-z]/g, '')}.example/p/${seed}`,
        imageUrl: `https://cdn.viola-fixtures.test/lens-${seed}.png`,
        rating: 4.2,
        reviewCount: 180,
        isSecondhand: secondhand,
      });

    const label = request.hint ?? 'item';

    return {
      exact: [make(`${label} — original`, 'Aritzia', 12800)],
      similar: [
        make(`${label} look-alike`, 'Zara', 4990),
        make(`${label} similar fit`, 'H&M', 3499),
        make(`${label}, pre-loved`, 'Depop', 2400, true),
        make(`${label} dupe`, 'Uniqlo', 2990),
      ],
    };
  }
}

export function resolveVisualSearch(env: NodeJS.ProcessEnv = process.env): VisualSearchProvider {
  const mode = (env.VIOLA_PRODUCT_PROVIDER ?? env.VIOLA_PROVIDERS ?? 'mock').toLowerCase();
  if (mode === 'live' && env.SERPAPI_API_KEY) {
    return new SerpApiLensProvider({ apiKey: env.SERPAPI_API_KEY });
  }
  return new MockVisualSearchProvider();
}
