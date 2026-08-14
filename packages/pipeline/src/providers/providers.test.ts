import { describe, expect, it, vi } from 'vitest';
import { visionResultSchema } from '@viola/core';
import {
  GeminiVisionProvider,
  MemoryStorageProvider,
  MockProductSearchProvider,
  MockVisionProvider,
  NoopAffiliateProvider,
  ResilientAffiliateProvider,
  SerpApiProductSearchProvider,
  SovrnAffiliateProvider,
  describeProviders,
  mockProviders,
  resolveProviders,
} from './index';

describe('provider resolution', () => {
  it('defaults to mocks with a completely empty environment', () => {
    // The zero-key default is the whole reason this app is verifiable offline.
    const providers = resolveProviders({ env: {} });
    expect(providers.vision.name).toBe('mock');
    expect(providers.products.name).toBe('mock');
    expect(providers.affiliate.name).toBe('noop');
    expect(providers.storage.name).toBe('local');
  });

  it('goes live per provider when the key is present', () => {
    const providers = resolveProviders({
      env: {
        VIOLA_VISION_PROVIDER: 'live',
        GEMINI_API_KEY: 'test-key',
        SERPAPI_API_KEY: 'also-set-but-not-requested',
      },
    });
    expect(providers.vision.name).toBe('gemini');
    // Product search was not switched to live, so it stays mocked.
    expect(providers.products.name).toBe('mock');
  });

  it('honours the global switch', () => {
    const providers = resolveProviders({
      env: {
        VIOLA_PROVIDERS: 'live',
        GEMINI_API_KEY: 'k',
        SERPAPI_API_KEY: 'k',
        SOVRN_API_KEY: 'k',
      },
    });
    expect(providers.vision.name).toBe('gemini');
    expect(providers.products.name).toBe('serpapi');
    expect(providers.affiliate.name).toBe('sovrn');
  });

  it('falls back to mock rather than crashing when a key is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const providers = resolveProviders({ env: { VIOLA_PROVIDERS: 'live' } });
    expect(providers.vision.name).toBe('mock');
    expect(providers.products.name).toBe('mock');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('summarises the active configuration', () => {
    expect(describeProviders(mockProviders())).toContain('vision=mock');
  });
});

describe('mock vision provider', () => {
  it('returns a schema-valid analysis', async () => {
    const provider = new MockVisionProvider();
    const result = await provider.analyse({ image: Buffer.from('photo'), mimeType: 'image/jpeg' });
    expect(visionResultSchema.safeParse(result).success).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('is deterministic for the same image', async () => {
    const provider = new MockVisionProvider();
    const image = Buffer.from('a stable photo');
    const a = await provider.analyse({ image, mimeType: 'image/jpeg' });
    const b = await provider.analyse({ image, mimeType: 'image/jpeg' });
    expect(a).toEqual(b);
  });

  it('varies across different images', async () => {
    const provider = new MockVisionProvider();
    const results = await Promise.all(
      ['one', 'two', 'three', 'four', 'five', 'six'].map((s) =>
        provider.analyse({ image: Buffer.from(s), mimeType: 'image/jpeg' }),
      ),
    );
    const distinct = new Set(results.map((r) => JSON.stringify(r.styleTags)));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('includes an item with a null brand', async () => {
    // The fixtures must contain the awkward case, or nothing downstream is ever
    // tested against a garment we could not identify.
    const provider = new MockVisionProvider({ fixtureIndex: 0 });
    const result = await provider.analyse({ image: Buffer.from('x'), mimeType: 'image/jpeg' });
    expect(result.items.some((i) => i.brand === null)).toBe(true);
  });

  it('can simulate the safety filter firing', async () => {
    const provider = new MockVisionProvider({ forceFlagged: true });
    const result = await provider.analyse({ image: Buffer.from('x'), mimeType: 'image/jpeg' });
    expect(result.safety.flagged).toBe(true);
    expect(result.items).toHaveLength(0);
  });
});

describe('mock product search', () => {
  it('finds the expected product for a branded query', async () => {
    const provider = new MockProductSearchProvider();
    const results = await provider.search({ query: 'hoka skyward x blue' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.title.includes('Skyward'))).toBe(true);
  });

  it('returns messy real-world result sets, not a curated happy path', async () => {
    const results = await new MockProductSearchProvider().search({
      query: 'hoka skyward x blue running shoe',
    });
    // A wrong-brand listing and a resale listing should both be present, so
    // ranking is exercised against what it will really see.
    expect(results.some((r) => r.brand === 'Brooks')).toBe(true);
    expect(results.some((r) => r.isSecondhand)).toBe(true);
  });

  it('records calls so cache behaviour can be asserted', async () => {
    const provider = new MockProductSearchProvider();
    await provider.search({ query: 'a' });
    await provider.search({ query: 'b' });
    expect(provider.calls).toEqual(['a', 'b']);
  });

  it('can simulate finding nothing', async () => {
    const provider = new MockProductSearchProvider({ returnEmpty: true });
    expect(await provider.search({ query: 'anything' })).toEqual([]);
  });
});

describe('affiliate providers', () => {
  it('noop returns the merchant URL untouched', async () => {
    const url = 'https://www.hoka.com/skyward-x';
    expect(await new NoopAffiliateProvider().wrap({ merchantUrl: url, trackingId: 't1' })).toBe(
      url,
    );
  });

  it('sovrn builds a server-side redirect with our tracking id', async () => {
    // Server-side wrapping is the reason Sovrn was chosen over Skimlinks:
    // JavaScript link rewriting cannot work in a native app.
    const provider = new SovrnAffiliateProvider({ apiKey: 'secret' });
    const wrapped = await provider.wrap({
      merchantUrl: 'https://www.hoka.com/skyward-x?size=9',
      trackingId: 'click_123',
    });
    const parsed = new URL(wrapped);
    expect(parsed.origin).toBe('https://sovrn.co');
    expect(parsed.searchParams.get('key')).toBe('secret');
    expect(parsed.searchParams.get('u')).toBe('https://www.hoka.com/skyward-x?size=9');
    expect(parsed.searchParams.get('cuid')).toBe('click_123');
  });

  it('sovrn adds a fallback URL when a bid floor is set', async () => {
    const provider = new SovrnAffiliateProvider({ apiKey: 'k', bidFloor: 0.1 });
    const url = new URL(await provider.wrap({ merchantUrl: 'https://x.com/p', trackingId: 't' }));
    expect(url.searchParams.get('bf')).toBe('0.1');
    expect(url.searchParams.get('fbu')).toBe('https://x.com/p');
  });

  it('falls back to the bare merchant URL if wrapping throws', async () => {
    // A shop button that errors is far worse than one that earns no commission.
    const broken = {
      name: 'broken',
      costCents: 0,
      wrap: async () => {
        throw new Error('network down');
      },
    };
    const provider = new ResilientAffiliateProvider(broken);
    expect(await provider.wrap({ merchantUrl: 'https://x.com/p', trackingId: 't' })).toBe(
      'https://x.com/p',
    );
  });

  it('falls back when the inner provider returns an empty string', async () => {
    const empty = { name: 'empty', costCents: 0, wrap: async () => '' };
    const provider = new ResilientAffiliateProvider(empty);
    expect(await provider.wrap({ merchantUrl: 'https://x.com/p', trackingId: 't' })).toBe(
      'https://x.com/p',
    );
  });
});

describe('storage', () => {
  it('round-trips a file in memory', async () => {
    const storage = new MemoryStorageProvider();
    await storage.put('looks/a.png', Buffer.from('data'), 'image/png');
    expect((await storage.get('looks/a.png'))?.toString()).toBe('data');
    expect(await storage.exists('looks/a.png')).toBe(true);
    await storage.remove('looks/a.png');
    expect(await storage.exists('looks/a.png')).toBe(false);
  });

  it('returns null for a missing file rather than throwing', async () => {
    expect(await new MemoryStorageProvider().get('nope.png')).toBeNull();
  });
});

describe('live providers (contract, mocked transport)', () => {
  it('gemini posts a structured-output request and validates the response', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    items: [
                      {
                        category: 'footwear',
                        subtype: 'sneaker',
                        brand: 'HOKA',
                        colors: ['blue'],
                        pattern: 'solid',
                        material: 'mesh',
                        styleTags: ['athletic'],
                        description: 'A blue running shoe.',
                        searchQuery: 'hoka skyward x blue',
                        bbox: [0.3, 0.8, 0.5, 0.95],
                        confidence: 0.9,
                        isPrimary: true,
                      },
                    ],
                    styleTags: ['athletic'],
                    score: { fit: 80, colorStory: 70, texture: 60, statement: 65, cohesion: 85 },
                    captionSuggestions: ['nice'],
                    safety: { flagged: false, reasons: [] },
                  }),
                },
              ],
            },
          },
        ],
      }),
    );

    const provider = new GeminiVisionProvider({ apiKey: 'k', fetchImpl: fetchImpl as never });
    const result = await provider.analyse({ image: Buffer.from('img'), mimeType: 'image/jpeg' });

    expect(result.items[0]!.brand).toBe('HOKA');

    const init = fetchImpl.mock.calls[0]![1]!;
    const body = JSON.parse(init.body as string);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema).toBeDefined();
    // The no-guessing rule is load-bearing; assert it survives prompt edits.
    expect(body.systemInstruction.parts[0].text).toContain('Never guess');
  });

  it('gemini clamps out-of-range boxes and drops degenerate ones', async () => {
    const payload = {
      items: [
        {
          category: 'top',
          subtype: 'tee',
          brand: '   ',
          colors: ['black'],
          pattern: 'solid',
          material: null,
          styleTags: [],
          description: 'A tee.',
          searchQuery: 'black tee',
          bbox: [0.1, 0.1, 0.9, 0.9],
          confidence: 0.5,
          isPrimary: true,
        },
      ],
      styleTags: [],
      score: { fit: 50, colorStory: 50, texture: 50, statement: 50, cohesion: 50 },
      captionSuggestions: [],
      safety: { flagged: false, reasons: [] },
    };
    const fetchImpl = vi.fn(async () =>
      Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
    );
    const provider = new GeminiVisionProvider({ apiKey: 'k', fetchImpl: fetchImpl as never });
    const result = await provider.analyse({ image: Buffer.from('i'), mimeType: 'image/jpeg' });
    // Whitespace-only brand becomes null rather than an empty label.
    expect(result.items[0]!.brand).toBeNull();
  });

  it('serpapi maps shopping results into candidates', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        shopping_results: [
          {
            title: 'HOKA Skyward X',
            product_link: 'https://google.com/shopping/product/1',
            source: 'Nordstrom',
            extracted_price: 225,
            thumbnail: 'https://encrypted-tbn.gstatic.com/x.png',
            rating: 4.6,
            reviews: 812,
          },
          // Malformed row: no URL. Must be skipped, not fatal.
          { title: 'Broken', source: 'Nowhere' },
        ],
      }),
    );

    const provider = new SerpApiProductSearchProvider({
      apiKey: 'k',
      fetchImpl: fetchImpl as never,
    });
    const results = await provider.search({ query: 'hoka skyward x' });

    expect(results).toHaveLength(1);
    expect(results[0]!.priceCents).toBe(22500);
    expect(results[0]!.source).toBe('Nordstrom');
    expect(results[0]!.imageUrl).toContain('gstatic.com');
  });

  it('serpapi flags second-hand listings', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        shopping_results: [
          {
            title: 'Used HOKA',
            link: 'https://ebay.com/x',
            source: 'eBay',
            extracted_price: 60,
            second_hand_condition: 'used',
          },
        ],
      }),
    );
    const provider = new SerpApiProductSearchProvider({
      apiKey: 'k',
      fetchImpl: fetchImpl as never,
    });
    const results = await provider.search({ query: 'hoka' });
    expect(results[0]!.isSecondhand).toBe(true);
  });
});
