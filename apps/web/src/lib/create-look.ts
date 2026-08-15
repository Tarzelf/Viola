import 'server-only';
import { eq } from 'drizzle-orm';
import { generateSlug, isValidSlug } from '@viola/core';
import { schema, type Database } from '@viola/db';
import {
  createFixtureFetch,
  MemoryProductCache,
  runPipeline,
  type CachedProduct,
} from '@viola/pipeline';
import { getArchetype } from '@viola/core';
import { renderAllCards } from '@viola/render';
import { providers } from './providers';
import { track } from './analytics';

/**
 * Creating a look.
 *
 * The pipeline is kicked off after the row exists so the client gets a slug
 * immediately and can start showing progress. Every stage writes its results as
 * it completes, which is what lets the reveal animate pieces in one at a time
 * rather than sitting on a spinner and then dumping everything at once.
 *
 * The whole thing is wrapped so that a failure marks the look failed rather
 * than leaving it stuck in `processing` forever — a look that never resolves is
 * worse than one that clearly failed.
 */

/** Backs the global product cache onto the products table. */
class DbProductCache extends MemoryProductCache {
  constructor(private readonly database: Database) {
    super();
  }

  override async get(hash: string): Promise<CachedProduct | null> {
    const [row] = await this.database
      .select()
      .from(schema.products)
      .where(eq(schema.products.queryHash, hash))
      .limit(1);

    if (!row) {
      await super.get(hash);
      return null;
    }

    // Register the hit on the in-memory counters too, for the demo output.
    await super.set(hash, toCached(row));
    await super.get(hash);

    return toCached(row);
  }

  override async set(hash: string, product: CachedProduct): Promise<void> {
    await super.set(hash, product);
    await this.database
      .insert(schema.products)
      .values({
        queryHash: hash,
        normalisedQuery: product.normalisedQuery,
        brand: product.brand,
        title: product.title,
        source: product.source,
        merchantUrl: product.merchantUrl,
        priceCents: product.priceCents,
        currency: product.currency,
        imagePath: product.imagePath,
        imageSourceUrl: product.imageSourceUrl,
        imageTrimmed: product.imagePath !== null,
        rating: product.rating,
        reviewCount: product.reviewCount,
      })
      .onConflictDoUpdate({
        target: schema.products.queryHash,
        // Lets a repaired cutout overwrite a previously null image.
        set: { imagePath: product.imagePath, imageTrimmed: product.imagePath !== null },
      });
  }
}

function toCached(row: typeof schema.products.$inferSelect): CachedProduct {
  return {
    queryHash: row.queryHash,
    normalisedQuery: row.normalisedQuery,
    brand: row.brand,
    title: row.title,
    source: row.source ?? 'unknown',
    merchantUrl: row.merchantUrl,
    priceCents: row.priceCents,
    currency: row.currency,
    imagePath: row.imagePath,
    imageSourceUrl: row.imageSourceUrl,
    rating: row.rating,
    reviewCount: row.reviewCount,
  };
}

export async function reserveSlug(database: Database): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const slug = generateSlug();
    const [existing] = await database
      .select({ id: schema.looks.id })
      .from(schema.looks)
      .where(eq(schema.looks.slug, slug))
      .limit(1);
    if (!existing) return slug;
  }
  throw new Error('could not reserve a unique slug');
}

export interface CreateLookResult {
  lookId: string;
  slug: string;
}

export async function createLook(
  database: Database,
  input: { userId: string; caption?: string; visibility?: string },
): Promise<CreateLookResult> {
  const slug = await reserveSlug(database);
  const [look] = await database
    .insert(schema.looks)
    .values({
      userId: input.userId,
      slug,
      photoPath: '',
      status: 'processing',
      caption: input.caption ?? null,
      visibility: input.visibility ?? 'public',
    })
    .returning();

  return { lookId: look!.id, slug };
}

/**
 * Runs the pipeline and persists everything.
 *
 * Errors are caught and recorded on the row. A stuck `processing` look is the
 * worst outcome for the user, so any failure becomes a visible failed state.
 */
