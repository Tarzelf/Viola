import 'server-only';
import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { schema } from '@viola/db';
import { getArchetype, type LookLayout, type ScoreBreakdown } from '@viola/core';
import { db } from './db';

/**
 * Read models.
 *
 * Shared by the server components and the API routes so both platforms see
 * exactly the same shapes. Everything here filters to ready + visible looks by
 * default — quarantined content must never be reachable from a public surface,
 * which is an App Store guideline 1.2 requirement as well as basic hygiene.
 */

export interface FeedItemView {
  id: string;
  slug: string;
  photoPath: string;
  placeholder: string | null;
  score: number | null;
  archetypeId: string | null;
  archetypeName: string | null;
  caption: string | null;
  bloomCount: number;
  viewCount: number;
  publishedAt: Date | null;
  handle: string;
  displayName: string | null;
  itemCount: number;
  bloomedByViewer: boolean;
}

export interface LookItemView {
  id: string;
  rank: number;
  category: string;
  subtype: string;
  brand: string | null;
  title: string | null;
  description: string | null;
  bbox: [number, number, number, number];
  confidence: number;
  productId: string | null;
  priceCents: number | null;
  currency: string;
  source: string | null;
  merchantUrl: string | null;
  imagePath: string | null;
}

export interface LookView extends FeedItemView {
  layout: LookLayout | null;
  scoreBreakdown: ScoreBreakdown | null;
  storyCardPath: string | null;
  ogCardPath: string | null;
  status: string;
  visibility: string;
  userId: string;
  items: LookItemView[];
}

const VISIBLE = sql`${schema.looks.status} = 'ready' and ${schema.looks.visibility} <> 'private'`;

export type FeedTab = 'for-you' | 'fresh' | 'top';

export async function getFeed(options: {
  tab?: FeedTab;
  limit?: number;
  viewerUserId?: string | null;
  viewerGuestId?: string | null;
}): Promise<FeedItemView[]> {
  const database = await db();
  const limit = options.limit ?? 24;

  const order =
    options.tab === 'top'
      ? [desc(schema.looks.bloomCount), desc(schema.looks.publishedAt)]
      : [desc(schema.looks.publishedAt)];

  // Top of the Week shows only the top. There is deliberately no inverse view —
  // a public ranking of the lowest-scoring looks would be actively harmful to
  // the audience this is built for.
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const where =
    options.tab === 'top' ? and(VISIBLE, gt(schema.looks.publishedAt, weekAgo)) : VISIBLE;

  const rows = await database
    .select({
      id: schema.looks.id,
      slug: schema.looks.slug,
      photoPath: schema.looks.photoPath,
      placeholder: schema.looks.photoBlurhash,
      score: schema.looks.score,
      archetypeId: schema.looks.archetypeId,
      caption: schema.looks.caption,
      bloomCount: schema.looks.bloomCount,
      viewCount: schema.looks.viewCount,
      publishedAt: schema.looks.publishedAt,
      handle: schema.profiles.handle,
      displayName: schema.profiles.displayName,
    })
    .from(schema.looks)
    .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.looks.userId))
    .where(where)
    .orderBy(...order)
    .limit(limit);

  return decorate(rows, options);
}

export async function getProfileLooks(
  handle: string,
  options: { viewerUserId?: string | null; viewerGuestId?: string | null } = {},
): Promise<FeedItemView[]> {
  const database = await db();
  const rows = await database
    .select({
      id: schema.looks.id,
      slug: schema.looks.slug,
      photoPath: schema.looks.photoPath,
      placeholder: schema.looks.photoBlurhash,
      score: schema.looks.score,
      archetypeId: schema.looks.archetypeId,
      caption: schema.looks.caption,
      bloomCount: schema.looks.bloomCount,
      viewCount: schema.looks.viewCount,
      publishedAt: schema.looks.publishedAt,
      handle: schema.profiles.handle,
      displayName: schema.profiles.displayName,
    })
    .from(schema.looks)
    .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.looks.userId))
    .where(and(VISIBLE, eq(schema.profiles.handle, handle)))
    .orderBy(desc(schema.looks.publishedAt));

  return decorate(rows, options);
}

type RawFeedRow = Omit<FeedItemView, 'archetypeName' | 'itemCount' | 'bloomedByViewer'>;

