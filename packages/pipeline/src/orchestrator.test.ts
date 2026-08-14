import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { SCORE_FLOOR } from '@viola/core';
import { solidImage } from './imagery';
import { MemoryProductCache, runPipeline } from './orchestrator';
import {
  MemoryStorageProvider,
  MockProductSearchProvider,
  MockVisionProvider,
  mockProviders,
} from './providers/index';

/** Serves a synthetic catalogue image, so the imagery stage runs offline. */
let catalogueImage: Buffer;
const fetchImpl = (async (input: string | URL | Request) => {
  const url = String(input);
  if (!url.includes('cdn.example.com')) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(catalogueImage), {
    status: 200,
    headers: { 'content-type': 'image/png' },
  });
}) as typeof fetch;

const failingFetch = (async () => {
  throw new Error('network unreachable');
}) as typeof fetch;

let photo: Buffer;

beforeAll(async () => {
  photo = await solidImage(1200, 1500, { r: 92, g: 88, b: 104 });
  catalogueImage = await sharp({
    create: { width: 600, height: 600, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([
      {
        input: Buffer.from(
          '<svg width="600" height="600"><circle cx="300" cy="300" r="180" fill="#6C63FF"/></svg>',
        ),
      },
    ])
    .png()
    .toBuffer();
});

describe('runPipeline', () => {
  it('produces a complete look with no API keys and no network', async () => {
    // This is the acceptance criterion for the whole provider abstraction.
    const providers = mockProviders();
    const result = await runPipeline({
      lookId: 'look-1',
      image: photo,
      providers,
      cache: new MemoryProductCache(),
      fetchImpl,
    });

    expect(result.quarantined).toBe(false);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.score.overall).toBeGreaterThanOrEqual(SCORE_FLOOR);
    expect(result.archetypeId).toBeTruthy();
    expect(result.layout.slots.length).toBeGreaterThan(0);
    expect(result.stagesRun).toEqual(['ingest', 'vision', 'resolve', 'layout']);
  });

  it('stores the prepared photo and reports its dimensions', async () => {
    const storage = new MemoryStorageProvider();
    const result = await runPipeline({
      lookId: 'look-2',
      image: photo,
      providers: mockProviders({ storage }),
      fetchImpl,
    });

    expect(await storage.exists(result.photoPath)).toBe(true);
    expect(result.photoWidth).toBeGreaterThan(0);
    expect(result.photoHeight).toBeGreaterThan(0);
    expect(result.placeholder.startsWith('data:image/webp;base64,')).toBe(true);
  });

  it('resolves products and re-hosts their catalogue images', async () => {
    const storage = new MemoryStorageProvider();
    const result = await runPipeline({
      lookId: 'look-3',
      image: photo,
      providers: mockProviders({ storage }),
      cache: new MemoryProductCache(),
      fetchImpl,
    });

    const resolved = result.items.filter((i) => i.product);
    expect(resolved.length).toBeGreaterThan(0);
    for (const item of resolved) {
      expect(item.product!.merchantUrl).toMatch(/^https?:\/\//);
      // Re-hosted under our own path, not hotlinked from the search CDN.
      expect(item.product!.imagePath).toMatch(/^products\/cutouts\//);
      expect(await storage.exists(item.product!.imagePath!)).toBe(true);
    }
  });

  it('serves repeat lookups from the cache — the main cost control', async () => {
    const products = new MockProductSearchProvider();
    const providers = mockProviders({ products });
    const cache = new MemoryProductCache();

    await runPipeline({ lookId: 'a', image: photo, providers, cache, fetchImpl });
    const afterFirst = products.calls.length;
    expect(afterFirst).toBeGreaterThan(0);

    await runPipeline({ lookId: 'b', image: photo, providers, cache, fetchImpl });
    // A viral item resolves once for everyone, not once per look.
    expect(products.calls.length).toBe(afterFirst);
    expect(cache.hits).toBeGreaterThan(0);
  });

  it('respects the per-look search budget', async () => {
    const products = new MockProductSearchProvider();
    const result = await runPipeline({
      lookId: 'budget',
      image: photo,
      providers: mockProviders({ products }),
      maxResolutions: 1,
      fetchImpl,
    });

    expect(products.calls.length).toBe(1);
    const skipped = result.items.filter((i) => i.resolutionNote?.includes('budget'));
    expect(skipped.length).toBeGreaterThan(0);
  });
});

describe('graceful degradation', () => {
  it('still publishes a look when product search fails entirely', async () => {
    // One flaky vendor must never turn into a failed upload.
    const products = {
      name: 'broken',
      costCents: 0,
      search: async () => {
        throw new Error('vendor down');
      },
    };
    const result = await runPipeline({
      lookId: 'degraded',
      image: photo,
      providers: mockProviders({ products }),
      fetchImpl,
    });

    expect(result.quarantined).toBe(false);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((i) => i.product === null)).toBe(true);
    expect(result.score.overall).toBeGreaterThanOrEqual(SCORE_FLOOR);
    // Items still get placed, so the card renders with labels and no prices.
    expect(result.layout.slots.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes('product search failed'))).toBe(true);
  });

  it('still publishes when no candidate clears the confidence bar', async () => {
    const products = new MockProductSearchProvider({ returnEmpty: true });
    const result = await runPipeline({
      lookId: 'nomatch',
      image: photo,
      providers: mockProviders({ products }),
      fetchImpl,
    });

    expect(result.items.every((i) => i.product === null)).toBe(true);
    expect(result.items.every((i) => i.resolutionNote)).toBe(true);
    expect(result.layout.slots.length).toBeGreaterThan(0);
  });

  it('keeps the item when its cutout cannot be fetched', async () => {
    const result = await runPipeline({
      lookId: 'nocutout',
      image: photo,
      providers: mockProviders(),
      fetchImpl: failingFetch,
    });

    const resolved = result.items.filter((i) => i.product);
    expect(resolved.length).toBeGreaterThan(0);
    // Product resolved, image did not. Card degrades to a text label.
    expect(resolved.every((i) => i.product!.imagePath === null)).toBe(true);
    expect(result.warnings.some((w) => w.includes('cutout fetch failed'))).toBe(true);
  });
});

describe('safety gate', () => {
  it('quarantines a flagged upload and never resolves products for it', async () => {
    // App Store guideline 1.2 requires a content filter, and flagged content
    // must not reach the public feed.
    const products = new MockProductSearchProvider();
    const result = await runPipeline({
      lookId: 'flagged',
      image: photo,
      providers: mockProviders({
        vision: new MockVisionProvider({ forceFlagged: true }),
        products,
      }),
      fetchImpl,
    });

    expect(result.quarantined).toBe(true);
    expect(result.quarantineReasons.length).toBeGreaterThan(0);
    expect(result.items).toHaveLength(0);
    // No spend on content we are going to reject.
    expect(products.calls).toHaveLength(0);
  });
});

describe('stage reporting', () => {
  it('reports each stage with timing, for the progressive reveal', async () => {
    const seen: Array<{ stage: string; ok: boolean }> = [];
    await runPipeline({
      lookId: 'staged',
      image: photo,
      providers: mockProviders(),
      fetchImpl,
      onStage: (stage, { ok }) => seen.push({ stage, ok }),
    });

    expect(seen.map((s) => s.stage)).toEqual(['ingest', 'vision', 'resolve', 'layout']);
    expect(seen.every((s) => s.ok)).toBe(true);
  });

  it('records timings for every stage that ran', async () => {
    const result = await runPipeline({
      lookId: 'timed',
      image: photo,
      providers: mockProviders(),
      fetchImpl,
    });
    for (const stage of result.stagesRun) {
      expect(result.timings[stage]).toBeTypeOf('number');
    }
  });
});

describe('ordering', () => {
  it('leads with primary items, then by confidence', async () => {
    // This decides which garments get a card when slots are scarce.
    const result = await runPipeline({
      lookId: 'ordered',
      image: photo,
      providers: mockProviders({ vision: new MockVisionProvider({ fixtureIndex: 1 }) }),
      fetchImpl,
    });

    const primaryFlags = result.items.map((i) => i.isPrimary);
    const firstNonPrimary = primaryFlags.indexOf(false);
    if (firstNonPrimary !== -1) {
      expect(primaryFlags.slice(firstNonPrimary).every((p) => !p)).toBe(true);
    }

    const primaries = result.items.filter((i) => i.isPrimary);
    for (let i = 1; i < primaries.length; i++) {
      expect(primaries[i - 1]!.confidence).toBeGreaterThanOrEqual(primaries[i]!.confidence);
    }
  });
});