export async function processLook(
  database: Database,
  lookId: string,
  image: Buffer,
  mimeType: string,
): Promise<void> {
  const p = providers();

  try {
    const result = await runPipeline({
      lookId,
      image,
      mimeType,
      providers: p,
      cache: new DbProductCache(database),
      // Launch lever. With VIOLA_MANUAL_TAGGING=1 no paid product lookup runs
      // at all — garments are still detected, scored and laid out, and the
      // poster fills in the links. That drops a look from about $0.027 to
      // $0.0016, and every link they add is cached globally, so the automated
      // path gets cheaper the longer it stays off.
      skipProductSearch: process.env.VIOLA_MANUAL_TAGGING === '1',
      // In mock mode the catalogue points at a fixture host, so a local upload
      // still produces a card with real cutouts instead of silently degrading
      // to labels only.
      fetchImpl: p.products.name === 'mock' ? createFixtureFetch() : fetch,
      onStage: async (stage, { ok, ms }) => {
        track('look_pipeline_stage_completed', {
          surface: 'web',
          lookId,
          stage,
          ms,
          ok,
        });
        await database
          .update(schema.looks)
          .set({ failureReason: `stage:${stage}` })
          .where(eq(schema.looks.id, lookId));
      },
    });

    if (result.quarantined) {
      track('upload_quarantined', {
        surface: 'web',
        lookId,
        reasons: result.quarantineReasons,
      });
      // App Store guideline 1.2: flagged content is never publicly reachable.
      await database
        .update(schema.looks)
        .set({
          status: 'quarantined',
          photoPath: result.photoPath,
          failureReason: result.quarantineReasons.join('; ').slice(0, 500),
        })
        .where(eq(schema.looks.id, lookId));
      return;
    }

    // Items first, so the client polling for progress sees them appear.
    for (const item of result.items) {
      let productId: string | null = null;
      if (item.product) {
        const [product] = await database
          .select({ id: schema.products.id })
          .from(schema.products)
          .where(eq(schema.products.queryHash, item.product.queryHash))
          .limit(1);
        productId = product?.id ?? null;
      }

      await database.insert(schema.lookItems).values({
        lookId,
        rank: item.index,
        isPrimary: item.isPrimary,
        category: item.category,
        subtype: item.subtype,
        brand: item.brand,
        title: item.title,
        description: item.description,
        colors: item.colors,
        pattern: item.pattern,
        material: item.material,
        bbox: item.bbox,
        confidence: item.confidence,
        searchQuery: item.searchQuery,
        productId,
      });
    }

    await database
      .update(schema.looks)
      .set({
        photoPath: result.photoPath,
        photoWidth: result.photoWidth,
        photoHeight: result.photoHeight,
        photoBlurhash: result.placeholder,
        layout: result.layout,
        score: result.score.overall,
        scoreBreakdown: result.score.breakdown,
        archetypeId: result.archetypeId,
        styleTags: result.styleTags,
        status: 'ready',
        failureReason: null,
        publishedAt: new Date(),
      })
      .where(eq(schema.looks.id, lookId));

    track('look_published', {
      surface: 'web',
      lookId,
      itemCount: result.items.length,
      score: result.score.overall,
      archetype: result.archetypeId,
      visibility: 'public',
    });

    // Share cards last: the look is already usable without them, and a render
    // failure must not block publication.
    void renderCards(database, lookId).catch((error) => {
      console.warn(`[viola] card render failed for ${lookId}:`, error);
    });
  } catch (error) {
    console.error(`[viola] pipeline failed for ${lookId}:`, error);
    await database
      .update(schema.looks)
      .set({ status: 'failed', failureReason: String(error).slice(0, 500) })
      .where(eq(schema.looks.id, lookId));
  }
}

async function renderCards(database: Database, lookId: string): Promise<void> {
  const storage = providers().storage;

  const [look] = await database
    .select()
    .from(schema.looks)
    .where(eq(schema.looks.id, lookId))
    .limit(1);
  if (!look?.layout) return;

  const [profile] = await database
    .select({ handle: schema.profiles.handle })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, look.userId))
    .limit(1);

  const photo = await storage.get(look.photoPath);
  if (!photo) return;

  const rows = await database
    .select({
      rank: schema.lookItems.rank,
      brand: schema.lookItems.brand,
      title: schema.lookItems.title,
      subtype: schema.lookItems.subtype,
      priceCents: schema.products.priceCents,
      imagePath: schema.products.imagePath,
    })
    .from(schema.lookItems)
    .leftJoin(schema.products, eq(schema.products.id, schema.lookItems.productId))
    .where(eq(schema.lookItems.lookId, lookId))
    .orderBy(schema.lookItems.rank);

  const items = await Promise.all(
    rows.map(async (row) => ({
      index: row.rank,
      brand: row.brand,
      title: row.title,
      subtype: row.subtype,
      priceCents: row.priceCents,
      cutout: row.imagePath ? await storage.get(row.imagePath) : null,
    })),
  );

  const cards = await renderAllCards({
    photo,
    items,
    layout: look.layout,
    archetypeName: getArchetype(look.archetypeId ?? '')?.name ?? 'A look',
    score: look.score ?? 0,
    handle: profile?.handle ?? 'viola',
  });

  const base = `looks/cards/${look.slug}`;
  await Promise.all([
    storage.put(`${base}-story.png`, cards.story.png, 'image/png'),
    storage.put(`${base}-og.png`, cards.og.png, 'image/png'),
    storage.put(`${base}-square.png`, cards.square.png, 'image/png'),
  ]);

  await database
    .update(schema.looks)
    .set({
      storyCardPath: `${base}-story.png`,
      ogCardPath: `${base}-og.png`,
      squareCardPath: `${base}-square.png`,
    })
    .where(eq(schema.looks.id, lookId));
}

export { isValidSlug };