async function decorate(
  rows: RawFeedRow[],
  options: { viewerUserId?: string | null; viewerGuestId?: string | null },
): Promise<FeedItemView[]> {
  if (rows.length === 0) return [];
  const database = await db();
  const ids = rows.map((r) => r.id);

  const counts = await database
    .select({ lookId: schema.lookItems.lookId, count: sql<number>`count(*)::int` })
    .from(schema.lookItems)
    .where(inArray(schema.lookItems.lookId, ids))
    .groupBy(schema.lookItems.lookId);

  const countByLook = new Map(counts.map((c) => [c.lookId, Number(c.count)]));

  // Whether the viewer has already bloomed. Guests are looked up by device id
  // so a share recipient sees their own bloom reflected without an account.
  let bloomed = new Set<string>();
  if (options.viewerUserId || options.viewerGuestId) {
    const predicate = options.viewerUserId
      ? eq(schema.blooms.userId, options.viewerUserId)
      : eq(schema.blooms.guestId, options.viewerGuestId!);
    const rowsB = await database
      .select({ lookId: schema.blooms.lookId })
      .from(schema.blooms)
      .where(and(inArray(schema.blooms.lookId, ids), predicate));
    bloomed = new Set(rowsB.map((r) => r.lookId));
  }

  return rows.map((row) => ({
    ...row,
    archetypeName: row.archetypeId ? (getArchetype(row.archetypeId)?.name ?? null) : null,
    itemCount: countByLook.get(row.id) ?? 0,
    bloomedByViewer: bloomed.has(row.id),
  }));
}

export async function getLookBySlug(
  slug: string,
  options: { viewerUserId?: string | null; viewerGuestId?: string | null } = {},
): Promise<LookView | null> {
  const database = await db();

  const [row] = await database
    .select({
      id: schema.looks.id,
      userId: schema.looks.userId,
      slug: schema.looks.slug,
      photoPath: schema.looks.photoPath,
      placeholder: schema.looks.photoBlurhash,
      score: schema.looks.score,
      scoreBreakdown: schema.looks.scoreBreakdown,
      archetypeId: schema.looks.archetypeId,
      caption: schema.looks.caption,
      bloomCount: schema.looks.bloomCount,
      viewCount: schema.looks.viewCount,
      publishedAt: schema.looks.publishedAt,
      layout: schema.looks.layout,
      storyCardPath: schema.looks.storyCardPath,
      ogCardPath: schema.looks.ogCardPath,
      status: schema.looks.status,
      visibility: schema.looks.visibility,
      handle: schema.profiles.handle,
      displayName: schema.profiles.displayName,
    })
    .from(schema.looks)
    .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.looks.userId))
    .where(eq(schema.looks.slug, slug))
    .limit(1);

  if (!row) return null;
  // Quarantined content is never reachable, even by direct link.
  if (row.status === 'quarantined') return null;

  const items = await database
    .select({
      id: schema.lookItems.id,
      rank: schema.lookItems.rank,
      category: schema.lookItems.category,
      subtype: schema.lookItems.subtype,
      brand: schema.lookItems.brand,
      title: schema.lookItems.title,
      description: schema.lookItems.description,
      bbox: schema.lookItems.bbox,
      confidence: schema.lookItems.confidence,
      productId: schema.lookItems.productId,
      priceCents: schema.products.priceCents,
      currency: schema.products.currency,
      source: schema.products.source,
      merchantUrl: schema.products.merchantUrl,
      imagePath: schema.products.imagePath,
    })
    .from(schema.lookItems)
    .leftJoin(schema.products, eq(schema.products.id, schema.lookItems.productId))
    .where(eq(schema.lookItems.lookId, row.id))
    .orderBy(schema.lookItems.rank);

  const [decorated] = await decorate([row], options);

  return {
    ...decorated!,
    userId: row.userId,
    layout: row.layout,
    scoreBreakdown: row.scoreBreakdown,
    storyCardPath: row.storyCardPath,
    ogCardPath: row.ogCardPath,
    status: row.status,
    visibility: row.visibility,
    items: items.map((i) => ({
      ...i,
      currency: i.currency ?? 'USD',
      bbox: i.bbox as [number, number, number, number],
    })),
  };
}

export async function getProfile(handle: string) {
  const database = await db();
  const [row] = await database
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.handle, handle))
    .limit(1);
  return row ?? null;
}
