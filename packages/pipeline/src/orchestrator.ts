import {
  computeScore,
  pickArchetype,
  type LookLayout,
  type PipelineStage,
  type ProductCandidate,
  type VisionResult,
  type ViolaScore,
} from '@viola/core';
import { analysisRaster, makeCutout, prepareUpload, tinyPlaceholder } from './imagery.js';
import { computeLayout } from './layout.js';
import { buildSearchQuery, queryHash } from './normalise.js';
import { resolveBest, type ResolutionResult } from './ranking.js';
import type { Providers } from './providers/types.js';

/**
 * The pipeline orchestrator.
 *
 * Stages run in order, each one independently retryable and idempotent. The
 * governing rule is **graceful degradation**: a stage that fails must never
 * cost the user their whole look. An item we cannot price still gets a label;
 * an image we cannot fetch still gets a card; a look that fails product
 * resolution entirely still publishes with a score and a vibe.
 *
 * The alternative — all-or-nothing — would mean one flaky retailer thumbnail
 * turns into a failed upload, which for a consumer app is unacceptable.
 */

export interface ProductCache {
  get(hash: string): Promise<CachedProduct | null>;
  set(hash: string, product: CachedProduct): Promise<void>;
}

export interface CachedProduct {
  queryHash: string;
  normalisedQuery: string;
  brand: string | null;
  title: string;
  source: string;
  merchantUrl: string;
  priceCents: number | null;
  currency: string;
  imagePath: string | null;
  rating: number | null;
  reviewCount: number | null;
}

/** In-memory cache. Production swaps in the products table. */
export class MemoryProductCache implements ProductCache {
  private readonly entries = new Map<string, CachedProduct>();
  public hits = 0;
  public misses = 0;

  async get(hash: string): Promise<CachedProduct | null> {
    const found = this.entries.get(hash) ?? null;
    if (found) this.hits++;
    else this.misses++;
    return found;
  }

  async set(hash: string, product: CachedProduct): Promise<void> {
    this.entries.set(hash, product);
  }
}

export interface ResolvedItem {
  index: number;
  category: string;
  subtype: string;
  brand: string | null;
  title: string | null;
  description: string;
  colors: string[];
  pattern: string;
  material: string | null;
  bbox: VisionResult['items'][number]['bbox'];
  confidence: number;
  isPrimary: boolean;
  searchQuery: string;
  product: CachedProduct | null;
  alternates: ProductCandidate[];
  secondhand: ProductCandidate[];
  /** Set when resolution failed, for diagnostics. Never shown to users. */
  resolutionNote?: string;
}

export interface PipelineResult {
  lookId: string;
  photoPath: string;
  photoWidth: number;
  photoHeight: number;
  placeholder: string;
  items: ResolvedItem[];
  layout: LookLayout;
  score: ViolaScore;
  archetypeId: string;
  styleTags: string[];
  captionSuggestions: string[];
  quarantined: boolean;
  quarantineReasons: string[];
  stagesRun: PipelineStage[];
  warnings: string[];
  timings: Partial<Record<PipelineStage, number>>;
}

export interface RunPipelineInput {
  lookId: string;
  image: Buffer;
  mimeType?: string;
  providers: Providers;
  cache?: ProductCache;
  /** Cap on product searches for one look. Cost control. */
  maxResolutions?: number;
  hint?: string;
  /** Injectable so cutout fetching can be tested without the network. */
  fetchImpl?: typeof fetch;
  onStage?: (stage: PipelineStage, result: { ok: boolean; ms: number }) => void;
}

const STORAGE_PREFIX = {
  photos: 'looks/photos',
  cutouts: 'products/cutouts',
};

