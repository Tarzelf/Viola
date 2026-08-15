import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { ViolaError, forbidden, notFound } from '@viola/core';
import { schema, type Database } from '@viola/db';
import { queryHash } from '@viola/pipeline';

/**
 * Letting people identify their own pieces.
 *
 * The obvious reading of this is cost control — every item someone types is an
 * AI lookup we do not pay for. That is true, but it undersells it.
 *
 * The `products` table is keyed by a normalised query hash and is **global,
 * not per user**. So when one person types "Aritzia Effortless Pant" with a
 * link, that mapping becomes a cache hit for everyone who posts the same
 * trousers afterwards. Manual entries do not just avoid one lookup — they
 * permanently remove that item from the paid path for the whole product.
 *
 * Which makes this a compounding asset rather than a stopgap: the more the app
 * is used, the less each look costs to resolve. It is also the only source of
 * ground truth we will ever have about which product a given garment actually
 * is, and that is worth more than the API spend it saves.
 *
 * Two guardrails matter. A person may only edit their own look, and a
 * user-supplied entry is never overwritten by a later automated guess — they
 * were there, the model was not.
 */

export interface ManualItemInput {
  brand?: string | null;
  title?: string | null;
  /** Where to buy it. Validated and normalised before storage. */
  url?: string | null;
  priceCents?: number | null;
}

const BLOCKED_PROTOCOLS = new Set(['javascript:', 'data:', 'file:', 'vbscript:']);

/**
 * Validates a user-supplied shop link.
 *
 * This URL is stored and later redirected to, so it is untrusted input on a
 * path that sends other people's browsers somewhere. Only http(s) is allowed,
 * and tracking noise is stripped so the same product pasted by two people
 * still hashes to one cache entry.
 */
export function normaliseShopUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new ViolaError('validation_failed', 'unparseable url', {
      publicMessage: "That doesn't look like a link.",
    });
  }

  if (BLOCKED_PROTOCOLS.has(parsed.protocol) || !/^https?:$/.test(parsed.protocol)) {
    throw new ViolaError('validation_failed', `blocked protocol ${parsed.protocol}`, {
      publicMessage: 'Only web links are allowed.',
    });
  }

  // Someone else's affiliate tags should not ride along on our redirect.
  for (const key of [...parsed.searchParams.keys()]) {
    if (/^(utm_|gclid|fbclid|mc_|ref|referrer|tag|affid|aff_id|irclickid)/i.test(key)) {
      parsed.searchParams.delete(key);
    }
  }

  parsed.hash = '';
  return parsed.toString();
}

export interface ManualItemResult {
  itemId: string;
  productId: string | null;
  /** True when this entry also filled a gap in the shared product cache. */
  seededCache: boolean;
}

export async function setItemManually(
  db: Database,
  input: { userId: string; lookSlug: string; itemId: string; values: ManualItemInput },
): Promise<ManualItemResult> {
  const [row] = await db
    .select({
      itemId: schema.lookItems.id,
      lookId: schema.looks.id,
      ownerId: schema.looks.userId,
      subtype: schema.lookItems.subtype,
      searchQuery: schema.lookItems.searchQuery,
    })
    .from(schema.lookItems)
    .innerJoin(schema.looks, eq(schema.looks.id, schema.lookItems.lookId))
    .where(and(eq(schema.lookItems.id, input.itemId), eq(schema.looks.slug, input.lookSlug)))
    .limit(1);

  if (!row) throw notFound('item');
  if (row.ownerId !== input.userId) throw forbidden('not your look');

  const brand = input.values.brand?.trim() || null;
  const title = input.values.title?.trim() || null;
  const url = input.values.url ? normaliseShopUrl(input.values.url) : null;
  const priceCents =
    typeof input.values.priceCents === 'number' && input.values.priceCents >= 0
      ? Math.round(input.values.priceCents)
      : null;

  if (!brand && !title && !url) {
    throw new ViolaError('validation_failed', 'nothing to set', {
      publicMessage: 'Add a name or a link.',
    });
  }

  let productId: string | null = null;
  let seededCache = false;

  if (url) {
    // Key on what the person actually told us, so the next person who posts
    // the same garment hits this entry instead of paying for a lookup.
    const label = [brand, title].filter(Boolean).join(' ') || row.searchQuery || row.subtype;
    const hash = queryHash(label);

    const [existing] = await db
      .select({ id: schema.products.id, merchantUrl: schema.products.merchantUrl })
      .from(schema.products)
      .where(eq(schema.products.queryHash, hash))
      .limit(1);

    if (existing) {
      productId = existing.id;
    } else {
      const [created] = await db
        .insert(schema.products)
        .values({
          queryHash: hash,
          normalisedQuery: label,
          brand,
          title: title ?? label,
          source: hostOf(url),
          merchantUrl: url,
          priceCents,
          currency: 'USD',
        })
        .returning();
      productId = created!.id;
      seededCache = true;
    }
  }

  await db
    .update(schema.lookItems)
    .set({
      ...(brand !== null ? { brand } : {}),
      ...(title !== null ? { title } : {}),
      ...(productId ? { productId } : {}),
      // Locks the item against re-resolution. The person wearing it knows
      // better than a later automated guess.
      isUserCorrected: true,
      updatedAt: new Date(),
    })
    .where(eq(schema.lookItems.id, row.itemId));

  return { itemId: row.itemId, productId, seededCache };
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

/**
 * How much the community has taken off the paid path.
 *
 * Worth watching: if this climbs, per-look cost falls without anything being
 * optimised.
 */
export async function manualContributionStats(db: Database) {
  const [corrected] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.lookItems)
    .where(eq(schema.lookItems.isUserCorrected, true));

  const [total] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.lookItems);

  const [cached] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.products);

  const correctedCount = Number(corrected?.n ?? 0);
  const totalCount = Number(total?.n ?? 0);

  return {
    correctedItems: correctedCount,
    totalItems: totalCount,
    cachedProducts: Number(cached?.n ?? 0),
    correctedShare: totalCount > 0 ? correctedCount / totalCount : 0,
  };
}