export async function runPipeline(input: RunPipelineInput): Promise<PipelineResult> {
  const {
    lookId,
    image,
    mimeType = 'image/jpeg',
    providers,
    cache,
    maxResolutions = 6,
    hint,
    fetchImpl = fetch,
    onStage,
  } = input;

  const warnings: string[] = [];
  const stagesRun: PipelineStage[] = [];
  const timings: Partial<Record<PipelineStage, number>> = {};

  const stage = async <T>(name: PipelineStage, fn: () => Promise<T>): Promise<T> => {
    const started = Date.now();
    try {
      const value = await fn();
      const ms = Date.now() - started;
      timings[name] = ms;
      stagesRun.push(name);
      onStage?.(name, { ok: true, ms });
      return value;
    } catch (error) {
      const ms = Date.now() - started;
      timings[name] = ms;
      onStage?.(name, { ok: false, ms });
      throw error;
    }
  };

  // --- 1. ingest ------------------------------------------------------------
  const prepared = await stage('ingest', async () => {
    const result = await prepareUpload(image);
    await providers.storage.put(
      `${STORAGE_PREFIX.photos}/${lookId}.jpg`,
      result.data,
      'image/jpeg',
    );
    return result;
  });

  const photoPath = `${STORAGE_PREFIX.photos}/${lookId}.jpg`;
  const placeholder = await tinyPlaceholder(prepared.data);

  // --- 2. vision ------------------------------------------------------------
  const vision = await stage('vision', () =>
    providers.vision.analyse({ image: prepared.data, mimeType, hint }),
  );

  // Safety gate. App Store guideline 1.2 requires a content filter, and a
  // flagged upload must never reach the public feed.
  if (vision.safety.flagged) {
    return {
      lookId,
      photoPath,
      photoWidth: prepared.width,
      photoHeight: prepared.height,
      placeholder,
      items: [],
      layout: { subject: { x0: 0.3, x1: 0.7 }, slots: [], unplaced: [] },
      score: computeScore({
        raw: { fit: 0, colorStory: 0, texture: 0, statement: 0, cohesion: 0 },
        itemCount: 0,
      }),
      archetypeId: pickArchetype([]).id,
      styleTags: [],
      captionSuggestions: [],
      quarantined: true,
      quarantineReasons: vision.safety.reasons,
      stagesRun,
      warnings,
      timings,
    };
  }

  // Primary items lead; within that, higher confidence first. This is what
  // decides which pieces get a card when there are more garments than slots.
  const ordered = [...vision.items].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return b.confidence - a.confidence;
  });

  // --- 3 & 4. resolve + imagery --------------------------------------------
  const items: ResolvedItem[] = await stage('resolve', async () => {
    const out: ResolvedItem[] = [];
    let searches = 0;

    for (const [index, item] of ordered.entries()) {
      const query = buildSearchQuery({ brand: item.brand, searchQuery: item.searchQuery });
      const hash = queryHash(query);

      const base: ResolvedItem = {
        index,
        category: item.category,
        subtype: item.subtype,
        brand: item.brand,
        title: null,
        description: item.description,
        colors: item.colors,
        pattern: item.pattern,
        material: item.material,
        bbox: item.bbox,
        confidence: item.confidence,
        isPrimary: item.isPrimary,
        searchQuery: query,
        product: null,
        alternates: [],
        secondhand: [],
      };

      // Cache first. A viral sneaker is resolved once for everyone, not once
      // per look — this is the single biggest lever on per-look cost.
      const cached = await cache?.get(hash);
      if (cached) {
        out.push({ ...base, product: cached, title: cached.title });
        continue;
      }

      if (searches >= maxResolutions) {
        out.push({ ...base, resolutionNote: 'search budget exhausted for this look' });
        continue;
      }

      let resolution: ResolutionResult;
      try {
        searches++;
        const candidates = await providers.products.search({
          query,
          brand: item.brand,
          limit: 10,
        });
        resolution = resolveBest({ query, brand: item.brand, candidates });
      } catch (error) {
        // One failed lookup must not fail the look.
        warnings.push(`product search failed for "${query}": ${(error as Error).message}`);
        out.push({ ...base, resolutionNote: 'search failed' });
        continue;
      }

      if (!resolution.best) {
        out.push({ ...base, resolutionNote: 'no candidate cleared the confidence bar' });
        continue;
      }

      const candidate = resolution.best.candidate;
      const imagePath = await fetchCutout(candidate, hash, providers, warnings, fetchImpl);

      const product: CachedProduct = {
        queryHash: hash,
        normalisedQuery: query,
        brand: candidate.brand,
        title: candidate.title,
        source: candidate.source,
        merchantUrl: candidate.merchantUrl,
        priceCents: candidate.priceCents,
        currency: candidate.currency,
        imagePath,
        rating: candidate.rating,
        reviewCount: candidate.reviewCount,
      };

      await cache?.set(hash, product);

      out.push({
        ...base,
        product,
        title: candidate.title,
        alternates: resolution.alternates.map((a) => a.candidate),
        secondhand: resolution.secondhand.map((a) => a.candidate),
      });
    }

    return out;
  });

  // --- 5. layout (entirely local) ------------------------------------------
  const layout = await stage('layout', async () => {
    let energy;
    try {
      energy = await analysisRaster(prepared.data);
    } catch (error) {
      // Without the energy map, placement still works — cards just fall back
      // to purely geometric positioning.
      warnings.push(`energy map unavailable: ${(error as Error).message}`);
    }
    // Only items that got a card are placed; the rest live in the rail.
    return computeLayout({ boxes: items.map((i) => i.bbox), energy });
  });

  // --- 6. score -------------------------------------------------------------
  const styleTags = vision.styleTags;
  const archetype = pickArchetype(styleTags);
  const score = computeScore({
    raw: vision.score,
    archetype,
    itemCount: items.filter((i) => i.isPrimary).length,
  });

  return {
    lookId,
    photoPath,
    photoWidth: prepared.width,
    photoHeight: prepared.height,
    placeholder,
    items,
    layout,
    score,
    archetypeId: archetype.id,
    styleTags,
    captionSuggestions: vision.captionSuggestions,
    quarantined: false,
    quarantineReasons: [],
    stagesRun,
    warnings,
    timings,
  };
}

/**
 * Re-hosts a retailer's catalogue image.
 *
 * Search providers return thumbnails hotlinked from a CDN that expires them and
 * blocks cross-origin reads. Both the share card and the OG image would break,
 * so we fetch once, trim the white background, and store our own copy.
 */
async function fetchCutout(
  candidate: ProductCandidate,
  hash: string,
  providers: Providers,
  warnings: string[],
  fetchImpl: typeof fetch,
): Promise<string | null> {
  if (!candidate.imageUrl) return null;

  const path = `${STORAGE_PREFIX.cutouts}/${hash}.png`;
  if (await providers.storage.exists(path)) return path;

  try {
    const response = await fetchImpl(candidate.imageUrl);
    if (!response.ok) throw new Error(`status ${response.status}`);
    const source = Buffer.from(await response.arrayBuffer());
    const cutout = await makeCutout(source);
    await providers.storage.put(path, cutout, 'image/png');
    return path;
  } catch (error) {
    // A missing cutout downgrades the card to a text label. Still useful.
    warnings.push(`cutout fetch failed for ${candidate.title}: ${(error as Error).message}`);
    return null;
  }
}
